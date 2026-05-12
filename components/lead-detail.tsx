'use client'

import { Lead, LeadLayer, STATUS_CONFIG, LAYER_DESCRIPTIONS } from '@/lib/types'
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
} from 'lucide-react'
import { format } from 'date-fns'

interface LeadDetailProps {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onUpdate: (updates: Partial<Lead>) => Promise<void>
}

export function LeadDetail({ lead, open, onOpenChange, onEdit, onUpdate }: LeadDetailProps) {
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
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="email" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Email Generator
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
            />
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

            {(lead.positive_points || lead.improvements || lead.custom_notes) && (
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
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
