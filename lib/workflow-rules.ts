import { Lead, LeadLayer, LeadPriority, LeadIntent, INTENT_LABELS } from './types'

// Suggested wait times between layers (user decides when to actually follow up)
export const SUGGESTED_WAIT_DAYS: Record<LeadLayer, number> = {
  'L1': 2,   // Suggest L2 after ~2 days
  'L2': 3,   // Suggest L3 after ~3 days
  'L3': 5,   // Suggest L4 after ~5 days
  'L4': 7,   // Suggest L5 after ~7 days
  'L5+': 14, // Suggest re-engagement after ~14 days
}

// Alias for backward compatibility
export const TYPICAL_LAYER_INTERVALS = SUGGESTED_WAIT_DAYS

// Calculate next follow-up date based on current layer
export function calculateNextFollowUp(currentLayer: LeadLayer): Date {
  const days = SUGGESTED_WAIT_DAYS[currentLayer] || 2
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

// What the next layer would be (for display/suggestion only)
export const NEXT_LAYER: Record<LeadLayer, LeadLayer> = {
  'L1': 'L2',
  'L2': 'L3',
  'L3': 'L4',
  'L4': 'L5+',
  'L5+': 'L5+',
}

export type ActionPriority = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'none'

export interface LeadAction {
  lead: Lead
  priority: ActionPriority
  reason: string        // "Why this lead, why now?" - the key clarity layer
  contextNote: string   // Brief context about last interaction
  suggestedLayer: LeadLayer
  daysOverdue: number
  daysSinceLastActivity: number
}

// Generate a smart, contextual reason for why this lead needs attention
function generateReason(lead: Lead, daysSinceLastActivity: number, daysOverdue: number): string {
  const layer = lead.current_layer
  const name = lead.first_name

  // Converted or dead
  if (lead.status === 'converted') return `${name} - Lead converted ✓`
  if (lead.status === 'dead') return `${name} - Lead marked as dead ✗`

  // New lead, never contacted
  if (lead.status === 'cold' && layer === 'L1') {
    return `New lead - Send first contact to ${name}`
  }

  // Based on layer context
  const layerContext: Record<LeadLayer, string> = {
    'L1': `First contact sent to ${name} - No reply yet`,
    'L2': `Follow-up #1 - ${name} hasn't responded after L1`,
    'L3': `Follow-up #2 - ${name} hasn't responded after L2`,
    'L4': `Break-up phase - Last attempt with ${name}`,
    'L5+': `Final attempt - Re-engage ${name} or move on`,
  }

  const baseReason = layerContext[layer]

  // Add urgency context
  if (daysOverdue > 0) {
    const urgency = daysOverdue <= 3 ? '⚠️ Overdue' : '🔴 Significantly overdue'
    return `${urgency} - ${baseReason}`
  }

  // Add inactivity context
  if (daysSinceLastActivity >= 14) {
    return `🕸️ Stale lead (${daysSinceLastActivity}d inactive) - ${baseReason}`
  }

  if (daysSinceLastActivity >= 7) {
    return `⏰ Been a while (${daysSinceLastActivity}d) - ${baseReason}`
  }

  return baseReason
}

// Generate a one-line context note about last interaction
function generateContextNote(lead: Lead): string {
  if (lead.status === 'cold' && lead.current_layer === 'L1') {
    return 'No prior contact - fresh lead'
  }

  if (lead.last_email_sent) {
    const sentDate = new Date(lead.last_email_sent)
    const dateStr = sentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `Last contacted: ${dateStr} (${lead.current_layer})`
  }

  return `Added ${new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

// Shows what the user needs to see - NO automatic actions
export function getLeadAction(lead: Lead): LeadAction {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Calculate days since last activity (for display only)
  const lastActivity = lead.last_email_sent ? new Date(lead.last_email_sent) : new Date(lead.created_at)
  const daysSinceLastActivity = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))

  // Skip converted or dead leads
  if (lead.status === 'converted' || lead.status === 'dead') {
    return {
      lead,
      priority: 'none',
      reason: generateReason(lead, daysSinceLastActivity, 0),
      contextNote: generateContextNote(lead),
      suggestedLayer: lead.current_layer,
      daysOverdue: 0,
      daysSinceLastActivity,
    }
  }

  // If no follow-up date set
  if (!lead.next_follow_up) {
    // New lead at L1 - suggest sending first email
    if (lead.status === 'cold' && lead.current_layer === 'L1') {
      return {
        lead,
        priority: 'today',
        reason: generateReason(lead, daysSinceLastActivity, 0),
        contextNote: generateContextNote(lead),
        suggestedLayer: 'L1',
        daysOverdue: 0,
        daysSinceLastActivity,
      }
    }
    // No follow-up scheduled - show in upcoming
    return {
      lead,
      priority: 'upcoming',
      reason: generateReason(lead, daysSinceLastActivity, 0),
      contextNote: generateContextNote(lead),
      suggestedLayer: lead.current_layer,
      daysOverdue: 0,
      daysSinceLastActivity,
    }
  }

  const followUpDate = new Date(lead.next_follow_up)
  followUpDate.setHours(0, 0, 0, 0)
  
  const daysOverdue = Math.floor((today.getTime() - followUpDate.getTime()) / (1000 * 60 * 60 * 24))

  if (daysOverdue > 0) {
    return {
      lead,
      priority: 'overdue',
      reason: generateReason(lead, daysSinceLastActivity, daysOverdue),
      contextNote: generateContextNote(lead),
      suggestedLayer: lead.current_layer,
      daysOverdue,
      daysSinceLastActivity,
    }
  }

  if (followUpDate.getTime() === today.getTime()) {
    return {
      lead,
      priority: 'today',
      reason: generateReason(lead, daysSinceLastActivity, 0),
      contextNote: generateContextNote(lead),
      suggestedLayer: lead.current_layer,
      daysOverdue: 0,
      daysSinceLastActivity,
    }
  }

  if (followUpDate.getTime() === tomorrow.getTime()) {
    return {
      lead,
      priority: 'tomorrow',
      reason: generateReason(lead, daysSinceLastActivity, 0),
      contextNote: generateContextNote(lead),
      suggestedLayer: lead.current_layer,
      daysOverdue: 0,
      daysSinceLastActivity,
    }
  }

  return {
    lead,
    priority: 'upcoming',
    reason: generateReason(lead, daysSinceLastActivity, 0),
    contextNote: generateContextNote(lead),
    suggestedLayer: lead.current_layer,
    daysOverdue: 0,
    daysSinceLastActivity,
  }
}

// Simply organizes leads by urgency for display
export function sortLeadsByPriority(leads: Lead[]): LeadAction[] {
  const actions = leads.map(getLeadAction)
  
  const priorityOrder: Record<ActionPriority, number> = {
    'overdue': 0,
    'today': 1,
    'tomorrow': 2,
    'upcoming': 3,
    'none': 4,
  }

  return actions.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    
    // Within same priority, sort by manual priority (high first)
    const manualPriorityOrder: Record<string, number> = { 'high': 0, 'medium': 1, 'low': 2 }
    const aPriority = a.lead.priority || 'medium'
    const bPriority = b.lead.priority || 'medium'
    const manualDiff = (manualPriorityOrder[aPriority] || 1) - (manualPriorityOrder[bPriority] || 1)
    if (manualDiff !== 0) return manualDiff
    
    return b.daysOverdue - a.daysOverdue
  })
}

export function getPipelineStats(leads: Lead[]) {
  const layers: Record<LeadLayer, number> = { 'L1': 0, 'L2': 0, 'L3': 0, 'L4': 0, 'L5+': 0 }
  
  leads.forEach(lead => {
    if (lead.status !== 'converted' && lead.status !== 'dead') {
      layers[lead.current_layer]++
    }
  })
  
  return layers
}

// Auto-suggest intent based on lead state
export function suggestIntent(lead: Lead): LeadIntent {
  if (lead.status === 'cold' && lead.current_layer === 'L1') return 'cold-outreach'
  if (lead.current_layer === 'L4') return 'closing'
  if (lead.current_layer === 'L5+') return 're-engagement'
  if (lead.status === 'contacted' || lead.status === 'replied') return 'follow-up'
  return 'cold-outreach'
}
