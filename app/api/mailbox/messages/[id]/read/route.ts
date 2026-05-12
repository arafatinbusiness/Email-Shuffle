import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'

// POST /api/mailbox/messages/[id]/read - Mark message as read
export async function POST(
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
    const messageId = parseInt(id)

    await sql`
      UPDATE email_messages SET is_read = true
      WHERE id = ${messageId} AND user_id = ${userId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to mark message as read:', error)
    return NextResponse.json({ error: 'Failed to mark message as read' }, { status: 500 })
  }
}
