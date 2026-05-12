// Mailbox service - SMTP sending and IMAP sync
// Uses nodemailer for SMTP and imapflow for IMAP
// This runs server-side only (API routes)

import nodemailer from 'nodemailer'
import { ImapFlow, SearchObject } from 'imapflow'
import { simpleParser } from 'mailparser'
import { decryptPassword } from './mailbox-crypto'
import { getDb } from './db'

interface MailboxConfig {
  email: string
  imap_host: string
  imap_port: number
  smtp_host: string
  smtp_port: number
  password: string
  send_as?: string | null
}

// ============================================================
// SMTP SENDING
// ============================================================

export async function sendEmail(
  config: MailboxConfig,
  to: string,
  subject: string,
  body: string,
  inReplyTo?: string,
  references?: string,
  fromOverride?: string
): Promise<{ messageId: string; accepted: string[] }> {
  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port,
    secure: config.smtp_port === 465,
    auth: {
      user: config.email,
      pass: config.password,
    },
  })

  const headers: Record<string, string> = {}

  if (inReplyTo) {
    headers['In-Reply-To'] = inReplyTo
    headers['References'] = references || inReplyTo
  }

  // Use fromOverride if provided, otherwise send_as alias, otherwise account email
  const fromAddress = fromOverride || config.send_as || config.email

  // Use the alias/override as the From address so recipients see the correct sender
  // The SMTP auth still uses the main account credentials
  const fromName = fromAddress.split('@')[0]

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    text: body,
    headers,
  })

  const messageId = info.messageId || `<${Date.now()}-${Math.random().toString(36).substr(2, 9)}@${config.email.split('@')[1] || 'local'}>`

  // Save a copy to the IMAP Sent folder so it appears in the email provider's webmail
  try {
    const client = new ImapFlow({
      host: config.imap_host,
      port: config.imap_port,
      secure: config.imap_port === 993,
      auth: {
        user: config.email,
        pass: config.password,
      },
      logger: false,
    })
    await client.connect()

    // Build the raw email to append to Sent folder
    const rawEmail = buildSentEmail(fromAddress, to, subject, body, messageId, inReplyTo, references)

    // First, list all folders to find the Sent folder
    const mailboxes = await client.list()
    const sentFolderNames = ['Sent', 'Sent Messages', 'Sent Items', 'INBOX.Sent', '[Gmail]/Sent Mail', 'Sent Mail', 'INBOX/Sent', 'INBOX.Sent Messages']
    
    // Try to find a Sent folder by listing all mailboxes first
    let sentFolderPath: string | null = null
    
    // Check if any mailbox name contains "sent" (case-insensitive)
    for (const mb of mailboxes) {
      const path = mb.path
      if (path && /sent/i.test(path) && !/trash|spam|junk|draft/i.test(path)) {
        sentFolderPath = path
        break
      }
    }

    // If not found by listing, try common names
    if (!sentFolderPath) {
      for (const folderName of sentFolderNames) {
        try {
          await client.mailboxOpen(folderName)
          sentFolderPath = folderName
          break
        } catch {
          continue
        }
      }
    }

    if (sentFolderPath) {
      // Append the email directly to the Sent folder with \Seen and \Sent flags
      // append(path, content, flags?, date?)
      await client.append(sentFolderPath, rawEmail, ['\\Seen', '\\Sent'], new Date())
    } else {
      console.warn('Could not find Sent folder to save copy. Available folders:', mailboxes.map(m => m.path).join(', '))
    }
    await client.logout()
  } catch (err) {
    // Non-critical: log but don't fail the send
    console.error('Failed to save copy to Sent folder:', err)
  }

  return {
    messageId,
    accepted: Array.isArray(info.accepted) ? info.accepted.map(a => String(a)) : [],
  }
}

