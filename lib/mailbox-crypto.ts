// Simple encryption/decryption for mailbox passwords
// Uses AES-256-GCM via Node.js crypto

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.MAILBOX_ENCRYPTION_KEY
  if (!key) {
    throw new Error('MAILBOX_ENCRYPTION_KEY environment variable is not set')
  }
  // Support both hex and raw keys
  if (key.length === 64) {
    return Buffer.from(key, 'hex')
  }
  // If key is too short, hash it to get a proper 32-byte key
  if (key.length !== 32) {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(key).digest()
  }
  return Buffer.from(key)
}

export function encryptPassword(password: string): string {
  const crypto = require('crypto')
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(password, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const tag = cipher.getAuthTag()
  
  // Format: iv:tag:encrypted (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

export function decryptPassword(encryptedData: string): string {
  const crypto = require('crypto')
  const key = getEncryptionKey()
  
  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }
  
  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
