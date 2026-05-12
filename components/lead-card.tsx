'use client'

import { Lead, LAYER_DESCRIPTIONS, STATUS_CONFIG, PRIORITY_CONFIG, INTENT_LABELS, LEAD_TYPE_CONFIG } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, Calendar, Building2, Globe, MoreHorizontal, Flag, Target } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format, isToday, isPast, isTomorrow } from 'date-fns'

interface LeadCardProps {
  lead: Lead
  onSelect: (lead: Lead) => void
  onDelete: (id: number) => void
}

export function LeadCard({ lead, onSelect, onDelete }: LeadCardProps) {
  const statusConfig = STATUS_CONFIG[lead.status]
  const layerInfo = LAYER_DESCRIPTIONS[lead.current_layer]

  const getUrgencyLabel = () => {
    if (!lead.next_follow_up) return null
    const date = new Date(lead.next_follow_up)
    if (isPast(date) && !isToday(date)) return { label: 'Overdue', className: 'bg-red-500/20 text-red-400 border-red-500/30' }
    if (isToday(date)) return { label: 'Today', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
    if (isTomorrow(date)) return { label: 'Tomorrow', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
    return null
  }

  const urgency = getUrgencyLabel()

  return (
    <Card 
      className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 bg-card border-border"
      onClick={() => onSelect(lead)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground truncate">
                {lead.first_name} {lead.last_name}
              </h3>
              {urgency && (
                <Badge variant="outline" className={urgency.className}>
                  {urgency.label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">{lead.email}</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {lead.company_name && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span>{lead.company_name}</span>
                </div>
              )}
              {lead.website && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  <span className="truncate max-w-[150px]">
                    {lead.website.replace(/^https?:\/\//, '')}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0`}>
                {statusConfig.label}
              </Badge>
              <Badge variant="outline" className="border-primary/30 text-primary">
                {lead.current_layer} - {layerInfo.name}
              </Badge>
              {lead.priority && (
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    lead.priority === 'high' ? 'text-red-500 border-red-500/50 bg-red-500/10' :
                    lead.priority === 'medium' ? 'text-amber-500 border-amber-500/50 bg-amber-500/10' :
                    'text-slate-500 border-slate-500/50 bg-slate-500/10'
                  }`}
                >
                  <Flag className="h-3 w-3 mr-1" />
                  {PRIORITY_CONFIG[lead.priority].label}
                </Badge>
              )}
              {lead.intent && (
                <Badge variant="secondary" className="text-xs">
                  <Target className="h-3 w-3 mr-1" />
                  {INTENT_LABELS[lead.intent].label}
                </Badge>
              )}
              {lead.lead_type === 'customer' && (
                <Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500/50 bg-emerald-500/10">
                  🤝 Customer
                </Badge>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(lead); }}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
                className="text-destructive focus:text-destructive"
              >
                Delete Lead
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {lead.next_follow_up && (
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Follow-up: {format(new Date(lead.next_follow_up), 'MMM d, yyyy')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
