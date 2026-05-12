import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getMailboxConfig, syncInbox, findOrCreateThread, saveEmailToDb, updateLeadOnReply } from '@/lib/mailbox-service'
import { getDb } from '@/lib/db'

// POST /api/mailbox/sync - Trigger IMAP inbox sync
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const userId = parseInt(session.user.id)
    const sql = getDb()

    // Check if we should clear existing data first
    const body = await request.json().catch(() => ({}))
    const clearFirst = body.clearFirst === true

    if (clearFirst) {
      // Delete all existing messages and threads for this user
      await sql`
        DELETE FROM email_messages WHERE user_id = ${userId}
      `
      await sql`
        DELETE FROM email_threads WHERE user_id = ${userId}
      `
    }

    // Get mailbox config
    const config = await getMailboxConfig(userId)
    if (!config) {
      return NextResponse.json({ error: 'No mailbox configured' }, { status: 400 })
    }

    // Get last synced UID from the mailbox_accounts table
    let lastUid = 0
    if (!clearFirst) {
      const accountResult = await sql`
        SELECT last_sync_uid FROM mailbox_accounts WHERE user_id = ${userId}
      `
      lastUid = accountResult[0]?.last_sync_uid || 0
    }

    // Sync inbox
    const { emails, lastUid: newLastUid } = await syncInbox(config, lastUid)

    let synced = 0
    let replies = 0

    for (const email of emails) {
      // Find which lead this email belongs to by matching sender email
      const senderEmail = email.sender.match(/<([^>]+)>/) 
        ? email.sender.match(/<([^>]+)>/)![1]
        : email.sender

      const lead = await sql`
        SELECT id FROM leads
        WHERE (email = ${senderEmail} OR email ILIKE ${'%' + senderEmail + '%'})
        AND user_id = ${userId}
        LIMIT 1
      `
      const leadId = lead.length > 0 ? lead[0].id : null

      // Find or create thread
      const threadId = await findOrCreateThread(
        userId,
        email.subject,
        leadId,
        email.inReplyTo,
        email.references
      )

      // Save email to database
      const savedId = await saveEmailToDb(
        userId,
        threadId,
        'incoming',
        email.subject,
        email.body,
        email.bodyHtml,
        email.sender,
        config.email,
        email.messageId,
        email.inReplyTo,
        email.references,
        email.isRead,
        email.sentAt,
        'synced'
      )

      if (savedId) {
        synced++
        // If this is a reply from a lead, update their status
        if (leadId) {
          await updateLeadOnReply(leadId)
          replies++
        }
      }
    }

    // Update last sync timestamp and UID
    await sql`
      UPDATE mailbox_accounts SET last_sync_at = NOW(), last_sync_uid = ${newLastUid} WHERE user_id = ${userId}
    `

    return NextResponse.json({
      success: true,
      synced,
      replies,
      lastUid: newLastUid,
    })
  } catch (error) {
    console.error('Failed to sync inbox:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to sync inbox'
    }, { status: 500 })
  }
}
