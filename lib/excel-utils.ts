import { Lead, LeadLayer, LeadPriority, LeadIntent, LeadType } from './types'
import * as XLSX from 'xlsx'

// Export leads to CSV format (Excel compatible)
export function exportToCSV(leads: Lead[]): string {
  const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Company',
    'Website',
    'Status',
    'Pipeline Stage',
    'Current Layer',
    'Type',
    'Priority',
    'Intent',
    'Current Website Updates',
    'FB Ads Notes',
    'Pixel Status',
    'Custom Notes',
    'Quick Question',
    'Last Email Sent',

    'Next Follow Up',
    'Created At',
    'Positive Point 1',
    'Positive Point 2',
    'Positive Point 3',
    'Positive Point 4',
    'Positive Point 5',
    'Positive Point 6',
    'Positive Point 7',
    'Positive Point 8',
    'Positive Point 9',
    'Positive Point 10',
    'Improvements 1',
    'Improvements 2',
    'Improvements 3',
    'Improvements 4',
    'Improvements 5',
    'Improvements 6',
    'Improvements 7',
    'Improvements 8',
    'Improvements 9',
    'Improvements 10',
    'Video Link',
    'Image Link',
  ]



  const rows = leads.map(lead => {
    // Split positive_points into up to 10 parts
    const positiveParts = splitIntoParts(lead.positive_points || '', 10)
    // Split improvements into up to 10 parts
    const improvementParts = splitIntoParts(lead.improvements || '', 10)

    return [
      lead.first_name,
      lead.last_name || '',
      lead.email,
      lead.company_name || '',
      lead.website || '',
      lead.status,
      lead.pipeline_stage,
      lead.current_layer,
      lead.lead_type || 'lead',
      lead.priority || '',
      lead.intent || '',
      lead.current_website_updates || '',
      lead.fb_ads_notes || '',
      lead.pixel_status || '',
      lead.custom_notes || '',
      lead.quick_question || '',
      lead.last_email_sent || '',

      lead.next_follow_up || '',
      lead.created_at,
      ...positiveParts,
      ...improvementParts,
      lead.video_link || '',
      lead.image_link || '',
    ]
  })



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
// startRow and endRow are 1-based (row 1 = header row). If provided, only rows in that range are imported.
// Example: startRow=3, endRow=5 will import data rows 3, 4, 5 (skipping header row 1 and data row 2)
export function parseCSV(content: string, startRow?: number, endRow?: number): Partial<Lead>[] {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const leads: Partial<Lead>[] = []

  // Determine which data rows to process
  // Row 1 = header, so data rows start at index 1 (line 2)
  let dataStartIndex = 1
  let dataEndIndex = lines.length - 1

  if (startRow !== undefined || endRow !== undefined) {
    // Convert 1-based row numbers to 0-based array indices
    // Row 1 = header (index 0), Row 2 = first data row (index 1), etc.
    const firstDataRow = 2 // Row 2 is the first data row
    if (startRow !== undefined) {
      dataStartIndex = Math.max(1, startRow - 1) // Convert 1-based to 0-based, but never go before first data row
    }
    if (endRow !== undefined) {
      dataEndIndex = Math.min(lines.length - 1, endRow - 1) // Convert 1-based to 0-based
    }
    // Ensure start <= end
    if (dataStartIndex > dataEndIndex) {
      dataStartIndex = dataEndIndex
    }
  }

  for (let i = dataStartIndex; i <= dataEndIndex; i++) {
    const values = parseCSVLine(lines[i])
    const lead: Partial<Lead> = {}

    // Collect numbered positive_points and improvements
    const positiveParts: string[] = []
    const improvementParts: string[] = []

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
          lead.status = value
          break
        case 'pipeline_stage':
        case 'pipeline stage':
        case 'pipeline':
          if (isValidPipelineStage(value)) lead.pipeline_stage = value as any
          break
        case 'current_layer':
        case 'layer':
          if (isValidLayer(value)) lead.current_layer = value
          break
        case 'type':
        case 'lead_type':
          if (isValidLeadType(value)) lead.lead_type = value
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
        case 'current_website_updates':
        case 'current_website_update':
        case 'website_updates':
          lead.current_website_updates = value || null
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
        case 'quick_question':
        case 'quickquestion':
        case 'question':
          lead.quick_question = value || null
          break
        case 'next_follow_up':

        case 'next_followup':
        case 'follow_up':
          lead.next_follow_up = value || null
          break
        case 'video_link':
        case 'video':
          lead.video_link = value || null
          break
        case 'image_link':
        case 'image':
          lead.image_link = value || null
          break
        default: {


          // Handle numbered columns like "positive_point_1", "improvements_3", etc.
          const positiveMatch = header.match(/^positive_?points?_?(\d+)$/)
          if (positiveMatch) {
            const num = parseInt(positiveMatch[1])
            if (num >= 1 && num <= 10 && value) {
              positiveParts[num - 1] = value
            }
            return
          }
          const improvementMatch = header.match(/^improvements?_?(\d+)$/)
          if (improvementMatch) {
            const num = parseInt(improvementMatch[1])
            if (num >= 1 && num <= 10 && value) {
              improvementParts[num - 1] = value
            }
            return
          }
          break
        }
      }
    })

    // Merge numbered parts into the main fields if they exist
    if (positiveParts.length > 0) {
      const merged = positiveParts.filter(p => p !== undefined && p !== '').join('\n')
      if (merged) {
        lead.positive_points = lead.positive_points
          ? lead.positive_points + '\n' + merged
          : merged
      }
    }
    if (improvementParts.length > 0) {
      const merged = improvementParts.filter(p => p !== undefined && p !== '').join('\n')
      if (merged) {
        lead.improvements = lead.improvements
          ? lead.improvements + '\n' + merged
          : merged
      }
    }

    // Only add if we have required fields
    if (lead.first_name && lead.email) {
      leads.push(lead)
    }
  }

  return leads
}


