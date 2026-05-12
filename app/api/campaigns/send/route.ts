import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getMailboxConfig, sendEmail, saveEmailToDb } from '@/lib/mailbox-service'

// POST /api/campaigns/send - Start sending a campaign
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

    // Get campaign
    const campaigns = await sql`
      SELECT * FROM email_campaigns
      WHERE id = ${campaign_id} AND user_id = ${userId}
    `
    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const campaign = campaigns[0]

    // Get mailbox config
    const config = await getMailboxConfig(userId)
    if (!config) {
      return NextResponse.json({ error: 'No mailbox configured. Please set up your email account first.' }, { status: 400 })
    }

    // Update campaign status to sending
    await sql`
      UPDATE email_campaigns SET status = 'sending' WHERE id = ${campaign_id}
    `

    // Get pending recipients
    const recipients = await sql`
      SELECT cr.*, l.first_name, l.last_name, l.company_name
      FROM campaign_recipients cr
      JOIN leads l ON l.id = cr.lead_id
      WHERE cr.campaign_id = ${campaign_id} AND cr.status = 'pending'
      ORDER BY cr.id
    `

    if (recipients.length === 0) {
      await sql`
        UPDATE email_campaigns SET status = 'completed' WHERE id = ${campaign_id}
      `
      return NextResponse.json({ message: 'No pending recipients', campaign })
    }

    const senderEmail = config.send_as || config.email

    // Process sending based on send_type
    if (campaign.send_type === 'instant') {
      // Send all immediately
      let sentCount = 0
      let failedCount = 0

      for (const recipient of recipients) {
        try {
          // Personalize the email
          const personalizedSubject = personalizeText(campaign.subject, recipient)
          const personalizedBody = personalizeText(campaign.body, recipient)

          const result = await sendEmail(
            config,
            recipient.email,
            personalizedSubject,
            personalizedBody,
            undefined,
            undefined,
            senderEmail
          )

          // Update recipient status
          await sql`
            UPDATE campaign_recipients
            SET status = 'sent', sent_at = NOW(), message_id = ${result.messageId}
            WHERE id = ${recipient.id}
          `

          // Create a thread for this campaign email
          const threadResult = await sql`
            INSERT INTO email_threads (user_id, subject, last_activity_at)
            VALUES (${userId}, ${personalizedSubject}, NOW())
            RETURNING id
          `
          const threadId = threadResult[0].id

          // Save to email history
          await saveEmailToDb(
            userId,
            threadId,
            'outgoing',
            personalizedSubject,
            personalizedBody,
            null,
            senderEmail,
            recipient.email,
            result.messageId,
            null,
            null,
            true,
            new Date(),
            'synced'
          )

          // Update lead's last_email_sent
          await sql`
            UPDATE leads SET last_email_sent = NOW(), status = CASE WHEN status = 'cold' THEN 'contacted' ELSE status END
            WHERE id = ${recipient.lead_id}
          `

          sentCount++
        } catch (error: any) {
          console.error(`Failed to send to ${recipient.email}:`, error)
          await sql`
            UPDATE campaign_recipients
            SET status = 'failed', error_message = ${error.message}
            WHERE id = ${recipient.id}
          `
          failedCount++
        }
      }

      // Update campaign
      await sql`
        UPDATE email_campaigns
        SET sent_count = sent_count + ${sentCount}, failed_count = failed_count + ${failedCount},
            status = CASE WHEN ${failedCount} > 0 AND ${sentCount} = 0 THEN 'failed' ELSE 'completed' END
        WHERE id = ${campaign_id}
      `

      return NextResponse.json({
        success: true,
        sent: sentCount,
        failed: failedCount,
        total: recipients.length,
      })
    } else {
      // For scheduled or random_gap, start the async sending process
      await sql`
        UPDATE email_campaigns SET status = 'scheduled' WHERE id = ${campaign_id}
      `

      // Start async processing in the background
      processScheduledCampaign(campaign_id, userId).catch(err => {
        console.error('Background campaign processing failed:', err)
      })

      return NextResponse.json({
        success: true,
        message: `Campaign scheduled with ${recipients.length} recipients. Emails will be sent with ${campaign.gap_minutes} minute gap.`,
        campaign,
      })
    }
  } catch (error) {
    console.error('Failed to send campaign:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to send campaign'
    }, { status: 500 })
  }
}

