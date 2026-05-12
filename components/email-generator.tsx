'use client'

import { useState } from 'react'
import { Lead, LeadLayer, LAYER_DESCRIPTIONS } from '@/lib/types'
import { generateEmailTemplate, getNextLayer, getFollowUpDays } from '@/lib/email-templates'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Copy, Check, Send, Clock, ChevronRight } from 'lucide-react'
import { addDays, format } from 'date-fns'

interface EmailGeneratorProps {
  lead: Lead
  onLayerChange: (layer: LeadLayer) => void
  onMarkSent: () => void
}

export function EmailGenerator({ lead, onLayerChange, onMarkSent }: EmailGeneratorProps) {
  const [activeLayer, setActiveLayer] = useState<LeadLayer>(lead.current_layer)
  const [copiedField, setCopiedField] = useState<'subject' | 'body' | null>(null)
  const [customSubject, setCustomSubject] = useState('')
  const [customBody, setCustomBody] = useState('')

  const template = generateEmailTemplate(lead, activeLayer)
  const subject = customSubject || template.subject
  const body = customBody || template.body

  const handleCopy = async (text: string, field: 'subject' | 'body') => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleTabChange = (value: string) => {
    setActiveLayer(value as LeadLayer)
    setCustomSubject('')
    setCustomBody('')
  }

  const nextLayer = getNextLayer(activeLayer)
  const suggestedFollowUp = format(addDays(new Date(), getFollowUpDays(activeLayer === 'L1' ? 'L2' : activeLayer)), 'MMM d, yyyy')

  return (
    <div className="space-y-4">
      <Tabs value={activeLayer} onValueChange={handleTabChange}>
        <TabsList className="grid grid-cols-5 w-full">
          {(['L1', 'L2', 'L3', 'L4', 'L5+'] as LeadLayer[]).map((layer) => (
            <TabsTrigger
              key={layer}
              value={layer}
              className="text-xs sm:text-sm"
            >
              {layer}
            </TabsTrigger>
          ))}
        </TabsList>

        {(['L1', 'L2', 'L3', 'L4', 'L5+'] as LeadLayer[]).map((layer) => (
          <TabsContent key={layer} value={layer} className="space-y-4 mt-4">
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{LAYER_DESCRIPTIONS[layer].name}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {LAYER_DESCRIPTIONS[layer].description}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {LAYER_DESCRIPTIONS[layer].timing}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Subject Line</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(subject, 'subject')}
                  >
                    {copiedField === 'subject' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-1.5">Copy</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={subject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="min-h-[40px] resize-none"
                  rows={1}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Email Body</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(body, 'body')}
                  >
                    {copiedField === 'body' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-1.5">Copy</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={body}
                  onChange={(e) => setCustomBody(e.target.value)}
                  className="min-h-[200px]"
                  rows={10}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          onClick={onMarkSent}
          className="flex-1"
        >
          <Send className="h-4 w-4 mr-2" />
          Mark Email as Sent
        </Button>
        {nextLayer && (
          <Button
            variant="outline"
            onClick={() => onLayerChange(nextLayer)}
            className="flex-1"
          >
            Move to {nextLayer}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        Suggested next follow-up: {suggestedFollowUp}
      </p>
    </div>
  )
}
