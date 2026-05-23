import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()

    // Create lead_groups table
    await sql`
      CREATE TABLE IF NOT EXISTS lead_groups (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, name)
      )
    `

    // Add group_id column to leads
    await sql`
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES lead_groups(id) ON DELETE SET NULL
    `

    // Add import_batch_id column to leads
    await sql`
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS import_batch_id VARCHAR(50)
    `

    // Add current_website_updates column to leads
    await sql`
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_website_updates TEXT
    `

    // Add next_send_at column to email_campaigns for precise gap enforcement
    await sql`
      ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS next_send_at TIMESTAMP
    `

    // Create index for next_send_at for efficient cron queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_email_campaigns_next_send_at ON email_campaigns(next_send_at)
    `

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_leads_group_id ON leads(group_id)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_leads_import_batch_id ON leads(import_batch_id)
    `

    // Fix campaign_recipients check constraint to allow 'sending' status
    // The process-scheduled route uses 'sending' as an intermediate status to prevent
    // duplicate processing by concurrent cron cycles
    await sql`
      ALTER TABLE campaign_recipients
      DROP CONSTRAINT IF EXISTS campaign_recipients_status_check,
      ADD CONSTRAINT campaign_recipients_status_check
      CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped'))
    `

    // Add from_name column to email_campaigns for per-campaign display name
    await sql`
      ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS from_name TEXT DEFAULT ''
    `

    // Add current_website_updates column to leads if missing
    await sql`
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_website_updates TEXT
    `

    // Add layer column to email_campaigns for tagging campaigns with outreach layer (L1, L2, etc.)
    await sql`
      ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS layer VARCHAR(10) DEFAULT 'campaign'
    `

    // Add video_link column to leads for screen recording URLs
    await sql`
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS video_link TEXT
    `

    // Add image_link column to leads for screenshot URLs
    await sql`
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS image_link TEXT
    `

    return NextResponse.json({ success: true, message: 'Migration completed successfully' })





  } catch (error) {
    console.error('Migration failed:', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}