// Parse XLSX file content to lead data
// startRow and endRow are 1-based (row 1 = header row). If provided, only rows in that range are imported.
// Example: startRow=3, endRow=5 will import data rows 3, 4, 5 (skipping header row 1 and data row 2)
export function parseXLSX(data: ArrayBuffer, startRow?: number, endRow?: number): Partial<Lead>[] {
  const workbook = XLSX.read(data, { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { defval: '' })

  if (jsonData.length === 0) return []

  const leads: Partial<Lead>[] = []

  // Determine which data rows to process
  // sheet_to_json returns objects starting from the first data row (row 2 in Excel, index 0 in jsonData)
  let dataStartIndex = 0
  let dataEndIndex = jsonData.length - 1

  if (startRow !== undefined || endRow !== undefined) {
    // Convert 1-based row numbers to 0-based jsonData indices
    // Row 1 = header, Row 2 = first data row = jsonData[0]
    const firstDataRow = 2
    if (startRow !== undefined) {
      dataStartIndex = Math.max(0, startRow - firstDataRow)
    }
    if (endRow !== undefined) {
      dataEndIndex = Math.min(jsonData.length - 1, endRow - firstDataRow)
    }
    // Ensure start <= end
    if (dataStartIndex > dataEndIndex) {
      dataStartIndex = dataEndIndex
    }
  }

  for (let i = dataStartIndex; i <= dataEndIndex; i++) {
    const row = jsonData[i]
    const lead: Partial<Lead> = {}

    // Collect numbered positive_points and improvements
    const positiveParts: string[] = []
    const improvementParts: string[] = []

    for (const [key, value] of Object.entries(row)) {
      const header = key.trim().toLowerCase().replace(/\s+/g, '_')
      const strValue = String(value).trim()

      switch (header) {
        case 'first_name':
        case 'firstname':
        case 'first':
          lead.first_name = strValue
          break
        case 'last_name':
        case 'lastname':
        case 'last':
          lead.last_name = strValue || null
          break
        case 'email':
          lead.email = strValue
          break
        case 'company':
        case 'company_name':
          lead.company_name = strValue || null
          break
        case 'website':
        case 'url':
          lead.website = strValue || null
          break
        case 'status':
          lead.status = strValue
          break
        case 'pipeline_stage':
        case 'pipeline stage':
        case 'pipeline':
          if (isValidPipelineStage(strValue)) lead.pipeline_stage = strValue as any
          break
        case 'current_layer':
        case 'layer':
          if (isValidLayer(strValue)) lead.current_layer = strValue
          break
        case 'type':
        case 'lead_type':
          if (isValidLeadType(strValue)) lead.lead_type = strValue
          break
        case 'priority':
          if (isValidPriority(strValue)) lead.priority = strValue
          break
        case 'intent':
          if (isValidIntent(strValue)) lead.intent = strValue
          break
        case 'positive_points':
        case 'positives':
          lead.positive_points = strValue || null
          break
        case 'improvements':
          lead.improvements = strValue || null
          break
        case 'current_website_updates':
        case 'current_website_update':
        case 'website_updates':
          lead.current_website_updates = strValue || null
          break
        case 'fb_ads_notes':
        case 'fb_notes':
          lead.fb_ads_notes = strValue || null
          break
        case 'pixel_status':
        case 'pixel':
          lead.pixel_status = strValue || null
          break
        case 'custom_notes':
        case 'notes':
          lead.custom_notes = strValue || null
          break
        case 'quick_question':
        case 'quickquestion':
        case 'question':
          lead.quick_question = strValue || null
          break
        case 'next_follow_up':

        case 'next_followup':
        case 'follow_up':
          lead.next_follow_up = strValue || null
          break
        case 'video_link':
        case 'video':
          lead.video_link = strValue || null
          break
        case 'image_link':
        case 'image':
          lead.image_link = strValue || null
          break
        default: {

          // Handle numbered columns like "positive_point_1", "improvements_3", etc.

          const positiveMatch = header.match(/^positive_?points?_?(\d+)$/)
          if (positiveMatch) {
            const num = parseInt(positiveMatch[1])
            if (num >= 1 && num <= 10 && strValue) {
              positiveParts[num - 1] = strValue
            }
            continue
          }
          const improvementMatch = header.match(/^improvements?_?(\d+)$/)
          if (improvementMatch) {
            const num = parseInt(improvementMatch[1])
            if (num >= 1 && num <= 10 && strValue) {
              improvementParts[num - 1] = strValue
            }
            continue
          }
          break
        }
      }
    }

    // Merge numbered parts into the main fields if they exist
    if (positiveParts.length > 0) {
      const merged = positiveParts.filter(p => p !== undefined && p !== '').join('\n')
      if (merged) {
        lead.positive_points = lead.positive_points
          ? lead.positive_points + '\n' + merged
          : merged
      }
    }
    if (improvementParts.length > 0) {
      const merged = improvementParts.filter(p => p !== undefined && p !== '').join('\n')
      if (merged) {
        lead.improvements = lead.improvements
          ? lead.improvements + '\n' + merged
          : merged
      }
    }

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

// Split a string into N parts by newlines or numbered separators
function splitIntoParts(text: string, count: number): string[] {
  const parts: string[] = []
  // Try splitting by newlines first
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  if (lines.length >= count) {
    // If we have enough lines, take first N
    for (let i = 0; i < count; i++) {
      parts.push(lines[i] || '')
    }
  } else if (lines.length > 1) {
    // Multiple lines but fewer than count - distribute
    for (let i = 0; i < count; i++) {
      parts.push(lines[i] || '')
    }
  } else {
    // Single line or empty - put everything in first part
    parts.push(text)
    for (let i = 1; i < count; i++) {
      parts.push('')
    }
  }
  
  return parts
}

function isValidPipelineStage(value: string): boolean {
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

function isValidLeadType(value: string): value is LeadType {
  return ['lead', 'customer'].includes(value.toLowerCase())
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
