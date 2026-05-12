import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auth } from '@/lib/auth'

// GET /api/import-columns - Get the last imported columns for the user
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const result = await sql`
      SELECT columns FROM import_columns
      WHERE user_id = ${userId}
      ORDER BY imported_at DESC
      LIMIT 1
    `
    return NextResponse.json(result[0]?.columns || [])
  } catch (error) {
    console.error('Failed to fetch import columns:', error)
    return NextResponse.json({ error: 'Failed to fetch import columns' }, { status: 500 })
  }
}

// POST /api/import-columns - Save imported columns
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const body = await request.json()
    const { columns } = body

    if (!Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json({ error: 'Columns must be a non-empty array' }, { status: 400 })
    }

    await sql`
      INSERT INTO import_columns (user_id, columns)
      VALUES (${userId}, ${JSON.stringify(columns)})
    `
    return NextResponse.json({ success: true, columns })
  } catch (error) {
    console.error('Failed to save import columns:', error)
    return NextResponse.json({ error: 'Failed to save import columns' }, { status: 500 })
  }
}
