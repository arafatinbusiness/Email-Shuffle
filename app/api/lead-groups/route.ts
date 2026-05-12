import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const groups = await sql`
      SELECT lg.*, COUNT(l.id)::int as lead_count
      FROM lead_groups lg
      LEFT JOIN leads l ON l.group_id = lg.id AND l.user_id = ${userId}
      WHERE lg.user_id = ${userId}
      GROUP BY lg.id
      ORDER BY lg.name ASC
    `
    return NextResponse.json(groups)
  } catch (error) {
    console.error('Failed to fetch groups:', error)
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const body = await request.json()
    const { name, description } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO lead_groups (user_id, name, description)
      VALUES (${userId}, ${name.trim()}, ${description || null})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A group with this name already exists' }, { status: 409 })
    }
    console.error('Failed to create group:', error)
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const body = await request.json()
    const { id, name, description } = body

    if (!id) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
    }

    const result = await sql`
      UPDATE lead_groups
      SET name = ${name || 'Unnamed Group'}, description = ${description || null}, updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update group:', error)
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
    }

    // Remove group reference from leads first
    await sql`
      UPDATE leads SET group_id = NULL WHERE group_id = ${parseInt(id)} AND user_id = ${userId}
    `

    const result = await sql`
      DELETE FROM lead_groups WHERE id = ${parseInt(id)} AND user_id = ${userId}
      RETURNING id
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete group:', error)
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
  }
}
