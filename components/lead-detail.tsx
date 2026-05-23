'use client'

import { useState, useEffect } from 'react'
import { Lead, LeadLayer, STATUS_CONFIG, LAYER_DESCRIPTIONS, LEAD_TYPE_CONFIG } from '@/lib/types'
import { EmailGenerator } from './email-generator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Mail,
  Building2,
  Globe,
  Calendar,
  Edit,
  ExternalLink,
  MessageSquare,
  User,
  FileText,
  History,
  Send,
  Inbox,
  Loader2,
  Clock,
} from 'lucide-react'
import { format } from 'date-fns'

interface LeadDetailProps {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onUpdate: (updates: Partial<Lead>) => Promise<void>
  initialTemplate?: { subject: string; body: string } | null
}

interface EmailHistoryItem {
  id: number
  lead_id: number
  user_id: number
  layer: string
  subject: string
  body: string
  generated_at: string
}

interface EmailMessageItem {
  id: number
  thread_id: number
  direction: 'incoming' | 'outgoing'
  subject: string
  body: string
  sender: string
  recipient: string
  message_id: string
  is_read: boolean
  sent_at: string
  sync_state: string
  lead_id: number
}

export function LeadDetail({ lead, open, onOpenChange, onEdit, onUpdate, initialTemplate }: LeadDetailProps) {
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([])
  const [emailMessages, setEmailMessages] = useState<EmailMessageItem[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  useEffect(() => {
    if (open && lead) {
      loadEmailHistory(lead.id)
    }
  }, [open, lead?.id])

  const loadEmailHistory = async (leadId: number) => {
    setIsLoadingHistory(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/emails`)
      if (res.ok) {
        const data = await res.json()
        setEmailHistory(data.history || [])
        setEmailMessages(data.messages || [])
      }
    } catch {
      console.error('Failed to load email history')
    } finally {
      setIsLoadingHistory(false)
    }
  }

  if (!lead) return null

  const statusConfig = STATUS_CONFIG[lead.status]
  const layerInfo = LAYER_DESCRIPTIONS[lead.current_layer]

  const handleLayerChange = async (layer: LeadLayer) => {
    await onUpdate({ current_layer: layer })
  }

  const handleMarkSent = async () => {
    await onUpdate({
      last_email_sent: new Date().toISOString(),
      status: lead.status === 'cold' ? 'contacted' : lead.status,
    })
  }

  const handleSaveTemplate = async (layer: LeadLayer, subject: string, body: string) => {
    // Save the custom subject/body as custom_notes for this lead
    await onUpdate({
      custom_notes: `[${layer} Template]\nSubject: ${subject}\n\n${body}`,
    })
  }

  const handleSaveCustomEmail = async (subject: string, body: string) => {
    // Save custom email to email_history via API
    try {
      const res = await fetch(`/api/leads/${lead.id}/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer: 'custom',
          subject,
          body,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      // Reload history
      loadEmailHistory(lead.id)
    } catch (error) {
      console.error('Failed to save custom email:', error)
      throw error
    }
  }

  // Group email history by layer
  const groupedHistory: Record<string, EmailHistoryItem[]> = {}
  for (const item of emailHistory) {
    const layer = item.layer || 'unknown'
    if (!groupedHistory[layer]) groupedHistory[layer] = []
    groupedHistory[layer].push(item)
  }

  // Layer display names
  const layerDisplayNames: Record<string, string> = {
    'L1': 'L1 - First Contact',
    'L2': 'L2 - Follow-up',
    'L3': 'L3 - Strong Follow-up',
    'L4': 'L4 - Break-up',
    'L5+': 'L5+ - Final Persuasion',
    'campaign': '📨 Campaign Email',
    'custom': '✏️ Custom Email',
  }

  const layerColors: Record<string, string> = {
    'L1': 'border-blue-500/30 bg-blue-500/5',
    'L2': 'border-amber-500/30 bg-amber-500/5',
    'L3': 'border-orange-500/30 bg-orange-500/5',
    'L4': 'border-red-500/30 bg-red-500/5',
    'L5+': 'border-purple-500/30 bg-purple-500/5',
    'campaign': 'border-emerald-500/30 bg-emerald-500/5',
    'custom': 'border-violet-500/30 bg-violet-500/5',
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl flex items-center gap-2">
                {lead.first_name} {lead.last_name}
                <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
                  <Edit className="h-4 w-4" />
                </Button>
              </SheetTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0`}>
                  {statusConfig.label}
                </Badge>
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {lead.current_layer} - {layerInfo.name}
                </Badge>
                {lead.lead_type === 'customer' && (
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/50 bg-emerald-500/10">
                    🤝 Customer
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="email" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Email Generator
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Email History
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Lead Details
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="mt-4">
            <EmailGenerator
              lead={lead}
              onLayerChange={handleLayerChange}
              onMarkSent={handleMarkSent}
              onSaveTemplate={handleSaveTemplate}
              onSaveCustomEmail={handleSaveCustomEmail}
              initialTemplate={initialTemplate}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Email History</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadEmailHistory(lead.id)}
                disabled={isLoadingHistory}
              >
                <Loader2 className={`h-3 w-3 mr-1 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : emailHistory.length === 0 && emailMessages.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No email history yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Emails sent via campaigns or saved from the generator will appear here
                </p>
              </div>
            ) : (
              <>
                {/* Email History from generator/campaigns */}
                {Object.entries(groupedHistory).map(([layer, items]) => (
                  <div key={layer} className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      {layerDisplayNames[layer] || layer}
                      <span className="text-[10px] text-muted-foreground/60">({items.length})</span>
                    </h4>
                    {items.map((item) => (
                      <Card key={item.id} className={`border ${layerColors[layer] || 'border-border'}`}>
                        <CardHeader className="pb-1 pt-2 px-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-medium truncate flex-1">
                              {item.subject}
                            </CardTitle>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                              {format(new Date(item.generated_at), 'MMM d, h:mm a')}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-2">
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                            {item.body}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ))}

                {/* Actual sent/received emails from mailbox */}
                {emailMessages.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Send className="h-3 w-3" />
                      Sent & Received Emails
                      <span className="text-[10px] text-muted-foreground/60">({emailMessages.length})</span>
                    </h4>
                    {emailMessages.map((msg) => (
                      <Card key={msg.id} className={`border ${
                        msg.direction === 'outgoing' 
                          ? 'border-blue-500/30 bg-blue-500/5' 
                          : 'border-green-500/30 bg-green-500/5'
                      }`}>
                        <CardHeader className="pb-1 pt-2 px-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {msg.direction === 'outgoing' ? (
                                <Send className="h-3 w-3 text-blue-500 shrink-0" />
                              ) : (
                                <Inbox className="h-3 w-3 text-green-500 shrink-0" />
                              )}
                              <CardTitle className="text-xs font-medium truncate">
                                {msg.subject}
                              </CardTitle>
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                              {format(new Date(msg.sent_at), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {msg.direction === 'outgoing' ? `To: ${msg.recipient}` : `From: ${msg.sender}`}
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-2">
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                            {msg.body}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="details" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-20">Email:</span>
                  <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                    {lead.email}
                  </a>
                </div>
                {lead.company_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.company_name}</span>
                  </div>
                )}
                {lead.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      {lead.website.replace(/^https?:\/\//, '')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {lead.video_link && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground w-20">Video:</span>
                    <a
                      href={lead.video_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      Watch Recording
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {lead.image_link && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground w-20">Image:</span>
                    <a
                      href={lead.image_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      View Screenshot
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>

              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Timeline

                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{format(new Date(lead.created_at), 'MMM d, yyyy')}</span>
                </div>
                {lead.last_email_sent && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Email:</span>
                    <span>{format(new Date(lead.last_email_sent), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                )}
                {lead.next_follow_up && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next Follow-up:</span>
                    <span>{format(new Date(lead.next_follow_up), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {(lead.positive_points || lead.improvements || lead.custom_notes || lead.quick_question) && (

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lead.positive_points && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Positive Points</p>
                      <p className="text-sm">{lead.positive_points}</p>
                    </div>
                  )}
                  {lead.improvements && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Improvements</p>
                      <p className="text-sm">{lead.improvements}</p>
                    </div>
                  )}
                  {lead.custom_notes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Custom Notes</p>
                      <p className="text-sm">{lead.custom_notes}</p>
                    </div>
                  )}
                  {lead.quick_question && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Quick Question</p>
                      <p className="text-sm">{lead.quick_question}</p>
                    </div>
                  )}
                </CardContent>

              </Card>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
