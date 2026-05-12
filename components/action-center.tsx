'use client'

import { Lead } from '@/lib/types'
import { LeadAction, sortLeadsByPriority, ActionPriority, TYPICAL_LAYER_INTERVALS, NEXT_LAYER } from '@/lib/workflow-rules'
import { generateEmailTemplate } from '@/lib/email-templates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  AlertCircle, 
  Clock, 
  Calendar, 
  Copy, 
  ChevronRight,
  Mail,
  Building2,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

interface ActionCenterProps {
  leads: Lead[]
  onSelectLead: (lead: Lead) => void
  onUpdateLead: (lead: Lead) => void
}

export function ActionCenter({ leads, onSelectLead, onUpdateLead }: ActionCenterProps) {
  const sortedActions = sortLeadsByPriority(leads)
  
  const overdueActions = sortedActions.filter(a => a.priority === 'overdue')
  const todayActions = sortedActions.filter(a => a.priority === 'today')
  const tomorrowActions = sortedActions.filter(a => a.priority === 'tomorrow')
  const inactiveLeads = sortedActions.filter(a => a.daysSinceLastActivity >= 10 && a.priority !== 'none')

  const totalActionable = overdueActions.length + todayActions.length

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {totalActionable === 0 
                    ? "You're all caught up!" 
                    : `${totalActionable} lead${totalActionable > 1 ? 's' : ''} need${totalActionable === 1 ? 's' : ''} action`
                  }
                </h2>
                <p className="text-muted-foreground text-sm">
                  {overdueActions.length > 0 && `${overdueActions.length} overdue · `}
                  {todayActions.length > 0 && `${todayActions.length} due today · `}
                  {tomorrowActions.length > 0 && `${tomorrowActions.length} due tomorrow`}
                  {totalActionable === 0 && 'Check back later or add new leads'}
                </p>
              </div>
            </div>
            {inactiveLeads.length > 0 && (
              <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {inactiveLeads.length} inactive (10+ days)
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Tabs */}
      <Tabs defaultValue="today" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="overdue" className="relative">
            Overdue
            {overdueActions.length > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-xs">
                {overdueActions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="today" className="relative">
            Today
            {todayActions.length > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-primary text-xs">
                {todayActions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tomorrow">Tomorrow</TabsTrigger>
          <TabsTrigger value="inactive" className="relative">
            Inactive
            {inactiveLeads.length > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-amber-500 text-xs">
                {inactiveLeads.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overdue" className="space-y-3">
          {overdueActions.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="No overdue follow-ups" />
          ) : (
            overdueActions.map(action => (
              <ActionCard 
                key={action.lead.id} 
                action={action} 
                onSelect={onSelectLead}
                onUpdate={onUpdateLead}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="today" className="space-y-3">
          {todayActions.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="No actions due today" />
          ) : (
            todayActions.map(action => (
              <ActionCard 
                key={action.lead.id} 
                action={action} 
                onSelect={onSelectLead}
                onUpdate={onUpdateLead}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="tomorrow" className="space-y-3">
          {tomorrowActions.length === 0 ? (
            <EmptyState icon={Calendar} message="No actions due tomorrow" />
          ) : (
            tomorrowActions.map(action => (
              <ActionCard 
                key={action.lead.id} 
                action={action} 
                onSelect={onSelectLead}
                onUpdate={onUpdateLead}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="inactive" className="space-y-3">
          {inactiveLeads.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="No inactive leads" />
          ) : (
            inactiveLeads.map(action => (
              <ActionCard 
                key={action.lead.id} 
                action={action} 
                onSelect={onSelectLead}
                onUpdate={onUpdateLead}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p>{message}</p>
    </div>
  )
}

function ActionCard({ action, onSelect, onUpdate }: { 
  action: LeadAction
  onSelect: (lead: Lead) => void
  onUpdate: (lead: Lead) => void
}) {
  const { lead, priority, reason, suggestedLayer, daysSinceLastActivity } = action
  const [showEmail, setShowEmail] = useState(false)
  
  const email = generateEmailTemplate(lead, suggestedLayer)
  const nextLayer = NEXT_LAYER[lead.current_layer]
  const typicalInterval = TYPICAL_LAYER_INTERVALS[lead.current_layer]

  const copyEmail = () => {
    const fullEmail = `Subject: ${email.subject}\n\n${email.body}`
    navigator.clipboard.writeText(fullEmail)
    toast.success('Email copied to clipboard')
  }

  const copyBodyOnly = () => {
    navigator.clipboard.writeText(email.body)
    toast.success('Email body copied')
  }

  const priorityConfig: Record<ActionPriority, { color: string; icon: React.ElementType; bg: string }> = {
    'overdue': { color: 'text-red-500', icon: AlertCircle, bg: 'bg-red-500/10' },
    'today': { color: 'text-amber-500', icon: Clock, bg: 'bg-amber-500/10' },
    'tomorrow': { color: 'text-blue-500', icon: Calendar, bg: 'bg-blue-500/10' },
    'upcoming': { color: 'text-muted-foreground', icon: Calendar, bg: 'bg-muted' },
    'none': { color: 'text-muted-foreground', icon: CheckCircle2, bg: 'bg-muted' },
  }

  const config = priorityConfig[priority]
  const Icon = config.icon

  return (
    <Card className={`${config.bg} border-l-4 ${priority === 'overdue' ? 'border-l-red-500' : priority === 'today' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-full ${config.bg}`}>
              <Icon className={`h-4 w-4 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium truncate">
                  {lead.first_name} {lead.last_name}
                </h3>
                <Badge variant="outline" className="text-xs">
                  {suggestedLayer}
                </Badge>
                {daysSinceLastActivity >= 10 && (
                  <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/50">
                    {daysSinceLastActivity}d inactive
                  </Badge>
                )}
              </div>
              {lead.company_name && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3 w-3" />
                  {lead.company_name}
                </p>
              )}
              <p className={`text-sm mt-1 ${config.color}`}>
                {reason}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Last activity: {daysSinceLastActivity === 0 ? 'today' : `${daysSinceLastActivity}d ago`}
                {lead.current_layer !== 'L5+' && ` · Typical ${nextLayer} interval: ~${typicalInterval}d`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowEmail(!showEmail)}
            >
              <Mail className="h-4 w-4 mr-1" />
              {showEmail ? 'Hide' : 'Email'}
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onSelect(lead)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Expandable Email Preview */}
        {showEmail && (
          <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Subject</label>
              <p className="text-sm font-medium mt-1">{email.subject}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Body</label>
              <p className="text-sm mt-1 whitespace-pre-wrap bg-background/50 p-3 rounded-md max-h-48 overflow-y-auto">
                {email.body}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={copyEmail}>
                <Copy className="h-3 w-3 mr-1" />
                Copy Full Email
              </Button>
              <Button size="sm" variant="outline" onClick={copyBodyOnly}>
                Copy Body Only
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
