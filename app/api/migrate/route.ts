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

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_leads_group_id ON leads(group_id)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_leads_import_batch_id ON leads(import_batch_id)
    `

    return NextResponse.json({ success: true, message: 'Migration completed successfully' })

  } catch (error) {
    console.error('Migration failed:', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}
