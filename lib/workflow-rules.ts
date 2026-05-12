import { Lead, LeadLayer } from './types'

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
  reason: string
  suggestedLayer: LeadLayer  // What layer to SUGGEST (user decides)
  daysOverdue: number
  daysSinceLastActivity: number
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
      reason: lead.status === 'converted' ? 'Lead converted' : 'Lead marked as dead',
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
        reason: 'New lead - consider sending first contact',
        suggestedLayer: 'L1',
        daysOverdue: 0,
        daysSinceLastActivity,
      }
    }
    // No follow-up scheduled - show in upcoming
    return {
      lead,
      priority: 'upcoming',
      reason: daysSinceLastActivity >= 10 
        ? `No activity for ${daysSinceLastActivity} days` 
        : 'No follow-up scheduled',
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
      reason: `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`,
      suggestedLayer: lead.current_layer,
      daysOverdue,
      daysSinceLastActivity,
    }
  }

  if (followUpDate.getTime() === today.getTime()) {
    return {
      lead,
      priority: 'today',
      reason: 'Follow-up due today',
      suggestedLayer: lead.current_layer,
      daysOverdue: 0,
      daysSinceLastActivity,
    }
  }

  if (followUpDate.getTime() === tomorrow.getTime()) {
    return {
      lead,
      priority: 'tomorrow',
      reason: 'Follow-up due tomorrow',
      suggestedLayer: lead.current_layer,
      daysOverdue: 0,
      daysSinceLastActivity,
    }
  }

  return {
    lead,
    priority: 'upcoming',
    reason: `Scheduled: ${followUpDate.toLocaleDateString()}`,
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
