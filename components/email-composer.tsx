'use client'

import { useState, useEffect } from 'react'
import { RichTextEditor } from './rich-text-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Send,
  Clock,
  Calendar,
  Save,
  FileText,
  Variable,
  Loader2,
  Check,
  X,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'

interface EmailComposerProps {
  to?: string
  leadName?: string
  leadId?: number
  onSent?: () => void
  onClose?: () => void
}

interface Template {
  id: number
  name: string
  subject: string
  body: string
  category: string
}

export function EmailComposer({ to, leadName, leadId, onSent, onClose }: EmailComposerProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [recipientEmail, setRecipientEmail] = useState(to || '')
  const [sendType, setSendType] = useState<'instant' | 'scheduled' | 'random_gap'>('instant')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [gapMinutes, setGapMinutes] = useState(3)
  const [isSending, setIsSending] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [importColumns, setImportColumns] = useState<string[]>([])
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [showPersonalizeDialog, setShowPersonalizeDialog] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateCategory, setTemplateCategory] = useState('general')

  // Load templates and import columns
  useEffect(() => {
    fetchTemplates()
    fetchImportColumns()
  }, [])

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    }
  }

  const fetchImportColumns = async () => {
    try {
      const res = await fetch('/api/import-columns')
      if (res.ok) {
        const data = await res.json()
        setImportColumns(data)
      }
    } catch (error) {
      console.error('Failed to fetch import columns:', error)
    }
  }

  // Apply a template
  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id.toString() === templateId)
    if (template) {
      setSubject(template.subject)
      setBody(template.body)
      setShowTemplateDialog(false)
      toast.success(`Template "${template.name}" applied`)
    }
  }

  // Insert personalization field at cursor position
  const insertPersonalization = (field: string) => {
    const tag = `{{${field}}}`
    setBody(prev => prev + tag)
    setShowPersonalizeDialog(false)
    toast.success(`Added {{${field}}} field`)
  }

  // Send the email
  const handleSend = async () => {
    if (!recipientEmail) {
      toast.error('Please enter a recipient email')
      return
    }
    if (!subject) {
      toast.error('Please enter a subject')
      return
    }
    if (!body) {
      toast.error('Please write an email body')
      return
    }

    setIsSending(true)
    try {
      const payload: any = {
        to: recipientEmail,
        subject,
        body,
        send_type: sendType,
      }

      if (sendType === 'scheduled') {
        if (!scheduledDate || !scheduledTime) {
          toast.error('Please select a date and time for scheduled send')
          setIsSending(false)
          return
        }
        payload.scheduled_at = `${scheduledDate}T${scheduledTime}:00`
      }

      if (sendType === 'random_gap') {
        payload.gap_minutes = gapMinutes
      }

      if (leadId) {
        payload.lead_id = leadId
      }

      // If it's a single email, use the mailbox send endpoint
      const res = await fetch('/api/mailbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send email')
      }

      toast.success('Email sent successfully!')
      
      // Save as template if requested
      if (saveAsTemplate && templateName) {
        await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: templateName,
            subject,
            body,
            category: templateCategory,
          }),
        })
      }

      // Reset form
      setSubject('')
      setBody('')
      setRecipientEmail('')
      setSaveAsTemplate(false)
      setTemplateName('')
      onSent?.()
      onClose?.()
    } catch (error: any) {
      toast.error(error.message || 'Failed to send email')
    } finally {
      setIsSending(false)
    }
  }

  // Delete a template
  const deleteTemplate = async (id: number) => {
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id))
        toast.success('Template deleted')
      }
    } catch (error) {
      toast.error('Failed to delete template')
    }
  }

  return (
    <div className="space-y-4">
      {/* Recipient */}
      <div>
        <Label htmlFor="recipient">To</Label>
        <Input
          id="recipient"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="recipient@example.com"
          className="mt-1"
        />
      </div>

      {/* Subject with template selector */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label htmlFor="subject">Subject</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplateDialog(true)}
              className="text-xs"
            >
              <FileText className="h-3 w-3 mr-1" />
              Templates
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPersonalizeDialog(true)}
              className="text-xs"
            >
              <Variable className="h-3 w-3 mr-1" />
              Personalize
            </Button>
          </div>
        </div>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject..."
          className="mt-1"
        />
      </div>

      {/* Rich Text Editor for body */}
      <div>
        <Label className="mb-1 block">Email Body</Label>
        <RichTextEditor
          content={body}
          onChange={setBody}
          placeholder="Write your email here... Use {{first_name}}, {{company}}, etc. for personalization"
          minHeight="250px"
        />
      </div>

      {/* Send Options */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={sendType} onValueChange={(v) => setSendType(v as any)}>
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="instant" className="text-xs">
                <Send className="h-3 w-3 mr-1" />
                Send Now
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Schedule
              </TabsTrigger>
              <TabsTrigger value="random_gap" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Random Gap
              </TabsTrigger>
            </TabsList>

            <TabsContent value="instant" className="mt-2">
              <p className="text-xs text-muted-foreground">
                Email will be sent immediately when you click Send.
              </p>
            </TabsContent>

            <TabsContent value="scheduled" className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Time</Label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="random_gap" className="mt-2 space-y-2">
              <div>
                <Label className="text-xs">Gap between emails (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={gapMinutes}
                  onChange={(e) => setGapMinutes(parseInt(e.target.value) || 3)}
                  className="mt-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                When sending multiple emails, each will be sent with this gap in minutes.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Save as template option */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="save-template"
          checked={saveAsTemplate}
          onChange={(e) => setSaveAsTemplate(e.target.checked)}
          className="rounded border-gray-300"
        />
        <Label htmlFor="save-template" className="text-sm cursor-pointer">
          Save as template after sending
        </Label>
      </div>
      {saveAsTemplate && (
        <div className="flex gap-2">
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name..."
            className="flex-1"
          />
          <Select value={templateCategory} onValueChange={setTemplateCategory}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="cold-outreach">Cold Outreach</SelectItem>
              <SelectItem value="follow-up">Follow-up</SelectItem>
              <SelectItem value="closing">Closing</SelectItem>
              <SelectItem value="re-engagement">Re-engagement</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleSend}
          disabled={isSending}
          className="flex-1"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {sendType === 'instant' ? 'Send Now' : sendType === 'scheduled' ? 'Schedule Send' : 'Queue with Gap'}
            </>
          )}
        </Button>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        )}
      </div>

      {/* Template Selection Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Templates</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No templates yet. Save an email as a template to reuse it later.
              </p>
            ) : (
              templates.map((template) => (
                <Card key={template.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.category} • {template.subject.substring(0, 60)}...
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => applyTemplate(template.id.toString())}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Use
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTemplate(template.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Personalization Field Dialog */}
      <Dialog open={showPersonalizeDialog} onOpenChange={setShowPersonalizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Personalization Field</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              Select a field to insert into your email. The field will be replaced with the actual value when sending.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => insertPersonalization('first_name')}
              >
                <Variable className="h-3 w-3 mr-2" />
                First Name
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => insertPersonalization('last_name')}
              >
                <Variable className="h-3 w-3 mr-2" />
                Last Name
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => insertPersonalization('full_name')}
              >
                <Variable className="h-3 w-3 mr-2" />
                Full Name
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => insertPersonalization('email')}
              >
                <Variable className="h-3 w-3 mr-2" />
                Email
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => insertPersonalization('company')}
              >
                <Variable className="h-3 w-3 mr-2" />
                Company
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => insertPersonalization('company_name')}
              >
                <Variable className="h-3 w-3 mr-2" />
                Company Name
              </Button>
            </div>

            {/* Custom columns from import */}
            {importColumns.length > 0 && (
              <>
                <div className="border-t pt-2 mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Imported Columns
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {importColumns.map((col) => (
                      <Badge
                        key={col}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent"
                        onClick={() => insertPersonalization(col)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {col}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
