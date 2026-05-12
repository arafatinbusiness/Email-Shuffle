import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getMailboxConfig, sendEmail, saveEmailToDb } from '@/lib/mailbox-service'

// POST /api/campaigns/process-scheduled - Process scheduled campaigns (called by cron)
// This endpoint is designed to be called by a cron job (e.g., Vercel Cron, GitHub Actions, etc.)
export async function POST() {
  try {
    const sql = getDb()

    // Find campaigns that are scheduled and ready to send
    // Also include smart_spacing campaigns that are in 'scheduled' status
    const campaigns = await sql`
      SELECT * FROM email_campaigns
      WHERE status = 'scheduled'
        AND (
          (send_type = 'scheduled' AND scheduled_at <= NOW())
          OR
          (send_type = 'smart_spacing')
        )
      ORDER BY scheduled_at ASC NULLS LAST
      LIMIT 5
    `

    if (campaigns.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No campaigns ready to send' })
    }

    let processed = 0
    for (const campaign of campaigns) {
      try {
        const config = await getMailboxConfig(campaign.user_id)
        if (!config) {
          await sql`
            UPDATE email_campaigns SET status = 'failed' WHERE id = ${campaign.id}
          `
          continue
        }

        // Use campaign's from_email if set, otherwise fall back to mailbox send_as or main email
        const senderEmail = campaign.from_email || config.send_as || config.email

        // Get pending recipients
        const recipients = await sql`
          SELECT cr.*, l.first_name, l.last_name, l.company_name
          FROM campaign_recipients cr
          JOIN leads l ON l.id = cr.lead_id
          WHERE cr.campaign_id = ${campaign.id} AND cr.status = 'pending'
          ORDER BY cr.id
        `

        if (recipients.length === 0) {
          await sql`
            UPDATE email_campaigns SET status = 'completed' WHERE id = ${campaign.id}
          `
          continue
        }

        // Update status to sending
        await sql`
          UPDATE email_campaigns SET status = 'sending' WHERE id = ${campaign.id}
        `

        // Send only ONE recipient per polling cycle to enforce gaps naturally
        // The polling runs every 30s, so each cycle sends at most 1 email
        const recipient = recipients[0]
        let sentCount = 0
        let failedCount = 0

        // Check if campaign was paused or cancelled
        const currentCampaign = await sql`
          SELECT * FROM email_campaigns WHERE id = ${campaign.id}
        `
        if (currentCampaign.length === 0) continue
        const camp = currentCampaign[0]
        if (camp.status === 'paused' || camp.status === 'cancelled') {
          continue
        }

        // Check daily cap
        const capReached = await checkDailyCap(sql, campaign.id, camp)
        if (capReached) {
          console.log(`Daily cap reached for campaign ${campaign.id}. Stopping for now.`)
          // Don't mark as completed - will resume tomorrow
          continue
        }

        // Check business hours
        if (camp.business_hours_only && !isWithinBusinessHours(camp)) {
          console.log(`Outside business hours for campaign ${campaign.id}. Stopping for now.`)
          continue
        }

        try {
          const personalizedSubject = personalizeText(campaign.subject, recipient)
          const personalizedBody = personalizeText(campaign.body, recipient)
          const bodyWithSignature = appendSignature(personalizedBody, campaign.signature, config.signature || null)

          const result = await sendEmail(
            config,
            recipient.email,
            personalizedSubject,
            bodyWithSignature,
            undefined,
            undefined,
            senderEmail
          )

          // Create thread
          const threadResult = await sql`
            INSERT INTO email_threads (user_id, subject, last_message_at)
            VALUES (${campaign.user_id}, ${personalizedSubject}, NOW())
            RETURNING id
          `
          const threadId = threadResult[0].id

          await sql`
            UPDATE campaign_recipients
            SET status = 'sent', sent_at = NOW(), message_id = ${result.messageId}
            WHERE id = ${recipient.id}
          `

          await saveEmailToDb(
            campaign.user_id,
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

          // Update today's sent count for daily cap tracking
          if (camp.daily_cap && camp.daily_cap > 0) {
            await sql`
              UPDATE email_campaigns
              SET today_sent_count = today_sent_count + 1
              WHERE id = ${campaign.id}
            `
          }
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
          SET sent_count = sent_count + ${sentCount}, failed_count = failed_count + ${failedCount}
          WHERE id = ${campaign.id}
        `

        // Check if all recipients have been processed
        const remainingRecipients = await sql`
          SELECT COUNT(*) as count FROM campaign_recipients
          WHERE campaign_id = ${campaign.id} AND status = 'pending'
        `
        if (remainingRecipients[0].count === 0) {
          await sql`
            UPDATE email_campaigns SET status = 'completed' WHERE id = ${campaign.id}
          `
        }

        processed++
      } catch (error) {
        console.error(`Failed to process campaign ${campaign.id}:`, error)
        await sql`
          UPDATE email_campaigns SET status = 'failed' WHERE id = ${campaign.id}
        `
      }
    }

    return NextResponse.json({
      processed,
      message: `Processed ${processed} campaigns`,
    })
  } catch (error) {
    console.error('Failed to process scheduled campaigns:', error)
    return NextResponse.json({ error: 'Failed to process scheduled campaigns' }, { status: 500 })
  }
}

function personalizeText(text: string, recipient: any): string {
  return text
    .replace(/{{first_name}}/gi, recipient.first_name || 'there')
    .replace(/{{last_name}}/gi, recipient.last_name || '')
    .replace(/{{full_name}}/gi, [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || 'there')
    .replace(/{{email}}/gi, recipient.email)
    .replace(/{{company}}/gi, recipient.company_name || 'your company')
    .replace(/{{company_name}}/gi, recipient.company_name || 'your company')
}

// Append signature to email body
function appendSignature(body: string, campaignSignature: string | null, mailboxSignature: string | null): string {
  // Campaign signature takes priority over mailbox signature
  const sig = campaignSignature || mailboxSignature
  if (!sig) return body
  return body + '\n\n' + sig
}

// Calculate delay in milliseconds based on campaign settings
function calculateDelay(campaign: any): number {
  const baseGap = campaign.gap_minutes || 3
  const maxGap = campaign.gap_min_max || 0

  if (maxGap > baseGap) {
    // Random range: pick a random number between baseGap and maxGap
    const randomMinutes = baseGap + Math.random() * (maxGap - baseGap)
    return Math.round(randomMinutes * 60 * 1000)
  }

  // Fixed gap with small jitter (+/- 20%)
  const jitter = (Math.random() - 0.5) * 0.4 * baseGap // +/- 20%
  return Math.round((baseGap + jitter) * 60 * 1000)
}

// Check if current time is within business hours
function isWithinBusinessHours(campaign: any): boolean {
  if (!campaign.business_hours_only) return true

  const now = new Date()
  const dayOfWeek = now.getDay()
  
  // Skip weekends (0=Sunday, 6=Saturday)
  if (dayOfWeek === 0 || dayOfWeek === 6) return false

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  
  const startParts = (campaign.business_hours_start || '09:00').split(':')
  const endParts = (campaign.business_hours_end || '18:00').split(':')
  
  const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1] || '0')
  const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1] || '0')

  return currentMinutes >= startMinutes && currentMinutes < endMinutes
}

// Check if daily cap has been reached
async function checkDailyCap(sql: any, campaignId: number, campaign: any): Promise<boolean> {
  if (!campaign.daily_cap || campaign.daily_cap <= 0) return false

  const today = new Date().toISOString().split('T')[0]

  // If last_sent_date is not today, reset the counter
  if (campaign.last_sent_date !== today) {
    await sql`
      UPDATE email_campaigns
      SET last_sent_date = ${today}::date, today_sent_count = 0
      WHERE id = ${campaignId}
    `
    return false
  }

  return (campaign.today_sent_count || 0) >= campaign.daily_cap
}
