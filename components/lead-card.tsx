'use client'

import { useState, useEffect } from 'react'
import { Lead, LAYER_DESCRIPTIONS, PIPELINE_STAGE_CONFIG, PRIORITY_CONFIG, INTENT_LABELS, LEAD_TYPE_CONFIG } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, Calendar, Building2, Globe, MoreHorizontal, Flag, Target, FileText, Loader2, Video, Image } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { format, isToday, isPast, isTomorrow } from 'date-fns'
import { toast } from 'sonner'

interface Template {
  id: number
  name: string
  subject: string
  body: string
  category: string
}

interface LeadCardProps {
  lead: Lead
  onSelect: (lead: Lead) => void
  onDelete: (id: number) => void
  onUseTemplate?: (lead: Lead, template: Template) => void
  selected?: boolean
  onToggleSelect?: (id: number) => void
}

export function LeadCard({ lead, onSelect, onDelete, onUseTemplate, selected, onToggleSelect }: LeadCardProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const stageConfig = PIPELINE_STAGE_CONFIG[lead.pipeline_stage]
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

  const loadTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const res = await fetch('/api/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setLoadingTemplates(false)
    }
  }

  const handleUseTemplate = (e: React.MouseEvent, template: Template) => {
    e.stopPropagation()
    if (onUseTemplate) {
      onUseTemplate(lead, template)
    }
  }

  const handleOpenTemplates = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!showTemplates) {
      loadTemplates()
    }
    setShowTemplates(!showTemplates)
  }

  return (
    <Card 
      className={`group cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 bg-card border-border ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
      onClick={() => onSelect(lead)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {onToggleSelect && (
              <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected || false}
                  onChange={() => onToggleSelect(lead.id)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
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
              <div className="flex items-center gap-1.5 flex-wrap">
                {lead.video_link && (
                  <Video className="h-3 w-3 text-blue-400" />
                )}
                {lead.image_link && (
                  <Image className="h-3 w-3 text-green-400" />
                )}
                <Badge className={`${stageConfig.bgColor} ${stageConfig.color} border-0`}>
                  {stageConfig.label}
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
                {lead.group_name && (
                  <Badge variant="outline" className="text-xs text-violet-500 border-violet-500/50 bg-violet-500/10">
                    📁 {lead.group_name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <DropdownMenu open={showTemplates} onOpenChange={setShowTemplates}>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                {lead.first_name} {lead.last_name}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(lead); }}>
                <Mail className="h-4 w-4 mr-2" />
                View Details & Email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">Use Template</DropdownMenuLabel>
              {loadingTemplates ? (
                <div className="px-2 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  No templates found. Create one in Templates tab.
                </div>
              ) : (
                templates.map((template) => (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={(e) => handleUseTemplate(e, template)}
                    className="flex flex-col items-start py-2"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-xs font-medium truncate">{template.name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate w-full pl-5.5">
                      {template.subject.substring(0, 50)}{template.subject.length > 50 ? '...' : ''}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
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

