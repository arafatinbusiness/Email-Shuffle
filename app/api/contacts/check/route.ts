import { NextRequest, NextResponse } from 'next/server'
import { queryCollection } from '@/lib/firebase-admin'
import nodemailer from 'nodemailer'
import { getDb } from '@/lib/db'
import { decryptPassword } from '@/lib/mailbox-crypto'

// Track the last processed document ID to avoid duplicates
let lastProcessedDocId: string | null = null

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Query Firestore for contacts
    const result = await queryCollection('contacts', 'name', 10)

    if (result.documents.length === 0) {
      return NextResponse.json({ message: 'No new contacts', count: 0 })
    }

    // Filter out already processed documents
    const newDocs = lastProcessedDocId
      ? result.documents.filter(doc => doc.id !== lastProcessedDocId)
      : result.documents

    if (newDocs.length === 0) {
      return NextResponse.json({ message: 'No new contacts to process', count: 0 })
    }

    // Get mailbox account from database
    const sql = getDb()
    const accounts = await sql`
      SELECT id, email, smtp_host, smtp_port, encrypted_password, send_as
      FROM mailbox_accounts
      LIMIT 1
    `

    if (accounts.length === 0) {
      return NextResponse.json({ error: 'No mailbox account configured' }, { status: 500 })
    }

    const account = accounts[0] as { email: string; smtp_host: string; smtp_port: number; encrypted_password: string; send_as: string | null }
    const password = decryptPassword(account.encrypted_password)

    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_port === 465,
      auth: {
        user: account.email,
        pass: password,
      },
    })

    let sentCount = 0

    for (const doc of newDocs) {
      const { name, email, message, timestamp } = doc.data

      // Send notification email to support email
      await transporter.sendMail({
        from: `"Labinitial Contact Form" <${account.email}>`,
        to: account.email,
        subject: `New Contact Form Submission from ${name || 'Unknown'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
              New Contact Form Submission
            </h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; width: 100px;">Name:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${name || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Email:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                    <a href="mailto:${email}" style="color: #007bff;">${email}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Date:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                    ${timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString()}
                  </td>
                </tr>
              </table>
            </div>
            <div style="background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
              <h3 style="color: #007bff; margin-top: 0;">Message:</h3>
              <p style="line-height: 1.6; color: #333; white-space: pre-wrap;">${message || 'No message'}</p>
            </div>
            <div style="margin-top: 20px; padding: 15px; background: #e7f3ff; border-radius: 5px;">
              <p style="margin: 0; color: #0056b3;">
                <strong>Action Required:</strong> Please respond to this inquiry within 24 hours.
              </p>
            </div>
          </div>
        `,
      })

      sentCount++
      lastProcessedDocId = doc.id
    }

    return NextResponse.json({
      message: `Processed ${sentCount} new contact(s)`,
      count: sentCount,
    })
  } catch (error: any) {
    console.error('Error checking contacts:', error)
    return NextResponse.json(
      { error: 'Failed to process contacts', details: error.message },
      { status: 500 }
    )
  }
}
