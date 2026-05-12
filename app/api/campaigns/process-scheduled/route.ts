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

        let sentCount = 0
        let failedCount = 0

        for (const recipient of recipients) {
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

        await sql`
          UPDATE email_campaigns
          SET sent_count = sent_count + ${sentCount}, failed_count = failed_count + ${failedCount},
              status = 'completed'
          WHERE id = ${campaign.id}
        `

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
