import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sql = getDb()
    const leads = await sql`SELECT * FROM leads WHERE id = ${parseInt(id)}`
    
    if (leads.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    
    return NextResponse.json(leads[0])
  } catch (error) {
    console.error('Failed to fetch lead:', error)
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sql = getDb()
    const body = await request.json()
    const {
      first_name,
      last_name,
      email,
      company_name,
      website,
      status,
      current_layer,
      positive_points,
      improvements,
      fb_ads_notes,
      pixel_status,
      custom_notes,
      last_email_sent,
      next_follow_up
    } = body

    const result = await sql`
      UPDATE leads SET
        first_name = ${first_name},
        last_name = ${last_name || null},
        email = ${email},
        company_name = ${company_name || null},
        website = ${website || null},
        status = ${status},
        current_layer = ${current_layer},
        positive_points = ${positive_points || null},
        improvements = ${improvements || null},
        fb_ads_notes = ${fb_ads_notes || null},
        pixel_status = ${pixel_status || null},
        custom_notes = ${custom_notes || null},
        last_email_sent = ${last_email_sent || null},
        next_follow_up = ${next_follow_up || null}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update lead:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sql = getDb()
    const result = await sql`DELETE FROM leads WHERE id = ${parseInt(id)} RETURNING id`
    
    if (result.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Lead deleted successfully' })
  } catch (error) {
    console.error('Failed to delete lead:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
