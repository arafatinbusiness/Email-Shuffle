import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auth } from '@/lib/auth'

// POST /api/campaigns/clone - Clone a campaign with all its recipients
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const body = await request.json()
    const { campaign_id } = body

    if (!campaign_id) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 })
    }

    // Get the original campaign
    const campaigns = await sql`
      SELECT * FROM email_campaigns
      WHERE id = ${campaign_id} AND user_id = ${userId}
    `
    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const original = campaigns[0]

    // Clone the campaign with a new name and draft status
    const newName = `${original.name} (Copy)`
    const newCampaign = await sql`
      INSERT INTO email_campaigns (
        user_id, name, subject, body, send_type, status,
        scheduled_at, gap_minutes, gap_min_max,
        business_hours_only, daily_cap,
        business_hours_start, business_hours_end,
        total_recipients, signature, layer, from_email, from_name
      ) VALUES (
        ${userId}, ${newName}, ${original.subject}, ${original.body},
        ${original.send_type}, 'draft',
        NULL, ${original.gap_minutes}, ${original.gap_min_max},
        ${original.business_hours_only}, ${original.daily_cap},
        ${original.business_hours_start}, ${original.business_hours_end},
        ${original.total_recipients}, ${original.signature || null},
        ${original.layer || 'campaign'}, ${original.from_email || null},
        ${original.from_name || null}
      )
      RETURNING *
    `


    const newCampaignId = newCampaign[0].id

    // Clone all recipients from the original campaign
    const recipients = await sql`
      SELECT lead_id, email, first_name, last_name, company_name, personalization_data
      FROM campaign_recipients
      WHERE campaign_id = ${campaign_id}
    `

    for (const recipient of recipients) {
      await sql`
        INSERT INTO campaign_recipients (campaign_id, lead_id, email, first_name, last_name, company_name, personalization_data)
        VALUES (${newCampaignId}, ${recipient.lead_id}, ${recipient.email}, ${recipient.first_name}, ${recipient.last_name}, ${recipient.company_name}, ${recipient.personalization_data})
      `
    }

    return NextResponse.json(newCampaign[0], { status: 201 })
  } catch (error) {
    console.error('Failed to clone campaign:', error)
    return NextResponse.json({ error: 'Failed to clone campaign' }, { status: 500 })
  }
}
