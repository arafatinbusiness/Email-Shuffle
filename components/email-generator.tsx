'use client'

import { useState } from 'react'
import { Lead, LeadLayer, LAYER_DESCRIPTIONS } from '@/lib/types'
import { generateEmailTemplate, getNextLayer, getFollowUpDays } from '@/lib/email-templates'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Copy, Check, Send, Clock, ChevronRight, Save, PenLine } from 'lucide-react'
import { addDays, format } from 'date-fns'
import { toast } from 'sonner'

interface EmailGeneratorProps {
  lead: Lead
  onLayerChange: (layer: LeadLayer) => void
  onMarkSent: () => void
  onSaveTemplate?: (layer: LeadLayer, subject: string, body: string) => Promise<void>
  onSaveCustomEmail?: (subject: string, body: string) => Promise<void>
}

export function EmailGenerator({ lead, onLayerChange, onMarkSent, onSaveTemplate, onSaveCustomEmail }: EmailGeneratorProps) {
  const [activeLayer, setActiveLayer] = useState<string>(lead.current_layer)
  const [copiedField, setCopiedField] = useState<'subject' | 'body' | null>(null)
  const [customSubject, setCustomSubject] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const template = generateEmailTemplate(lead, activeLayer as LeadLayer)
  const subject = customSubject || template.subject
  const body = customBody || template.body

  const handleCopy = async (text: string, field: 'subject' | 'body') => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleTabChange = (value: string) => {
    setActiveLayer(value)
    setCustomSubject('')
    setCustomBody('')
  }

  const handleSave = async () => {
    if (!onSaveTemplate) return
    setIsSaving(true)
    try {
      await onSaveTemplate(activeLayer as LeadLayer, subject, body)
      toast.success(`Template saved for ${activeLayer}`)
    } catch {
      toast.error('Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveCustom = async () => {
    if (!onSaveCustomEmail) return
    if (!customSubject.trim() && !customBody.trim()) {
      toast.error('Please write a subject and body first')
      return
    }
    setIsSaving(true)
    try {
      await onSaveCustomEmail(customSubject, customBody)
      toast.success('Custom email saved to history')
    } catch {
      toast.error('Failed to save custom email')
    } finally {
      setIsSaving(false)
    }
  }

  const nextLayer = getNextLayer(activeLayer as LeadLayer)
  const suggestedFollowUp = format(addDays(new Date(), getFollowUpDays(activeLayer === 'L1' ? 'L2' : activeLayer as LeadLayer)), 'MMM d, yyyy')

  return (
    <div className="space-y-4">
      <Tabs value={activeLayer} onValueChange={handleTabChange}>
        <TabsList className="grid grid-cols-6 w-full">
          {(['L1', 'L2', 'L3', 'L4', 'L5+'] as LeadLayer[]).map((layer) => (
            <TabsTrigger
              key={layer}
              value={layer}
              className="text-xs sm:text-sm"
            >
              {layer}
            </TabsTrigger>
          ))}
          <TabsTrigger value="custom" className="text-xs sm:text-sm">
            <PenLine className="h-3 w-3 mr-1" />
            Custom
          </TabsTrigger>
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

        {/* Custom Email Tab */}
        <TabsContent value="custom" className="space-y-4 mt-4">
          <Card className="border-emerald-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-emerald-500" />
                    Custom Email
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Write a completely custom email from scratch. No template needed.
                  </CardDescription>
                </div>
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
                  onClick={() => handleCopy(customSubject, 'subject')}
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
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="min-h-[40px] resize-none"
                rows={1}
                placeholder="Enter your custom subject line..."
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
                  onClick={() => handleCopy(customBody, 'body')}
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
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                className="min-h-[200px]"
                rows={10}
                placeholder="Write your custom email here..."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          onClick={onMarkSent}
          className="flex-1"
        >
          <Send className="h-4 w-4 mr-2" />
          Mark Email as Sent
        </Button>
        {activeLayer !== 'custom' && nextLayer && (
          <Button
            variant="outline"
            onClick={() => onLayerChange(nextLayer)}
            className="flex-1"
          >
            Move to {nextLayer}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
        {activeLayer !== 'custom' && onSaveTemplate && (
          <Button
            variant="secondary"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        )}
        {activeLayer === 'custom' && onSaveCustomEmail && (
          <Button
            variant="secondary"
            onClick={handleSaveCustom}
            disabled={isSaving}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Custom Email'}
          </Button>
        )}
      </div>
      
      {activeLayer !== 'custom' && (
        <p className="text-xs text-muted-foreground text-center">
          Suggested next follow-up: {suggestedFollowUp}
        </p>
      )}
    </div>
  )
}
