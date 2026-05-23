export type LeadStatus = 'cold' | 'contacted' | 'replied' | 'converted' | 'dead'
export type LeadLayer = 'L1' | 'L2' | 'L3' | 'L4' | 'L5+'
export type LeadPriority = 'high' | 'medium' | 'low'
export type LeadIntent = 'cold-outreach' | 'follow-up' | 'closing' | 're-engagement'
export type LeadType = 'lead' | 'customer'

export interface Lead {
  id: number
  first_name: string
  last_name: string | null
  email: string
  company_name: string | null
  website: string | null
  group_id: number | null
  group_name: string | null
  status: LeadStatus
  current_layer: LeadLayer
  priority: LeadPriority | null
  intent: LeadIntent | null
  lead_type: LeadType
  positive_points: string | null
  improvements: string | null
  video_link: string | null
  image_link: string | null
  fb_ads_notes: string | null


  pixel_status: string | null
  custom_notes: string | null
  current_website_updates: string | null
  last_email_sent: string | null
  next_follow_up: string | null
  created_at: string
  updated_at: string
}



export interface EmailHistory {
  id: number
  lead_id: number
  user_id: number
  layer: string
  subject: string
  body: string
  generated_at: string
}

export interface EmailTemplate {
  subject: string
  body: string
}

export const LAYER_DESCRIPTIONS: Record<LeadLayer, { name: string; description: string; timing: string }> = {
  'L1': {
    name: 'First Contact',
    description: 'Cold outreach - short introduction, personalized observation, soft value pitch',
    timing: 'Day 0'
  },
  'L2': {
    name: 'Follow-up',
    description: 'Reminder of previous message, slightly stronger value angle',
    timing: '+2 days'
  },
  'L3': {
    name: 'Strong Follow-up',
    description: 'Clearer urgency, stronger persuasion, highlight missed opportunity',
    timing: '+4-5 days'
  },
  'L4': {
    name: 'Break-up Email',
    description: 'Polite exit message, no pressure, keeps door open',
    timing: '+7-10 days'
  },
  'L5+': {
    name: 'Final Persuasion',
    description: 'Strongest attempt, emotional or value-driven closing',
    timing: 'Long gap / Final attempt'
  }
}

export const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bgColor: string }> = {
  'cold': { label: 'Cold', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  'contacted': { label: 'Contacted', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  'replied': { label: 'Replied', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  'converted': { label: 'Converted', color: 'text-green-400', bgColor: 'bg-green-500/10' },
  'dead': { label: 'Dead', color: 'text-red-400', bgColor: 'bg-red-500/10' }
}

export const PRIORITY_CONFIG: Record<LeadPriority, { label: string; color: string; bgColor: string; order: number }> = {
  'high': { label: 'High', color: 'text-red-400', bgColor: 'bg-red-500/10', order: 0 },
  'medium': { label: 'Medium', color: 'text-amber-400', bgColor: 'bg-amber-500/10', order: 1 },
  'low': { label: 'Low', color: 'text-slate-400', bgColor: 'bg-slate-500/10', order: 2 },
}

export const INTENT_LABELS: Record<LeadIntent, { label: string; description: string }> = {
  'cold-outreach': { label: 'Cold Outreach', description: 'First contact, introduction phase' },
  'follow-up': { label: 'Follow-up', description: 'Nurturing, building relationship' },
  'closing': { label: 'Closing Attempt', description: 'Strong push, conversion focus' },
  're-engagement': { label: 'Re-engagement', description: 'Winning back inactive leads' },
}

export const LEAD_TYPE_CONFIG: Record<LeadType, { label: string; color: string; bgColor: string }> = {
  'lead': { label: 'Lead', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  'customer': { label: 'Customer', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
}
