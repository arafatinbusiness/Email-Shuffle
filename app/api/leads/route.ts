import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const sql = getDb()
    const leads = await sql`
      SELECT * FROM leads 
      ORDER BY 
        CASE 
          WHEN next_follow_up IS NOT NULL AND next_follow_up <= CURRENT_DATE THEN 0
          WHEN next_follow_up IS NOT NULL THEN 1
          ELSE 2
        END,
        next_follow_up ASC NULLS LAST,
        updated_at DESC
    `
    return NextResponse.json(leads)
  } catch (error) {
    console.error('Failed to fetch leads:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sql = getDb()
    const body = await request.json()
    const {
      first_name,
      last_name,
      email,
      company_name,
      website,
      status = 'cold',
      current_layer = 'L1',
      positive_points,
      improvements,
      fb_ads_notes,
      pixel_status,
      custom_notes,
      next_follow_up
    } = body

    const result = await sql`
      INSERT INTO leads (
        first_name, last_name, email, company_name, website,
        status, current_layer, positive_points, improvements,
        fb_ads_notes, pixel_status, custom_notes, next_follow_up
      ) VALUES (
        ${first_name}, ${last_name || null}, ${email}, ${company_name || null}, ${website || null},
        ${status}, ${current_layer}, ${positive_points || null}, ${improvements || null},
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