// Build a raw RFC 2822 email for appending to the Sent folder
function buildSentEmail(
  from: string,
  to: string,
  subject: string,
  body: string,
  messageId: string,
  inReplyTo?: string,
  references?: string
): string {
  const date = new Date().toUTCString()
  let raw = `Date: ${date}\r\nFrom: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nMessage-ID: ${messageId}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: 7bit\r\n`

  if (inReplyTo) {
    raw += `In-Reply-To: ${inReplyTo}\r\n`
    raw += `References: ${references || inReplyTo}\r\n`
  }

  raw += '\r\n' + body
  return raw
}

// ============================================================
// IMAP SYNC
// ============================================================

export interface SyncedEmail {
  messageId: string
  inReplyTo: string | null
  references: string | null
  subject: string
  body: string
  bodyHtml: string | null
  sender: string
  recipient: string
  sentAt: Date
  isRead: boolean
  uid: number
}

export async function syncInbox(
  config: MailboxConfig,
  sinceUid?: number
): Promise<{ emails: SyncedEmail[]; lastUid: number }> {
  const client = new ImapFlow({
    host: config.imap_host,
    port: config.imap_port,
    secure: config.imap_port === 993,
    auth: {
      user: config.email,
      pass: config.password,
    },
    logger: false,
  })

  await client.connect()

  try {
    await client.mailboxOpen('INBOX')
    let lastUid = sinceUid || 0

    const messages: SyncedEmail[] = []
    
    // Build search criteria
    // On first sync (sinceUid=0 or undefined), fetch all emails. On subsequent syncs, fetch only new ones.
    // uid expects a SequenceString like "1:*" or "5:*" (not an object with gt)
    const currentSinceUid = sinceUid || 0
    const uidRange: string = currentSinceUid > 0
      ? `${currentSinceUid + 1}:*`
      : '1:*'
    const searchCriteria: SearchObject = { uid: uidRange }
    
    for await (const msg of client.fetch(searchCriteria, {
      uid: true,
      envelope: true,
      bodyStructure: true,
      source: true,
      flags: true,
      internalDate: true,
    })) {
      const uid = msg.uid
      if (uid > lastUid) lastUid = uid

      const source = msg.source
      if (!source) continue

      const parsed = await simpleParser(source)
      
      const messageId = parsed.messageId || `<${uid}-${Date.now()}@local>`
      const inReplyTo = parsed.inReplyTo || null
      const references = parsed.references || null
      const subject = parsed.subject || '(No Subject)'
      // Use parsed.text if available and meaningful, otherwise strip HTML from bodyHtml
      let body = parsed.text || ''
      const bodyHtml = parsed.html || null
      // If text body is empty or looks like garbled tracking content (no real words), use stripped HTML
      if ((!body || body.length < 20 || !/[a-zA-Z]{3,}/.test(body)) && bodyHtml) {
        body = bodyHtml.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
        // Limit stripped HTML to 500 chars to avoid huge bodies
        if (body.length > 500) body = body.substring(0, 500) + '...'
      }
      // Extract sender as "Name <email>" format for proper reply routing
      const senderRaw = parsed.from ? parsed.from.text : config.email
      const sender = parsed.from && parsed.from.value && parsed.from.value[0]
        ? (parsed.from.value[0].name 
          ? `${parsed.from.value[0].name} <${parsed.from.value[0].address}>`
          : parsed.from.value[0].address || senderRaw)
        : senderRaw
      const recipient = parsed.to ? parsed.to.text : config.email
      const sentAt = parsed.date || new Date()
      const isRead = msg.flags ? msg.flags.has('\\Seen') : false

      messages.push({
        messageId,
        inReplyTo,
        references,
        subject,
        body,
        bodyHtml,
        sender,
        recipient,
        sentAt,
        isRead,
        uid,
      })
    }

    return { emails: messages, lastUid }
  } finally {
    await client.logout()
  }
}

// ============================================================
// THREAD MANAGEMENT
// ============================================================

