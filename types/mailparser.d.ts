declare module 'mailparser' {
  import { Stream } from 'stream'

  interface ParsedMail {
    messageId?: string
    inReplyTo?: string
    references?: string
    subject?: string
    text?: string
    html?: string | false
    from?: {
      text: string
      value: Array<{ address: string; name: string }>
    }
    to?: {
      text: string
      value: Array<{ address: string; name: string }>
    }
    date?: Date
    attachments?: Array<{
      filename?: string
      contentType: string
      content: Buffer
    }>
  }

  export function simpleParser(
    source: Buffer | string | Stream,
    options?: any
  ): Promise<ParsedMail>
}
