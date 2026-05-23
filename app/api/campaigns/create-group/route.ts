import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auth } from '@/lib/auth'

// POST /api/campaigns/create-group - Create a lead group from campaign recipients
// Optionally filter to only include leads who haven't replied
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const body = await request.json()
    const { campaign_id, group_name, only_non_reply = true } = body

    if (!campaign_id) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 })
    }

    // Verify campaign belongs to user
    const campaigns = await sql`
      SELECT * FROM email_campaigns
      WHERE id = ${campaign_id} AND user_id = ${userId}
    `
    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const campaign = campaigns[0]

    // Get recipients from this campaign
    let recipients
    if (only_non_reply) {
      // Only include leads who have NOT replied (status is not 'replied')
      recipients = await sql`
        SELECT cr.lead_id, l.first_name, l.last_name, l.email, l.status
        FROM campaign_recipients cr
        JOIN leads l ON l.id = cr.lead_id
        WHERE cr.campaign_id = ${campaign_id}
          AND l.user_id = ${userId}
          AND (l.status IS DISTINCT FROM 'replied')
          AND (l.status IS DISTINCT FROM 'converted')
          AND (l.status IS DISTINCT FROM 'dead')
      `
    } else {
      // Include all recipients
      recipients = await sql`
        SELECT cr.lead_id, l.first_name, l.last_name, l.email, l.status
        FROM campaign_recipients cr
        JOIN leads l ON l.id = cr.lead_id
        WHERE cr.campaign_id = ${campaign_id}
          AND l.user_id = ${userId}
      `
    }

    if (recipients.length === 0) {
      return NextResponse.json({
        error: only_non_reply
          ? 'All leads in this campaign have already replied or been converted. No leads to add to group.'
          : 'No leads found in this campaign.',
      }, { status: 400 })
    }

    // Generate a group name if not provided
    const finalGroupName = group_name || `${campaign.name} - Follow-up (${recipients.length} leads)`

    // Create the group
    const groupResult = await sql`
      INSERT INTO lead_groups (user_id, name, description)
      VALUES (${userId}, ${finalGroupName}, ${`Auto-created from campaign "${campaign.name}" (ID: ${campaign_id})`})
      RETURNING *
    `

    const groupId = groupResult[0].id

    // Assign all these leads to the new group
    const leadIds = recipients.map(r => r.lead_id)
    await sql`
      UPDATE leads
      SET group_id = ${groupId}
      WHERE id = ANY(${leadIds}::int[]) AND user_id = ${userId}
    `

    return NextResponse.json({
      success: true,
      group: groupResult[0],
      lead_count: recipients.length,
      message: `Group "${finalGroupName}" created with ${recipients.length} leads`,
    })
  } catch (error) {
    console.error('Failed to create group from campaign:', error)
    return NextResponse.json({ error: 'Failed to create group from campaign' }, { status: 500 })
  }
}