export async function findOrCreateThread(
  userId: number,
  subject: string,
  leadId: number | null,
  inReplyTo: string | null,
  references: string | null
): Promise<number> {
  const sql = getDb()

  // Try to find existing thread by in-reply-to chain
  if (inReplyTo) {
    const existing = await sql`
      SELECT em.thread_id FROM email_messages em
      WHERE em.message_id = ${inReplyTo}
      AND em.user_id = ${userId}
      LIMIT 1
    `
    if (existing.length > 0) {
      return existing[0].thread_id
    }
  }

  // Try to find thread by subject (normalized) and lead
  if (leadId) {
    const normalizedSubject = subject.replace(/^(Re:\s*|Fwd:\s*|Aw:\s*)/i, '').trim()
    const existingThread = await sql`
      SELECT id FROM email_threads
      WHERE lead_id = ${leadId}
      AND user_id = ${userId}
      AND subject ILIKE ${'%' + normalizedSubject + '%'}
      ORDER BY last_message_at DESC
      LIMIT 1
    `
    if (existingThread.length > 0) {
      return existingThread[0].id
    }
  }

  // Create new thread
  const result = await sql`
    INSERT INTO email_threads (lead_id, user_id, subject, last_message_at)
    VALUES (${leadId}, ${userId}, ${subject}, NOW())
    RETURNING id
  `
  return result[0].id
}

// ============================================================
// SAVE EMAIL TO DATABASE
// ============================================================

export async function saveEmailToDb(
  userId: number,
  threadId: number,
  direction: 'incoming' | 'outgoing',
  subject: string,
  body: string,
  bodyHtml: string | null,
  sender: string,
  recipient: string,
  messageId: string,
  inReplyTo: string | null,
  references: string | null,
  isRead: boolean,
  sentAt: Date,
  syncState: 'synced' | 'pending' | 'failed' = 'synced'
): Promise<number> {
  const sql = getDb()

  // Check for duplicate by message_id
  const existing = await sql`
    SELECT id FROM email_messages
    WHERE message_id = ${messageId} AND user_id = ${userId}
    LIMIT 1
  `
  if (existing.length > 0) {
    return existing[0].id
  }

  const result = await sql`
    INSERT INTO email_messages (
      thread_id, user_id, direction, subject, body, body_html,
      sender, recipient, message_id, in_reply_to, refs,
      is_read, sent_at, sync_state
    ) VALUES (
      ${threadId}, ${userId}, ${direction}, ${subject}, ${body}, ${bodyHtml},
      ${sender}, ${recipient}, ${messageId}, ${inReplyTo}, ${references},
      ${isRead}, ${sentAt.toISOString()}, ${syncState}
    )
    RETURNING id
  `

  // Update thread's last_message_at
  await sql`
    UPDATE email_threads SET last_message_at = NOW()
    WHERE id = ${threadId}
  `

  return result[0].id
}

// ============================================================
// GET MAILBOX ACCOUNT FOR USER
// ============================================================

export async function getMailboxConfig(userId: number): Promise<MailboxConfig | null> {
  const sql = getDb()
  const accounts = await sql`
    SELECT * FROM mailbox_accounts
    WHERE user_id = ${userId} AND sync_enabled = true
    LIMIT 1
  `
  if (accounts.length === 0) return null

  const account = accounts[0]
  const password = decryptPassword(account.encrypted_password)

  return {
    email: account.email,
    imap_host: account.imap_host,
    imap_port: account.imap_port,
    smtp_host: account.smtp_host,
    smtp_port: account.smtp_port,
    password,
    send_as: account.send_as || null,
  }
}

// ============================================================
// UPDATE LEAD STATUS ON REPLY
// ============================================================

export async function updateLeadOnReply(leadId: number): Promise<void> {
  const sql = getDb()
  await sql`
    UPDATE leads
    SET status = 'replied', updated_at = NOW()
    WHERE id = ${leadId} AND status != 'converted' AND status != 'dead'
  `
}
