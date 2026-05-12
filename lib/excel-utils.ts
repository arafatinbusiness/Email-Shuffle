import { Lead, LeadStatus, LeadLayer, LeadPriority, LeadIntent } from './types'

// Export leads to CSV format (Excel compatible)
export function exportToCSV(leads: Lead[]): string {
  const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Company',
    'Website',
    'Status',
    'Current Layer',
    'Priority',
    'Intent',
    'Positive Points',
    'Improvements',
    'FB Ads Notes',
    'Pixel Status',
    'Custom Notes',
    'Last Email Sent',
    'Next Follow Up',
    'Created At',
  ]

  const rows = leads.map(lead => [
    lead.first_name,
    lead.last_name || '',
    lead.email,
    lead.company_name || '',
    lead.website || '',
    lead.status,
    lead.current_layer,
    lead.priority || '',
    lead.intent || '',
    lead.positive_points || '',
    lead.improvements || '',
    lead.fb_ads_notes || '',
    lead.pixel_status || '',
    lead.custom_notes || '',
    lead.last_email_sent || '',
    lead.next_follow_up || '',
    lead.created_at,
  ])

  const escapeCSV = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n')

  return csvContent
}

// Parse CSV content to lead data
export function parseCSV(content: string): Partial<Lead>[] {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const leads: Partial<Lead>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const lead: Partial<Lead> = {}

    headers.forEach((header, index) => {
      const value = values[index]?.trim() || ''
      
      switch (header) {
        case 'first_name':
        case 'firstname':
        case 'first':
          lead.first_name = value
          break
        case 'last_name':
        case 'lastname':
        case 'last':
          lead.last_name = value || null
          break
        case 'email':
          lead.email = value
          break
        case 'company':
        case 'company_name':
          lead.company_name = value || null
          break
        case 'website':
        case 'url':
          lead.website = value || null
          break
        case 'status':
          if (isValidStatus(value)) lead.status = value
          break
        case 'current_layer':
        case 'layer':
          if (isValidLayer(value)) lead.current_layer = value
          break
        case 'priority':
          if (isValidPriority(value)) lead.priority = value
          break
        case 'intent':
          if (isValidIntent(value)) lead.intent = value
          break
        case 'positive_points':
        case 'positives':
          lead.positive_points = value || null
          break
        case 'improvements':
          lead.improvements = value || null
          break
        case 'fb_ads_notes':
        case 'fb_notes':
          lead.fb_ads_notes = value || null
          break
        case 'pixel_status':
        case 'pixel':
          lead.pixel_status = value || null
          break
        case 'custom_notes':
        case 'notes':
          lead.custom_notes = value || null
          break
        case 'next_follow_up':
        case 'next_followup':
        case 'follow_up':
          lead.next_follow_up = value || null
          break
      }
    })

    // Only add if we have required fields
    if (lead.first_name && lead.email) {
      leads.push(lead)
    }
  }

  return leads
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current)
  return result
}

function isValidStatus(value: string): value is LeadStatus {
  return ['cold', 'contacted', 'replied', 'converted', 'dead'].includes(value.toLowerCase())
}

function isValidLayer(value: string): value is LeadLayer {
  return ['L1', 'L2', 'L3', 'L4', 'L5+'].includes(value.toUpperCase())
}

function isValidPriority(value: string): value is LeadPriority {
  return ['high', 'medium', 'low'].includes(value.toLowerCase())
}

function isValidIntent(value: string): value is LeadIntent {
  return ['cold-outreach', 'follow-up', 'closing', 're-engagement'].includes(value.toLowerCase())
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
