import crypto from 'crypto'

interface ServiceAccount {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
}

let serviceAccount: ServiceAccount | null = null
let cachedToken: { token: string; expiresAt: number } | null = null

function getServiceAccount(): ServiceAccount {
  if (serviceAccount) return serviceAccount

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!base64) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set')
  }

  serviceAccount = JSON.parse(
    Buffer.from(base64, 'base64').toString('utf8')
  ) as ServiceAccount

  return serviceAccount
}

/**
 * Generate a Google OAuth2 access token using the service account JWT
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300000) {
    return cachedToken.token
  }

  const sa = getServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const jwtHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const jwtPayload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase',
    aud: sa.token_uri,
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const signatureInput = `${jwtHeader}.${jwtPayload}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(signatureInput)
  const signature = signer.sign(sa.private_key, 'base64url')

  const jwt = `${signatureInput}.${signature}`

  const response = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const data = await response.json() as any
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`)
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in,
  }

  return data.access_token
}

/**
 * Query Firestore for documents in a collection
 */
export async function queryCollection(
  collectionPath: string,
  orderBy?: string,
  limit?: number,
  startAfterDocId?: string
): Promise<{ documents: any[]; lastDocId: string | null }> {
  const sa = getServiceAccount()
  const token = await getAccessToken()

  // Build the Firestore REST API URL
  let url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${collectionPath}`

  const params = new URLSearchParams()
  if (orderBy) {
    params.append('orderBy', orderBy)
  }
  if (limit) {
    params.append('pageSize', String(limit))
  }

  const queryString = params.toString()
  if (queryString) {
    url += '?' + queryString
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Firestore query failed: ${response.status} ${errorText}`)
  }

  const data = await response.json() as any
  const documents = data.documents || []
  const lastDocId = documents.length > 0
    ? documents[documents.length - 1].name.split('/').pop()
    : null

  return {
    documents: documents.map((doc: any) => ({
      id: doc.name.split('/').pop(),
      data: fieldsToObject(doc.fields),
      createTime: doc.createTime,
    })),
    lastDocId,
  }
}

/**
 * Convert Firestore fields format to plain object
 */
function fieldsToObject(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value.stringValue !== undefined) {
      result[key] = value.stringValue
    } else if (value.integerValue !== undefined) {
      result[key] = parseInt(value.integerValue, 10)
    } else if (value.doubleValue !== undefined) {
      result[key] = value.doubleValue
    } else if (value.booleanValue !== undefined) {
      result[key] = value.booleanValue
    } else if (value.timestampValue !== undefined) {
      result[key] = new Date(value.timestampValue)
    } else if (value.mapValue !== undefined) {
      result[key] = fieldsToObject(value.mapValue.fields || {})
    } else if (value.arrayValue !== undefined) {
      result[key] = (value.arrayValue.values || []).map((v: any) => fieldsToObject({ v }).v)
    } else if (value.nullValue !== undefined) {
      result[key] = null
    } else {
      result[key] = value
    }
  }
  return result
}

export { getServiceAccount }
