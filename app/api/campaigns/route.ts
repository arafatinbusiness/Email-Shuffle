import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auth } from '@/lib/auth'

// GET /api/campaigns - List all campaigns
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const campaigns = await sql`
      SELECT * FROM email_campaigns
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `
    return NextResponse.json(campaigns)
  } catch (error) {
    console.error('Failed to fetch campaigns:', error)
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }
}

// POST /api/campaigns - Create a new campaign
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
      name,
      subject,
      body: campaignBody,
      send_type = 'instant',
      scheduled_at,
      gap_minutes = 3,
      gap_min_max = 0,
      business_hours_only = false,
      daily_cap = 0,
      business_hours_start = '09:00',
      business_hours_end = '18:00',
      lead_ids = [],
      signature = '',
    } = body

    if (!name || !subject || !campaignBody) {
      return NextResponse.json({ error: 'Missing required fields: name, subject, body' }, { status: 400 })
    }

    if (lead_ids.length === 0) {
      return NextResponse.json({ error: 'At least one lead must be selected' }, { status: 400 })
    }

    // Start a transaction
    const campaign = await sql`
      INSERT INTO email_campaigns (user_id, name, subject, body, send_type, scheduled_at, gap_minutes, gap_min_max, business_hours_only, daily_cap, business_hours_start, business_hours_end, total_recipients, signature)
      VALUES (${userId}, ${name}, ${subject}, ${campaignBody}, ${send_type}, ${scheduled_at || null}, ${gap_minutes}, ${gap_min_max}, ${business_hours_only}, ${daily_cap}, ${business_hours_start}, ${business_hours_end}, ${lead_ids.length}, ${signature || null})
      RETURNING *
    `

    const campaignId = campaign[0].id

    // Get lead data for recipients
    const leads = await sql`
      SELECT id, email, first_name, last_name, company_name
      FROM leads
      WHERE id = ANY(${lead_ids}::int[]) AND user_id = ${userId}
    `

    // Insert recipients
    for (const lead of leads) {
      await sql`
        INSERT INTO campaign_recipients (campaign_id, lead_id, email, first_name, last_name, company_name)
        VALUES (${campaignId}, ${lead.id}, ${lead.email}, ${lead.first_name}, ${lead.last_name}, ${lead.company_name})
      `
    }

    return NextResponse.json(campaign[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create campaign:', error)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}

// PUT /api/campaigns - Update campaign status (pause, cancel, etc.)
export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const body = await request.json()
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'Campaign ID and status are required' }, { status: 400 })
    }

    const validStatuses = ['draft', 'scheduled', 'sending', 'completed', 'paused', 'cancelled', 'failed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const result = await sql`
      UPDATE email_campaigns
      SET status = ${status}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update campaign:', error)
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
  }
}

// DELETE /api/campaigns - Delete a campaign
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
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 })
    }

    const result = await sql`
      DELETE FROM email_campaigns
      WHERE id = ${parseInt(id)} AND user_id = ${userId}
      RETURNING id
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete campaign:', error)
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  }
}
