'use client'

import { Lead, STATUS_CONFIG, LAYER_DESCRIPTIONS, PRIORITY_CONFIG, INTENT_LABELS } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Flag, Target, Mail, Calendar } from 'lucide-react'
import { format } from 'date-fns'

interface PipelineViewProps {
  leads: Lead[]
}

export function PipelineView({ leads }: PipelineViewProps) {
  const stages = ['cold', 'contacted', 'replied', 'converted', 'dead'] as const

  const getLeadsByStatus = (status: string) => leads.filter(l => l.status === status)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Pipeline Overview</h2>
        <p className="text-sm text-muted-foreground">
          {leads.length} total leads across {stages.length} stages
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {stages.map((status) => {
          const stageLeads = getLeadsByStatus(status)
          const config = STATUS_CONFIG[status]

          return (
            <Card key={status} className="border-t-4" style={{ borderTopColor: `var(--${config.color.replace('text-', '')})` }}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${config.bgColor}`} />
                    {config.label}
                  </CardTitle>
                  <Badge variant="outline">{stageLeads.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                {stageLeads.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No leads</p>
                ) : (
                  stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-2 rounded-lg bg-muted/50 border border-border text-xs space-y-1"
                    >
                      <p className="font-medium truncate">
                        {lead.first_name} {lead.last_name}
                      </p>
                      <p className="text-muted-foreground truncate">{lead.company_name || lead.email}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {lead.current_layer}
                        </Badge>
                        {lead.priority && (
                          <span className={`text-[10px] ${
                            lead.priority === 'high' ? 'text-red-400' :
                            lead.priority === 'medium' ? 'text-amber-400' :
                            'text-slate-400'
                          }`}>
                            <Flag className="h-2.5 w-2.5 inline mr-0.5" />
                            {PRIORITY_CONFIG[lead.priority].label}
                          </span>
                        )}
                        {lead.intent && (
                          <span className="text-[10px] text-muted-foreground">
                            <Target className="h-2.5 w-2.5 inline mr-0.5" />
                            {INTENT_LABELS[lead.intent].label}
                          </span>
                        )}
                      </div>
                      {lead.next_follow_up && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Calendar className="h-2.5 w-2.5" />
                          {format(new Date(lead.next_follow_up), 'MMM d')}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
