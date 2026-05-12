import { Lead, LeadLayer, EmailTemplate } from './types'

function getFirstName(lead: Lead): string {
  return lead.first_name || 'there'
}

function getCompanyReference(lead: Lead): string {
  if (lead.company_name) return lead.company_name
  if (lead.website) return lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return 'your business'
}

function getPositivePointsReference(lead: Lead): string {
  if (lead.positive_points) {
    return `I noticed ${lead.positive_points.toLowerCase()}.`
  }
  return 'I was impressed by what I saw on your website.'
}

function getImprovementsReference(lead: Lead): string {
  if (lead.improvements) {
    return lead.improvements
  }
  return 'enhance your online presence and drive better results'
}

export function generateEmailTemplate(lead: Lead, layer: LeadLayer): EmailTemplate {
  const firstName = getFirstName(lead)
  const company = getCompanyReference(lead)
  const positivePoints = getPositivePointsReference(lead)
  const improvements = getImprovementsReference(lead)

  switch (layer) {
    case 'L1':
      return {
        subject: `Quick thought about ${company}`,
        body: `Hi ${firstName},

${positivePoints}

I help businesses like ${company} ${improvements}.

Would you be open to a quick 15-minute call this week to explore if there's a fit?

Best regards`
      }

    case 'L2':
      return {
        subject: `Following up - ${company}`,
        body: `Hi ${firstName},

I wanted to follow up on my previous message about ${company}.

I understand you're busy, but I genuinely believe I can help you ${improvements}.

Do you have 10 minutes for a quick chat?

Best regards`
      }

    case 'L3':
      return {
        subject: `Don't miss out - ${company}`,
        body: `Hi ${firstName},

I've reached out a couple of times now, and I don't want you to miss out on what could be a game-changer for ${company}.

${positivePoints} However, I see a real opportunity to ${improvements}.

Companies similar to yours have seen significant results from this approach. Can we schedule a brief call?

Best regards`
      }

    case 'L4':
      return {
        subject: `Closing the loop - ${company}`,
        body: `Hi ${firstName},

I haven't heard back from you, and I completely understand - timing isn't always right.

I'll close the loop on my end, but if you ever want to explore how to ${improvements}, my door is always open.

Wishing you and ${company} all the best.

Take care`
      }

    case 'L5+':
      return {
        subject: `One last thought for ${company}`,
        body: `Hi ${firstName},

It's been a while since we last connected, and I wanted to reach out one more time.

${positivePoints}

I still believe there's a strong opportunity to ${improvements}. If circumstances have changed and you're ready to explore this, I'd love to reconnect.

Either way, I wish you continued success with ${company}.

Warm regards`
      }

    default:
      return {
        subject: `About ${company}`,
        body: `Hi ${firstName},

I wanted to reach out about ${company}.

Best regards`
      }
  }
}

export function getNextLayer(currentLayer: LeadLayer): LeadLayer | null {
  const layers: LeadLayer[] = ['L1', 'L2', 'L3', 'L4', 'L5+']
  const currentIndex = layers.indexOf(currentLayer)
  if (currentIndex === -1 || currentIndex === layers.length - 1) return null
  return layers[currentIndex + 1]
}

export function getFollowUpDays(layer: LeadLayer): number {
  switch (layer) {
    case 'L1': return 0
    case 'L2': return 2
    case 'L3': return 5
    case 'L4': return 10
    case 'L5+': return 14
    default: return 0
  }
}
