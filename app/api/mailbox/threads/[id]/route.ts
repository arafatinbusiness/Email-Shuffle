import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'

// GET /api/mailbox/threads/[id] - Get thread with all messages
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const threadId = parseInt(id)

    // Get thread
    const threads = await sql`
      SELECT 
        t.*,
        l.first_name as lead_first_name,
        l.last_name as lead_last_name,
        l.email as lead_email
      FROM email_threads t
      LEFT JOIN leads l ON l.id = t.lead_id
      WHERE t.id = ${threadId} AND t.user_id = ${userId}
    `

    if (threads.length === 0) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Get messages
    const messages = await sql`
      SELECT * FROM email_messages
      WHERE thread_id = ${threadId} AND user_id = ${userId}
      ORDER BY sent_at ASC
    `

    return NextResponse.json({
      thread: threads[0],
      messages,
    })
  } catch (error) {
    console.error('Failed to fetch thread:', error)
    return NextResponse.json({ error: 'Failed to fetch thread' }, { status: 500 })
  }
}
