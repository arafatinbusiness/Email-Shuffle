import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auth } from '@/lib/auth'
import { encryptPassword } from '@/lib/mailbox-crypto'

// GET /api/mailbox/account - Get user's mailbox account
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const accounts = await sql`
      SELECT id, email, imap_host, imap_port, smtp_host, smtp_port, sync_enabled, last_sync_at, created_at, send_as, signature, default_from_name
      FROM mailbox_accounts
      WHERE user_id = ${userId}
      LIMIT 1
    `
    return NextResponse.json(accounts[0] || null)
  } catch (error) {
    console.error('Failed to fetch mailbox account:', error)
    return NextResponse.json({ error: 'Failed to fetch mailbox account' }, { status: 500 })
  }
}

// POST /api/mailbox/account - Create or update mailbox account
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const body = await request.json()
    const { email, imap_host, imap_port, smtp_host, smtp_port, password, sync_enabled, send_as, signature, default_from_name } = body

    if (!email || !imap_host || !smtp_host || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const encryptedPassword = encryptPassword(password)

    // Upsert - check if account exists
    const existing = await sql`
      SELECT id FROM mailbox_accounts WHERE user_id = ${userId}
    `

    if (existing.length > 0) {
      await sql`
        UPDATE mailbox_accounts SET
          email = ${email},
          imap_host = ${imap_host},
          imap_port = ${imap_port || 993},
          smtp_host = ${smtp_host},
          smtp_port = ${smtp_port || 465},
          encrypted_password = ${encryptedPassword},
          sync_enabled = ${sync_enabled !== false},
          send_as = ${send_as || null},
          signature = ${signature || null},
          default_from_name = ${default_from_name || null},
          updated_at = NOW()
        WHERE user_id = ${userId}
      `
    } else {
      await sql`
        INSERT INTO mailbox_accounts (user_id, email, imap_host, imap_port, smtp_host, smtp_port, encrypted_password, sync_enabled, send_as, signature, default_from_name)
        VALUES (${userId}, ${email}, ${imap_host}, ${imap_port || 993}, ${smtp_host}, ${smtp_port || 465}, ${encryptedPassword}, ${sync_enabled !== false}, ${send_as || null}, ${signature || null}, ${default_from_name || null})
      `
    }

    // Re-fetch to return clean data
    const updated = await sql`
      SELECT id, email, imap_host, imap_port, smtp_host, smtp_port, sync_enabled, last_sync_at, created_at, send_as, signature, default_from_name
      FROM mailbox_accounts WHERE user_id = ${userId}
    `

    return NextResponse.json(updated[0])
  } catch (error) {
    console.error('Failed to save mailbox account:', error)
    return NextResponse.json({ error: 'Failed to save mailbox account' }, { status: 500 })
  }
}

// PATCH /api/mailbox/account - Update signature only (no password needed)
export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const body = await request.json()
    const { signature } = body

    await sql`
      UPDATE mailbox_accounts SET
        signature = ${signature || null},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `

    const updated = await sql`
      SELECT id, email, imap_host, imap_port, smtp_host, smtp_port, sync_enabled, last_sync_at, created_at, send_as, signature
      FROM mailbox_accounts WHERE user_id = ${userId}
    `

    return NextResponse.json(updated[0])
  } catch (error) {
    console.error('Failed to update signature:', error)
    return NextResponse.json({ error: 'Failed to update signature' }, { status: 500 })
  }
}

// DELETE /api/mailbox/account - Remove mailbox account
export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    await sql`DELETE FROM mailbox_accounts WHERE user_id = ${userId}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete mailbox account:', error)
    return NextResponse.json({ error: 'Failed to delete mailbox account' }, { status: 500 })
  }
}
