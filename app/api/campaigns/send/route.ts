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

    // Get pending recipients with all lead fields for personalization
    const recipients = await sql`
      SELECT cr.*, l.first_name, l.last_name, l.company_name, l.website,
             l.positive_points, l.improvements, l.video_link, l.image_link,
             l.fb_ads_notes, l.pixel_status, l.custom_notes, l.quick_question
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

    // Use campaign's from_email if set, otherwise fall back to mailbox send_as or main email
    const senderEmail = campaign.from_email || config.send_as || config.email

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
          const bodyWithSignature = appendSignature(personalizedBody, campaign.signature, config.signature || null)

          const result = await sendEmail(
            config,
            recipient.email,
            personalizedSubject,
            bodyWithSignature,
            undefined,
            undefined,
            senderEmail,
            campaign.from_name || undefined,
            true // plainTextOnly - send as plain text for campaign emails
          )

          // Update recipient status
          await sql`
            UPDATE campaign_recipients
            SET status = 'sent', sent_at = NOW(), message_id = ${result.messageId}
            WHERE id = ${recipient.id}
          `

          // Create a thread for this campaign email
          const threadResult = await sql`
            INSERT INTO email_threads (user_id, subject, last_message_at)
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

          // Save to email_history for lead-level tracking with campaign's layer
          const emailLayer = campaign.layer || 'campaign'
          await sql`
            INSERT INTO email_history (lead_id, user_id, layer, subject, body)
            VALUES (${recipient.lead_id}, ${userId}, ${emailLayer}, ${personalizedSubject}, ${bodyWithSignature})
          `


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
      // For scheduled or random_gap, set status to 'scheduled'
      // The cron job (POST /api/campaigns/process-scheduled) will pick it up
      // and send one email per cycle, naturally enforcing the gap
      await sql`
        UPDATE email_campaigns SET status = 'scheduled' WHERE id = ${campaign_id}
      `

      return NextResponse.json({
        success: true,
        message: `Campaign scheduled with ${recipients.length} recipients. Emails will be sent with smart spacing via cron.`,
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
  let result = text
    .replace(/{{first_name}}/gi, recipient.first_name || 'there')
    .replace(/{{last_name}}/gi, recipient.last_name || '')
    .replace(/{{full_name}}/gi, [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || 'there')
    .replace(/{{email}}/gi, recipient.email)
    .replace(/{{company}}/gi, recipient.company_name || 'your company')
    .replace(/{{company_name}}/gi, recipient.company_name || 'your company')

  // Replace any custom field tokens like {{positive_points}}, {{improvements}}, {{website}}, etc.
  // These come from the lead's database columns
  const customFields: Record<string, string | null> = {
    website: recipient.website,
    positive_points: recipient.positive_points,
    improvements: recipient.improvements,
    video_link: recipient.video_link,
    image_link: recipient.image_link,
    fb_ads_notes: recipient.fb_ads_notes,
    pixel_status: recipient.pixel_status,
    custom_notes: recipient.custom_notes,
    quick_question: recipient.quick_question,
  }


  for (const [field, value] of Object.entries(customFields)) {
    const regex = new RegExp(`{{${field}}}`, 'gi')
    result = result.replace(regex, value || '')
  }

  // Replace individual positive_point_1 through positive_point_10 tokens
  const positiveParts = splitIntoParts(recipient.positive_points || '', 10)
  for (let i = 0; i < 10; i++) {
    const regex = new RegExp(`{{positive_point_${i + 1}}}`, 'gi')
    result = result.replace(regex, positiveParts[i] || '')
  }

  // Replace individual improvements_1 through improvements_10 tokens
  const improvementParts = splitIntoParts(recipient.improvements || '', 10)
  for (let i = 0; i < 10; i++) {
    const regex = new RegExp(`{{improvements_${i + 1}}}`, 'gi')
    result = result.replace(regex, improvementParts[i] || '')
  }

  return result
}


// Split a string into N parts by newlines
function splitIntoParts(text: string, count: number): string[] {
  const parts: string[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  if (lines.length >= count) {
    for (let i = 0; i < count; i++) {
      parts.push(lines[i] || '')
    }
  } else if (lines.length > 1) {
    for (let i = 0; i < count; i++) {
      parts.push(lines[i] || '')
    }
  } else {
    parts.push(text)
    for (let i = 1; i < count; i++) {
      parts.push('')
    }
  }
  
  return parts
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

// Calculate milliseconds until next business hours
function msUntilNextBusinessHours(campaign: any): number {
  const now = new Date()
  const startParts = (campaign.business_hours_start || '09:00').split(':')
  const startHour = parseInt(startParts[0])
  const startMin = parseInt(startParts[1] || '0')

  // Try today's start time
  const todayStart = new Date(now)
  todayStart.setHours(startHour, startMin, 0, 0)

  // If we're before business hours today, wait until they start
  if (now < todayStart) {
    return todayStart.getTime() - now.getTime()
  }

  // Otherwise, wait until next business day
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(startHour, startMin, 0, 0)

  // Skip weekends
  let daysToAdd = 1
  while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
    tomorrow.setDate(tomorrow.getDate() + 1)
    daysToAdd++
  }

  return tomorrow.getTime() - now.getTime()
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

// Helper to retry SQL queries on connection errors (NeonDB serverless connections can drop)
async function retrySql<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      const isConnectionError =
        error?.message?.includes('fetch failed') ||
        error?.message?.includes('SocketError') ||
        error?.message?.includes('other side closed') ||
        error?.message?.includes('connection') ||
        error?.code === 'UND_ERR_SOCKET'

      if (isConnectionError && attempt < retries) {
        console.log(`Database connection error (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= 2 // Exponential backoff
      } else {
        throw error
      }
    }
  }
  throw new Error('Retry exhausted')
}

// Background processor for scheduled/random_gap campaigns
async function processScheduledCampaign(campaignId: number, userId: number) {
  const sql = getDb()

  try {
    const campaigns = await retrySql(() => sql`
      SELECT * FROM email_campaigns WHERE id = ${campaignId} AND user_id = ${userId}
    `)
    if (campaigns.length === 0) return
    const campaign = campaigns[0]

    const config = await getMailboxConfig(userId)
    if (!config) {
      await retrySql(() => sql`UPDATE email_campaigns SET status = 'failed' WHERE id = ${campaignId}`)
      return
    }

    const senderEmail = campaign.from_email || config.send_as || config.email

    // Get pending recipients with all lead fields for personalization
    const recipients = await retrySql(() => sql`
      SELECT cr.*, l.first_name, l.last_name, l.company_name, l.website,
             l.positive_points, l.improvements, l.video_link, l.image_link,
             l.fb_ads_notes, l.pixel_status, l.custom_notes, l.quick_question
      FROM campaign_recipients cr
      JOIN leads l ON l.id = cr.lead_id
      WHERE cr.campaign_id = ${campaignId} AND cr.status = 'pending'
      ORDER BY cr.id
    `)




    let sentCount = 0
    let failedCount = 0

    for (let i = 0; i < recipients.length; i++) {
      // Check if campaign was paused or cancelled
      const currentCampaign = await retrySql(() => sql`
        SELECT * FROM email_campaigns WHERE id = ${campaignId}
      `)
      if (currentCampaign.length === 0) return
      const camp = currentCampaign[0]
      if (camp.status === 'paused' || camp.status === 'cancelled') {
        break
      }

      // Check daily cap
      const capReached = await checkDailyCap(sql, campaignId, camp)
      if (capReached) {
        console.log(`Daily cap reached for campaign ${campaignId}. Pausing until tomorrow.`)
        // Wait until next business hours or just 1 hour and check again
        if (camp.business_hours_only) {
          const waitMs = msUntilNextBusinessHours(camp)
          await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 3600000))) // Max 1 hour check
        } else {
          await new Promise(resolve => setTimeout(resolve, 3600000)) // Check again in 1 hour
        }
        i-- // Retry this recipient
        continue
      }

      // Check business hours
      if (camp.business_hours_only && !isWithinBusinessHours(camp)) {
        const waitMs = msUntilNextBusinessHours(camp)
        console.log(`Outside business hours for campaign ${campaignId}. Waiting ${Math.round(waitMs / 60000)} minutes.`)
        await new Promise(resolve => setTimeout(resolve, waitMs))
        i-- // Retry this recipient
        continue
      }

      const recipient = recipients[i]

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
          senderEmail,
          campaign.from_name || undefined,
          true // plainTextOnly - send as plain text for campaign emails
        )

        // Create a thread for this campaign email
        const threadResult = await retrySql(() => sql`
          INSERT INTO email_threads (user_id, subject, last_message_at)
          VALUES (${userId}, ${personalizedSubject}, NOW())
          RETURNING id
        `)
        const threadId = threadResult[0].id

        await retrySql(() => sql`
          UPDATE campaign_recipients
          SET status = 'sent', sent_at = NOW(), message_id = ${result.messageId}
          WHERE id = ${recipient.id}
        `)

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

        // Save to email_history for lead-level tracking with campaign's layer
        const emailLayer = campaign.layer || 'campaign'
        await retrySql(() => sql`
          INSERT INTO email_history (lead_id, user_id, layer, subject, body)
          VALUES (${recipient.lead_id}, ${userId}, ${emailLayer}, ${personalizedSubject}, ${bodyWithSignature})
        `)


        await retrySql(() => sql`
          UPDATE leads SET last_email_sent = NOW(), status = CASE WHEN status = 'cold' THEN 'contacted' ELSE status END
          WHERE id = ${recipient.lead_id}
        `)

        sentCount++

        
        // Update today's sent count for daily cap tracking
        if (camp.daily_cap && camp.daily_cap > 0) {
          await retrySql(() => sql`
            UPDATE email_campaigns
            SET today_sent_count = today_sent_count + 1
            WHERE id = ${campaignId}
          `)
        }
      } catch (error: any) {
        console.error(`Failed to send to ${recipient.email}:`, error)
        await retrySql(() => sql`
          UPDATE campaign_recipients
          SET status = 'failed', error_message = ${error.message}
          WHERE id = ${recipient.id}
        `)
        failedCount++
      }

      // Update campaign progress
      await retrySql(() => sql`
        UPDATE email_campaigns
        SET sent_count = sent_count + 1
        WHERE id = ${campaignId}
      `)

      // Wait for calculated delay if not the last email
      if (i < recipients.length - 1) {
        const delayMs = calculateDelay(camp)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }

    // Mark campaign as completed
    await retrySql(() => sql`
      UPDATE email_campaigns
      SET status = 'completed', sent_count = ${sentCount}, failed_count = ${failedCount}
      WHERE id = ${campaignId}
    `)
  } catch (error) {
    console.error('Campaign processing error:', error)
    try {
      await retrySql(() => sql`
        UPDATE email_campaigns SET status = 'failed' WHERE id = ${campaignId}
      `)
    } catch (finalError) {
      console.error('Failed to update campaign status after error:', finalError)
    }
  }
}

