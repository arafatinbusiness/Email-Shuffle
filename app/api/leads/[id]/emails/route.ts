import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sql = getDb()
    const emails = await sql`
      SELECT * FROM email_history 
      WHERE lead_id = ${parseInt(id)}
      ORDER BY generated_at DESC
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
  try {
    const { id } = await params
    const sql = getDb()
    const body = await request.json()
    const { layer, subject, body: emailBody } = body

    const result = await sql`
      INSERT INTO email_history (lead_id, layer, subject, body)
      VALUES (${parseInt(id)}, ${layer}, ${subject}, ${emailBody})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to save email:', error)
    return NextResponse.json({ error: 'Failed to save email' }, { status: 500 })
  }
}
