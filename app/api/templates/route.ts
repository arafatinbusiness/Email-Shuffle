import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auth } from '@/lib/auth'

// GET /api/templates - List all templates for the user
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const templates = await sql`
      SELECT * FROM email_templates
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Failed to fetch templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST /api/templates - Create a new template
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const body = await request.json()
    const { name, subject, body: templateBody, category = 'general' } = body

    if (!name || !subject || !templateBody) {
      return NextResponse.json({ error: 'Missing required fields: name, subject, body' }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO email_templates (user_id, name, subject, body, category)
      VALUES (${userId}, ${name}, ${subject}, ${templateBody}, ${category})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Failed to create template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}

// PUT /api/templates - Update a template
export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const body = await request.json()
    const { id, name, subject, templateBody, category } = body

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }

    const result = await sql`
      UPDATE email_templates
      SET name = COALESCE(${name}, name),
          subject = COALESCE(${subject}, subject),
          body = COALESCE(${templateBody}, body),
          category = COALESCE(${category}, category)
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Failed to update template:', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

// DELETE /api/templates - Delete a template
export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }

    const result = await sql`
      DELETE FROM email_templates
      WHERE id = ${parseInt(id)} AND user_id = ${userId}
      RETURNING id
    `
    if (result.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete template:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
