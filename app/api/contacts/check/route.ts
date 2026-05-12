import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase-admin'
import nodemailer from 'nodemailer'
import { getDb } from '@/lib/db'

// Create SMTP transporter using the same credentials as the mailbox system
async function getTransporter() {
  const pool = await getDb()
  const result = await pool.query(
    'SELECT email, smtp_host, smtp_port, encrypted_password FROM mailbox_accounts LIMIT 1'
  )

  if (result.rows.length === 0) {
    throw new Error('No mailbox account configured')
  }

  const { email, smtp_host, smtp_port, encrypted_password } = result.rows[0]

  // Decrypt password
  const crypto = require('crypto')
  const key = process.env.MAILBOX_ENCRYPTION_KEY
  if (!key) throw new Error('MAILBOX_ENCRYPTION_KEY not set')

  const keyBuffer = key.length === 64
    ? Buffer.from(key, 'hex')
    : crypto.createHash('sha256').update(key).digest()

  const parts = encrypted_password.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const enc = parts[2]

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv)
  decipher.setAuthTag(tag)
  let password = decipher.update(enc, 'hex', 'utf8')
  password += decipher.final('utf8')

  return nodemailer.createTransport({
    host: smtp_host,
    port: smtp_port,
    secure: smtp_port === 465,
    auth: { user: email, pass: password },
  })
}

// Track the last checked document ID to avoid sending duplicates
let lastCheckedId: string | null = null

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Query Firestore for contacts ordered by timestamp
    const contactsRef = db.collection('contacts')
    let query = contactsRef.orderBy('timestamp', 'asc').limit(10)

    // If we have a last checked ID, start after it
    if (lastCheckedId) {
      const lastDoc = await contactsRef.doc(lastCheckedId).get()
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc)
      }
    }

    const snapshot = await query.get()

    if (snapshot.empty) {
      return NextResponse.json({ message: 'No new contacts', count: 0 })
    }

    // Get the SMTP transporter
    const transporter = await getTransporter()
    const supportEmail = (await transporter.options.auth).user as string

    let sentCount = 0
    let lastDocId: string | null = null

    for (const doc of snapshot.docs) {
      const data = doc.data()
      const { name, email, message, timestamp } = data

      // Send notification email to support@labinitial.com
      await transporter.sendMail({
        from: `"Labinitial Contact Form" <${supportEmail}>`,
        to: supportEmail,
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
                    ${timestamp?.toDate ? new Date(timestamp.toDate()).toLocaleString() : new Date().toLocaleString()}
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
      lastDocId = doc.id
    }

    // Update the last checked ID
    if (lastDocId) {
      lastCheckedId = lastDocId
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
