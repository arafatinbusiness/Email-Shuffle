import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('group_id')
    const importBatchId = searchParams.get('import_batch_id')
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')

    let query = sql`
      SELECT l.*, lg.name as group_name
      FROM leads l
      LEFT JOIN lead_groups lg ON lg.id = l.group_id
      WHERE l.user_id = ${userId}
    `

    if (groupId) {
      if (groupId === 'null') {
        query = sql`${query} AND l.group_id IS NULL`
      } else {
        query = sql`${query} AND l.group_id = ${parseInt(groupId)}`
      }
    }

    if (importBatchId) {
      query = sql`${query} AND l.import_batch_id = ${importBatchId}`
    }

    if (search) {
      query = sql`${query} AND (
        LOWER(l.first_name) LIKE LOWER(${'%' + search + '%'}) OR
        LOWER(l.last_name) LIKE LOWER(${'%' + search + '%'}) OR
        LOWER(l.email) LIKE LOWER(${'%' + search + '%'}) OR
        LOWER(l.company_name) LIKE LOWER(${'%' + search + '%'})
      )`
    }

    query = sql`${query} ORDER BY 
      CASE 
        WHEN l.priority = 'high' THEN 0
        WHEN l.priority = 'medium' THEN 1
        WHEN l.priority = 'low' THEN 2
        ELSE 3
      END,
      CASE 
        WHEN l.next_follow_up IS NOT NULL AND l.next_follow_up <= CURRENT_DATE THEN 0
        WHEN l.next_follow_up IS NOT NULL THEN 1
        ELSE 2
      END,
      l.next_follow_up ASC NULLS LAST,
      l.updated_at DESC
    `

    if (limit) {
      query = sql`${query} LIMIT ${parseInt(limit)}`
    }

    const leads = await query
    return NextResponse.json(leads)
  } catch (error) {
    console.error('Failed to fetch leads:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
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
    const {
      first_name,
      last_name,
      email,
      company_name,
      website,
      status = 'cold',
      current_layer = 'L1',
      lead_type = 'lead',
      priority,
      intent,
      positive_points,
      improvements,
      fb_ads_notes,
      pixel_status,
      custom_notes,
      next_follow_up
    } = body

    const result = await sql`
      INSERT INTO leads (
        user_id, first_name, last_name, email, company_name, website,
        status, current_layer, lead_type, priority, intent, positive_points, improvements,
        fb_ads_notes, pixel_status, custom_notes, next_follow_up
      ) VALUES (
        ${userId}, ${first_name}, ${last_name || null}, ${email}, ${company_name || null}, ${website || null},
        ${status}, ${current_layer}, ${lead_type}, ${priority || null}, ${intent || null}, ${positive_points || null}, ${improvements || null},
        ${fb_ads_notes || null}, ${pixel_status || null}, ${custom_notes || null}, ${next_follow_up || null}
      )
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create lead:', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
