import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auth } from '@/lib/auth'

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
    const emails = await sql`
      SELECT eh.* FROM email_history eh
      JOIN leads l ON l.id = eh.lead_id
      WHERE eh.lead_id = ${parseInt(id)} AND l.user_id = ${userId}
      ORDER BY eh.generated_at DESC
    `
    return NextResponse.json(emails)
  } catch (error) {
    console.error('Failed to fetch email history:', error)
    return NextResponse.json({ error: 'Failed to fetch email history' }, { status: 500 })
  }
}

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
    const body = await request.json()
    const { layer, subject, body: emailBody } = body

    // Verify the lead belongs to the user
    const lead = await sql`
      SELECT id FROM leads WHERE id = ${parseInt(id)} AND user_id = ${userId}
    `
    if (lead.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO email_history (lead_id, user_id, layer, subject, body)
      VALUES (${parseInt(id)}, ${userId}, ${layer}, ${subject}, ${emailBody})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to save email:', error)
    return NextResponse.json({ error: 'Failed to save email' }, { status: 500 })
  }
}