// Personalize text with recipient data
function personalizeText(text: string, recipient: any): string {
  return text
    .replace(/{{first_name}}/gi, recipient.first_name || 'there')
    .replace(/{{last_name}}/gi, recipient.last_name || '')
    .replace(/{{full_name}}/gi, [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || 'there')
    .replace(/{{email}}/gi, recipient.email)
    .replace(/{{company}}/gi, recipient.company_name || 'your company')
    .replace(/{{company_name}}/gi, recipient.company_name || 'your company')
}

// Background processor for scheduled/random_gap campaigns
async function processScheduledCampaign(campaignId: number, userId: number) {
  const sql = getDb()

  try {
    const campaigns = await sql`
      SELECT * FROM email_campaigns WHERE id = ${campaignId} AND user_id = ${userId}
    `
    if (campaigns.length === 0) return
    const campaign = campaigns[0]

    const config = await getMailboxConfig(userId)
    if (!config) {
      await sql`UPDATE email_campaigns SET status = 'failed' WHERE id = ${campaignId}`
      return
    }

    const senderEmail = config.send_as || config.email

    // Get pending recipients ordered by ID
    const recipients = await sql`
      SELECT cr.*, l.first_name, l.last_name, l.company_name
      FROM campaign_recipients cr
      JOIN leads l ON l.id = cr.lead_id
      WHERE cr.campaign_id = ${campaignId} AND cr.status = 'pending'
      ORDER BY cr.id
    `

    let sentCount = 0
    let failedCount = 0

    for (let i = 0; i < recipients.length; i++) {
      // Check if campaign was paused or cancelled
      const currentCampaign = await sql`
        SELECT status FROM email_campaigns WHERE id = ${campaignId}
      `
      if (currentCampaign.length === 0) return
      if (currentCampaign[0].status === 'paused' || currentCampaign[0].status === 'cancelled') {
        break
      }

      const recipient = recipients[i]

      try {
        const personalizedSubject = personalizeText(campaign.subject, recipient)
        const personalizedBody = personalizeText(campaign.body, recipient)

        const result = await sendEmail(
          config,
          recipient.email,
          personalizedSubject,
          personalizedBody,
          undefined,
          undefined,
          senderEmail
        )

        // Create a thread for this campaign email
        const threadResult = await sql`
          INSERT INTO email_threads (user_id, subject, last_activity_at)
          VALUES (${userId}, ${personalizedSubject}, NOW())
          RETURNING id
        `
        const threadId = threadResult[0].id

        await sql`
          UPDATE campaign_recipients
          SET status = 'sent', sent_at = NOW(), message_id = ${result.messageId}
          WHERE id = ${recipient.id}
        `

        await saveEmailToDb(
          userId,
          threadId,
          'outgoing',
          personalizedSubject,
          personalizedBody,
          null,
          senderEmail,
          recipient.email,
          result.messageId,
          null,
          null,
          true,
          new Date(),
          'synced'
        )

        await sql`
          UPDATE leads SET last_email_sent = NOW(), status = CASE WHEN status = 'cold' THEN 'contacted' ELSE status END
          WHERE id = ${recipient.lead_id}
        `

        sentCount++
      } catch (error: any) {
        console.error(`Failed to send to ${recipient.email}:`, error)
        await sql`
          UPDATE campaign_recipients
          SET status = 'failed', error_message = ${error.message}
          WHERE id = ${recipient.id}
        `
        failedCount++
      }

      // Update campaign progress
      await sql`
        UPDATE email_campaigns
        SET sent_count = sent_count + 1
        WHERE id = ${campaignId}
      `

      // Wait for gap if not the last email
      if (i < recipients.length - 1 && campaign.gap_minutes > 0) {
        await new Promise(resolve => setTimeout(resolve, campaign.gap_minutes * 60 * 1000))
      }
    }

    // Mark campaign as completed
    await sql`
      UPDATE email_campaigns
      SET status = 'completed', sent_count = ${sentCount}, failed_count = ${failedCount}
      WHERE id = ${campaignId}
    `
  } catch (error) {
    console.error('Campaign processing error:', error)
    await sql`
      UPDATE email_campaigns SET status = 'failed' WHERE id = ${campaignId}
    `
  }
}
