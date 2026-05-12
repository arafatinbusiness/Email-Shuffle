import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'

// GET /api/mailbox/threads - Get all email threads for the user
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('lead_id')
    const unreadOnly = searchParams.get('unread') === 'true'

    let query = sql`
      SELECT 
        t.id,
        t.lead_id,
        t.subject,
        t.last_message_at,
        t.created_at,
        l.first_name as lead_first_name,
        l.last_name as lead_last_name,
        l.email as lead_email,
        (SELECT COUNT(*) FROM email_messages m WHERE m.thread_id = t.id) as message_count,
        (SELECT COUNT(*) FROM email_messages m WHERE m.thread_id = t.id AND m.direction = 'incoming' AND m.is_read = false) as unread_count,
        (SELECT m.subject FROM email_messages m WHERE m.thread_id = t.id ORDER BY m.sent_at DESC LIMIT 1) as last_subject,
        (SELECT LEFT(REGEXP_REPLACE(m.body, E'[\\n\\r]+', ' ', 'g'), 100) FROM email_messages m WHERE m.thread_id = t.id ORDER BY m.sent_at DESC LIMIT 1) as last_preview,
        (SELECT m.sender FROM email_messages m WHERE m.thread_id = t.id ORDER BY m.sent_at DESC LIMIT 1) as last_sender
      FROM email_threads t
      LEFT JOIN leads l ON l.id = t.lead_id
      WHERE t.user_id = ${userId}
    `

    if (leadId) {
      query = sql`
        ${query} AND t.lead_id = ${parseInt(leadId)}
      `
    }

    if (unreadOnly) {
      query = sql`
        ${query} AND (
          SELECT COUNT(*) FROM email_messages m 
          WHERE m.thread_id = t.id AND m.direction = 'incoming' AND m.is_read = false
        ) > 0
      `
    }

    query = sql`
      ${query} ORDER BY t.last_message_at DESC
    `

    const threads = await query
    return NextResponse.json(threads)
  } catch (error) {
    console.error('Failed to fetch threads:', error)
    return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 })
  }
}
