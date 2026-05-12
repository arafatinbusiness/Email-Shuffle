import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auth } from '@/lib/auth'

// Assign leads to a group
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const body = await request.json()
    const { lead_ids, group_id } = body

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return NextResponse.json({ error: 'lead_ids array is required' }, { status: 400 })
    }

    if (group_id) {
      // Assign to group
      await sql`
        UPDATE leads SET group_id = ${group_id}
        WHERE id = ANY(${lead_ids}::int[]) AND user_id = ${userId}
      `
    } else {
      // Remove from group
      await sql`
        UPDATE leads SET group_id = NULL
        WHERE id = ANY(${lead_ids}::int[]) AND user_id = ${userId}
      `
    }

    return NextResponse.json({ success: true, updated: lead_ids.length })
  } catch (error) {
    console.error('Failed to update lead groups:', error)
    return NextResponse.json({ error: 'Failed to update lead groups' }, { status: 500 })
  }
}
