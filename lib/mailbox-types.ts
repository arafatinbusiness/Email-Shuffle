// Mailbox types - separate module, not coupled to lead workflow

export interface MailboxAccount {
  id: number
  user_id: number
  email: string
  imap_host: string
  imap_port: number
  smtp_host: string
  smtp_port: number
  encrypted_password: string
  sync_enabled: boolean
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export interface EmailThread {
  id: number
  lead_id: number | null
  user_id: number
  subject: string
  last_message_at: string
  created_at: string
}

export type EmailDirection = 'incoming' | 'outgoing'
export type SyncState = 'synced' | 'pending' | 'failed'

export interface EmailMessage {
  id: number
  thread_id: number
  user_id: number
  direction: EmailDirection
  subject: string
  body: string
  body_html: string | null
  sender: string
  recipient: string
  message_id: string
  in_reply_to: string | null
  refs: string | null
  is_read: boolean
  sent_at: string
  sync_state: SyncState
  created_at: string
}

// For creating a new mailbox account (no password exposed)
export interface MailboxAccountInput {
  email: string
  imap_host: string
  imap_port: number
  smtp_host: string
  smtp_port: number
  password: string
  sync_enabled: boolean
}

// For sending email
export interface SendEmailInput {
  to: string
  subject: string
  body: string
  thread_id?: number
  in_reply_to?: string
  references?: string
}

// For the UI
export interface ThreadWithMessages {
  thread: EmailThread
  messages: EmailMessage[]
  lead_name?: string
  lead_email?: string
}

export const DEFAULT_IMAP_PORT = 993
export const DEFAULT_SMTP_PORT = 465
export const SPACEMAIL_IMAP_HOST = 'imap.spacemail.com'
export const SPACEMAIL_SMTP_HOST = 'smtp.spacemail.com'
