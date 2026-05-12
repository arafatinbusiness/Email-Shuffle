import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getMailboxConfig, sendEmail, findOrCreateThread, saveEmailToDb } from '@/lib/mailbox-service'
import { getDb } from '@/lib/db'

// POST /api/mailbox/send - Send an email via SMTP
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const userId = parseInt(session.user.id)
    const body = await request.json()
    const { to, subject, body: emailBody, thread_id, in_reply_to, references, lead_id, send_as } = body

    if (!to || !subject || !emailBody) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 })
    }

    // Get mailbox config
    const config = await getMailboxConfig(userId)
    if (!config) {
      return NextResponse.json({ error: 'No mailbox configured. Please set up your email account first.' }, { status: 400 })
    }

    // Determine sender email: request send_as > config send_as > config email
    const senderEmail = send_as || config.send_as || config.email

    // Append signature to email body
    const bodyWithSignature = config.signature
      ? emailBody + '\n\n' + config.signature
      : emailBody

    // Send via SMTP
    const result = await sendEmail(config, to, subject, bodyWithSignature, in_reply_to, references, senderEmail)

    // Find or create thread
    const threadId = thread_id || await findOrCreateThread(
      userId,
      subject,
      lead_id || null,
      in_reply_to || null,
      references || null
    )

    // Save to database
    await saveEmailToDb(
      userId,
      threadId,
      'outgoing',
      subject,
      emailBody,
      null,
      senderEmail,
      to,
      result.messageId,
      in_reply_to || null,
      references || null,
      true,
      new Date(),
      'synced'
    )

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      threadId,
    })
  } catch (error) {
    console.error('Failed to send email:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to send email'
    }, { status: 500 })
  }
}
