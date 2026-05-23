import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('group_id')
    const importBatchId = searchParams.get('import_batch_id')
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')

    let query = sql`
      SELECT l.*, lg.name as group_name
      FROM leads l
      LEFT JOIN lead_groups lg ON lg.id = l.group_id
      WHERE l.user_id = ${userId}
    `

    if (groupId) {
      if (groupId === 'null') {
        query = sql`${query} AND l.group_id IS NULL`
      } else {
        query = sql`${query} AND l.group_id = ${parseInt(groupId)}`
      }
    }

    if (importBatchId) {
      query = sql`${query} AND l.import_batch_id = ${importBatchId}`
    }

    if (search) {
      query = sql`${query} AND (
        LOWER(l.first_name) LIKE LOWER(${'%' + search + '%'}) OR
        LOWER(l.last_name) LIKE LOWER(${'%' + search + '%'}) OR
        LOWER(l.email) LIKE LOWER(${'%' + search + '%'}) OR
        LOWER(l.company_name) LIKE LOWER(${'%' + search + '%'})
      )`
    }

    query = sql`${query} ORDER BY 
      CASE 
        WHEN l.priority = 'high' THEN 0
        WHEN l.priority = 'medium' THEN 1
        WHEN l.priority = 'low' THEN 2
        ELSE 3
      END,
      CASE 
        WHEN l.next_follow_up IS NOT NULL AND l.next_follow_up <= CURRENT_DATE THEN 0
        WHEN l.next_follow_up IS NOT NULL THEN 1
        ELSE 2
      END,
      l.next_follow_up ASC NULLS LAST,
      l.updated_at DESC
    `

    if (limit) {
      query = sql`${query} LIMIT ${parseInt(limit)}`
    }

    const leads = await query
    return NextResponse.json(leads)
  } catch (error: any) {
    // If the error is about a missing column (42703), retry with a safe column list
    if (error?.code === '42703') {
      console.warn('Column not found in DB, retrying GET with safe column list:', error?.message)
      try {
        const sql = getDb()
        const userId = parseInt(session.user.id)
        const { searchParams } = new URL(request.url)
        const groupId = searchParams.get('group_id')
        const importBatchId = searchParams.get('import_batch_id')
        const search = searchParams.get('search')
        const limit = searchParams.get('limit')

        let query = sql`
          SELECT l.id, l.user_id, l.first_name, l.last_name, l.email, l.company_name, l.website,
                 l.group_id, l.status, l.current_layer, l.priority, l.intent, l.lead_type,
                 l.positive_points, l.improvements,
                 l.fb_ads_notes, l.pixel_status, l.custom_notes,
                 l.last_email_sent, l.next_follow_up, l.created_at, l.updated_at,
                 l.import_batch_id,
                 lg.name as group_name
          FROM leads l
          LEFT JOIN lead_groups lg ON lg.id = l.group_id
          WHERE l.user_id = ${userId}
        `

        if (groupId) {
          if (groupId === 'null') {
            query = sql`${query} AND l.group_id IS NULL`
          } else {
            query = sql`${query} AND l.group_id = ${parseInt(groupId)}`
          }
        }

        if (importBatchId) {
          query = sql`${query} AND l.import_batch_id = ${importBatchId}`
        }

        if (search) {
          query = sql`${query} AND (
            LOWER(l.first_name) LIKE LOWER(${'%' + search + '%'}) OR
            LOWER(l.last_name) LIKE LOWER(${'%' + search + '%'}) OR
            LOWER(l.email) LIKE LOWER(${'%' + search + '%'}) OR
            LOWER(l.company_name) LIKE LOWER(${'%' + search + '%'})
          )`
        }

        query = sql`${query} ORDER BY 
          CASE 
            WHEN l.priority = 'high' THEN 0
            WHEN l.priority = 'medium' THEN 1
            WHEN l.priority = 'low' THEN 2
            ELSE 3
          END,
          CASE 
            WHEN l.next_follow_up IS NOT NULL AND l.next_follow_up <= CURRENT_DATE THEN 0
            WHEN l.next_follow_up IS NOT NULL THEN 1
            ELSE 2
          END,
          l.next_follow_up ASC NULLS LAST,
          l.updated_at DESC
        `

        if (limit) {
          query = sql`${query} LIMIT ${parseInt(limit)}`
        }

        const leads = await query
        return NextResponse.json(leads)
      } catch (fallbackError) {
        console.error('Failed to fetch leads (fallback):', fallbackError)
        return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
      }
    }
    console.error('Failed to fetch leads:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }


}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sql = getDb()
    const userId = parseInt(session.user.id)
    const body = await request.json()
    const {
      first_name,
      last_name,
      email,
      company_name,
      website,
      group_id,
      status = 'cold',
      current_layer = 'L1',
      lead_type = 'lead',
      priority,
      intent,
      positive_points,
      improvements,
      video_link,
      image_link,
      current_website_updates,

      fb_ads_notes,
      pixel_status,
      custom_notes,
      next_follow_up,
      upsert = false,
    } = body



    // Try with current_website_updates first, fall back to without if column doesn't exist
    const insertWithUpdates = async () => {
      if (upsert) {
        return await sql`
          INSERT INTO leads (
            user_id, first_name, last_name, email, company_name, website, group_id,
            status, current_layer, lead_type, priority, intent, positive_points, improvements,
            video_link, image_link, current_website_updates, fb_ads_notes, pixel_status, custom_notes, next_follow_up
          ) VALUES (
            ${userId}, ${first_name}, ${last_name || null}, ${email}, ${company_name || null}, ${website || null}, ${group_id ? parseInt(group_id) : null},
            ${status}, ${current_layer}, ${lead_type}, ${priority || null}, ${intent || null}, ${positive_points || null}, ${improvements || null},
            ${video_link || null}, ${image_link || null}, ${current_website_updates || null}, ${fb_ads_notes || null}, ${pixel_status || null}, ${custom_notes || null}, ${next_follow_up || null}
          )
          ON CONFLICT (user_id, email) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            company_name = EXCLUDED.company_name,
            website = EXCLUDED.website,
            group_id = EXCLUDED.group_id,
            status = EXCLUDED.status,
            current_layer = EXCLUDED.current_layer,
            lead_type = EXCLUDED.lead_type,
            priority = EXCLUDED.priority,
            intent = EXCLUDED.intent,
            positive_points = EXCLUDED.positive_points,
            improvements = EXCLUDED.improvements,
            video_link = EXCLUDED.video_link,
            image_link = EXCLUDED.image_link,
            current_website_updates = EXCLUDED.current_website_updates,
            fb_ads_notes = EXCLUDED.fb_ads_notes,
            pixel_status = EXCLUDED.pixel_status,
            custom_notes = EXCLUDED.custom_notes,
            next_follow_up = EXCLUDED.next_follow_up,
            updated_at = NOW()
          RETURNING *
        `
      }
      return await sql`
        INSERT INTO leads (
          user_id, first_name, last_name, email, company_name, website, group_id,
          status, current_layer, lead_type, priority, intent, positive_points, improvements,
          video_link, image_link, current_website_updates, fb_ads_notes, pixel_status, custom_notes, next_follow_up
        ) VALUES (
          ${userId}, ${first_name}, ${last_name || null}, ${email}, ${company_name || null}, ${website || null}, ${group_id ? parseInt(group_id) : null},
          ${status}, ${current_layer}, ${lead_type}, ${priority || null}, ${intent || null}, ${positive_points || null}, ${improvements || null},
          ${video_link || null}, ${image_link || null}, ${current_website_updates || null}, ${fb_ads_notes || null}, ${pixel_status || null}, ${custom_notes || null}, ${next_follow_up || null}
        )
        RETURNING *
      `
    }

    const insertWithoutUpdates = async () => {
      if (upsert) {
        return await sql`
          INSERT INTO leads (
            user_id, first_name, last_name, email, company_name, website, group_id,
            status, current_layer, lead_type, priority, intent, positive_points, improvements,
            video_link, image_link, fb_ads_notes, pixel_status, custom_notes, next_follow_up
          ) VALUES (
            ${userId}, ${first_name}, ${last_name || null}, ${email}, ${company_name || null}, ${website || null}, ${group_id ? parseInt(group_id) : null},
            ${status}, ${current_layer}, ${lead_type}, ${priority || null}, ${intent || null}, ${positive_points || null}, ${improvements || null},
            ${video_link || null}, ${image_link || null}, ${fb_ads_notes || null}, ${pixel_status || null}, ${custom_notes || null}, ${next_follow_up || null}
          )
          ON CONFLICT (user_id, email) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            company_name = EXCLUDED.company_name,
            website = EXCLUDED.website,
            group_id = EXCLUDED.group_id,
            status = EXCLUDED.status,
            current_layer = EXCLUDED.current_layer,
            lead_type = EXCLUDED.lead_type,
            priority = EXCLUDED.priority,
            intent = EXCLUDED.intent,
            positive_points = EXCLUDED.positive_points,
            improvements = EXCLUDED.improvements,
            video_link = EXCLUDED.video_link,
            image_link = EXCLUDED.image_link,
            fb_ads_notes = EXCLUDED.fb_ads_notes,
            pixel_status = EXCLUDED.pixel_status,
            custom_notes = EXCLUDED.custom_notes,
            next_follow_up = EXCLUDED.next_follow_up,
            updated_at = NOW()
          RETURNING *
        `
      }
      return await sql`
        INSERT INTO leads (
          user_id, first_name, last_name, email, company_name, website, group_id,
          status, current_layer, lead_type, priority, intent, positive_points, improvements,
          video_link, image_link, fb_ads_notes, pixel_status, custom_notes, next_follow_up
        ) VALUES (
          ${userId}, ${first_name}, ${last_name || null}, ${email}, ${company_name || null}, ${website || null}, ${group_id ? parseInt(group_id) : null},
          ${status}, ${current_layer}, ${lead_type}, ${priority || null}, ${intent || null}, ${positive_points || null}, ${improvements || null},
          ${video_link || null}, ${image_link || null}, ${fb_ads_notes || null}, ${pixel_status || null}, ${custom_notes || null}, ${next_follow_up || null}
        )
        RETURNING *
      `
    }

    const insertWithoutMediaLinks = async () => {
      if (upsert) {
        return await sql`
          INSERT INTO leads (
            user_id, first_name, last_name, email, company_name, website, group_id,
            status, current_layer, lead_type, priority, intent, positive_points, improvements,
            fb_ads_notes, pixel_status, custom_notes, next_follow_up
          ) VALUES (
            ${userId}, ${first_name}, ${last_name || null}, ${email}, ${company_name || null}, ${website || null}, ${group_id ? parseInt(group_id) : null},
            ${status}, ${current_layer}, ${lead_type}, ${priority || null}, ${intent || null}, ${positive_points || null}, ${improvements || null},
            ${fb_ads_notes || null}, ${pixel_status || null}, ${custom_notes || null}, ${next_follow_up || null}
          )
          ON CONFLICT (user_id, email) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            company_name = EXCLUDED.company_name,
            website = EXCLUDED.website,
            group_id = EXCLUDED.group_id,
            status = EXCLUDED.status,
            current_layer = EXCLUDED.current_layer,
            lead_type = EXCLUDED.lead_type,
            priority = EXCLUDED.priority,
            intent = EXCLUDED.intent,
            positive_points = EXCLUDED.positive_points,
            improvements = EXCLUDED.improvements,
            fb_ads_notes = EXCLUDED.fb_ads_notes,
            pixel_status = EXCLUDED.pixel_status,
            custom_notes = EXCLUDED.custom_notes,
            next_follow_up = EXCLUDED.next_follow_up,
            updated_at = NOW()
          RETURNING *
        `
      }
      return await sql`
        INSERT INTO leads (
          user_id, first_name, last_name, email, company_name, website, group_id,
          status, current_layer, lead_type, priority, intent, positive_points, improvements,
          fb_ads_notes, pixel_status, custom_notes, next_follow_up
        ) VALUES (
          ${userId}, ${first_name}, ${last_name || null}, ${email}, ${company_name || null}, ${website || null}, ${group_id ? parseInt(group_id) : null},
          ${status}, ${current_layer}, ${lead_type}, ${priority || null}, ${intent || null}, ${positive_points || null}, ${improvements || null},
          ${fb_ads_notes || null}, ${pixel_status || null}, ${custom_notes || null}, ${next_follow_up || null}
        )
        RETURNING *
      `
    }





    try {
      const result = await insertWithUpdates()
      return NextResponse.json(result[0], { status: 201 })
    } catch (error: any) {
      // If the error is about missing current_website_updates column, retry without it
      if (error?.code === '42703' && String(error?.message || '').includes('current_website_updates')) {
        console.warn('current_website_updates column not found in DB, retrying without it')
        try {
          const result = await insertWithoutUpdates()
          return NextResponse.json(result[0], { status: 201 })
        } catch (innerError: any) {
          // If image_link also missing, retry without media links
          if (innerError?.code === '42703' && String(innerError?.message || '').includes('image_link')) {
            console.warn('image_link column also not found in DB, retrying without media links')
            const result = await insertWithoutMediaLinks()
            return NextResponse.json(result[0], { status: 201 })
          }
          throw innerError
        }
      }
      // If the error is about missing image_link column, retry without it
      if (error?.code === '42703' && String(error?.message || '').includes('image_link')) {
        console.warn('image_link column not found in DB, retrying without it')
        try {
          const result = await insertWithoutUpdates()
          return NextResponse.json(result[0], { status: 201 })
        } catch (innerError: any) {
          // If image_link still missing in insertWithoutUpdates, retry without media links
          if (innerError?.code === '42703' && String(innerError?.message || '').includes('image_link')) {
            console.warn('image_link column still not found, retrying without media links')
            const result = await insertWithoutMediaLinks()
            return NextResponse.json(result[0], { status: 201 })
          }
          throw innerError
        }
      }
      throw error
    }


  } catch (error) {
    console.error('Failed to create lead:', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}



