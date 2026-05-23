'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { RichTextEditor } from '@/components/rich-text-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Send,
  Clock,
  Loader2,
  Search,
  FolderOpen,
  ArrowLeft,
  Variable,
  User,
  Building2,
  Mail,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

interface Lead {
  id: number
  first_name: string
  last_name: string | null
  email: string
  company_name: string | null
  status: string
}

function NewCampaignForm() {
  const router = useRouter()

  const [leads, setLeads] = useState<Lead[]>([])
  const [groups, setGroups] = useState<{ id: number; name: string; lead_count: number }[]>([])
  const [mailboxEmail, setMailboxEmail] = useState('')
  const [mailboxSendAs, setMailboxSendAs] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Form fields
  const [campaignName, setCampaignName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sendType, setSendType] = useState<'instant' | 'scheduled' | 'smart_spacing'>('instant')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [gapMinutes, setGapMinutes] = useState(0.5)
  const [gapMinMax, setGapMinMax] = useState(1)

  const [businessHoursOnly, setBusinessHoursOnly] = useState(false)
  const [dailyCap, setDailyCap] = useState(50)
  const [businessHoursStart, setBusinessHoursStart] = useState('09:00')
  const [businessHoursEnd, setBusinessHoursEnd] = useState('18:00')
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [campaignLayer, setCampaignLayer] = useState('campaign')
  const [campaignSignature, setCampaignSignature] = useState('')
  const [mailboxSignature, setMailboxSignature] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState('')
  const [isCreating, setIsCreating] = useState(false)


  // Templates
  const [templates, setTemplates] = useState<{ id: number; name: string; subject: string; body: string; category: string }[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Subject personalization
  const [showSubjectTokens, setShowSubjectTokens] = useState(false)

  // Filters
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all')
  const [leadSearch, setLeadSearch] = useState('')

  const searchParams = useSearchParams()

  useEffect(() => {
    loadData()
  }, [])

  // If a clone campaign ID is provided, fetch and pre-fill the form
  useEffect(() => {
    const cloneId = searchParams?.get('clone')
    if (cloneId) {
      fetch(`/api/campaigns?id=${cloneId}`)
        .then(res => res.ok ? res.json() : null)
        .then((campaigns: any[]) => {
          if (campaigns && campaigns.length > 0) {
            const c = campaigns[0]
            setCampaignName(`${c.name} (Copy)`)
            setSubject(c.subject)
            setBody(c.body)
            setSendType(c.send_type || 'instant')
            setGapMinutes(c.gap_minutes ? c.gap_minutes / 60 : 0.5)
            setGapMinMax(c.gap_min_max ? c.gap_min_max / 60 : 1)
            setBusinessHoursOnly(c.business_hours_only || false)
            setDailyCap(c.daily_cap || 50)
            setBusinessHoursStart(c.business_hours_start || '09:00')
            setBusinessHoursEnd(c.business_hours_end || '18:00')
            setCampaignSignature(c.signature || '')
            setFromEmail(c.from_email || '')
            setFromName(c.from_name || '')
            // Pre-fill scheduled date/time if the campaign was scheduled
            if (c.scheduled_at) {
              const d = new Date(c.scheduled_at)
              const year = d.getFullYear()
              const month = String(d.getMonth() + 1).padStart(2, '0')
              const day = String(d.getDate()).padStart(2, '0')
              const hours = String(d.getHours()).padStart(2, '0')
              const mins = String(d.getMinutes()).padStart(2, '0')
              setScheduledDate(`${year}-${month}-${day}`)
              setScheduledTime(`${hours}:${mins}`)
            }
            toast.success('Campaign cloned! Edit the details below.')
          }
        })
        .catch(() => {})
    }
  }, [searchParams])

  useEffect(() => {
    fetchFilteredLeads()
  }, [selectedGroupId])

  const fetchFilteredLeads = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedGroupId !== 'all') params.set('group_id', selectedGroupId)
      params.set('limit', '500')

      const res = await fetch(`/api/leads?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLeads(data)
        setSelectedLeadIds([])
        setSelectAll(false)
      }
    } catch (error) {
      console.error('Failed to fetch filtered leads:', error)
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [leadsRes, groupsRes, mailboxRes, templatesRes] = await Promise.all([
        fetch('/api/leads?limit=500'),
        fetch('/api/lead-groups'),
        fetch('/api/mailbox/account'),
        fetch('/api/templates'),
      ])

      if (leadsRes.ok) setLeads(await leadsRes.json())
      if (groupsRes.ok) setGroups(await groupsRes.json())
      if (mailboxRes.ok) {
        const mailbox = await mailboxRes.json()
        if (mailbox) {
          setMailboxEmail(mailbox.email || '')
          setMailboxSendAs(mailbox.send_as || '')
          setMailboxSignature(mailbox.signature || '')
          // Default to main email (not alias) for "Send From"
          if (mailbox.email && !fromEmail) {
            setFromEmail(mailbox.email)
          }
          // Auto-fill display name from mailbox default, but only if not already set (e.g., from clone)
          if (mailbox.default_from_name && !fromName) {
            setFromName(mailbox.default_from_name)
          }
        }
      }
      if (templatesRes.ok) setTemplates(await templatesRes.json())
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleLead = (id: number) => {
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedLeadIds([])
    } else {
      setSelectedLeadIds(leads.map(l => l.id))
    }
    setSelectAll(!selectAll)
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (!templateId) return
    const template = templates.find(t => t.id.toString() === templateId)
    if (template) {
      setSubject(template.subject)
      setBody(template.body)
      toast.success(`Template "${template.name}" loaded!`)
    }
  }

  const createCampaign = async () => {
    if (!campaignName) { toast.error('Please enter a campaign name'); return }
    if (!subject) { toast.error('Please enter a subject'); return }
    if (!body) { toast.error('Please write an email body'); return }
    if (selectedLeadIds.length === 0) { toast.error('Please select at least one lead'); return }

    setIsCreating(true)
    try {
      // Convert gap from minutes to seconds (database stores integer)
      // 0.5 min = 30 seconds, 1 min = 60 seconds, etc.
      const gapSeconds = Math.round(gapMinutes * 60)

      const payload: any = {
        name: campaignName,
        subject,
        body,
        send_type: sendType,
        gap_minutes: gapSeconds,
        lead_ids: selectedLeadIds,
        signature: campaignSignature,
        layer: campaignLayer,
        from_email: fromEmail || undefined,
        from_name: fromName || undefined,
      }



      if (sendType === 'scheduled') {
        if (!scheduledDate || !scheduledTime) {
          toast.error('Please select a date and time')
          setIsCreating(false)
          return
        }
        // Convert local time to UTC for storage in timestamptz column
        const [year, month, day] = scheduledDate.split('-').map(Number)
        const [hour, minute] = scheduledTime.split(':').map(Number)
        const localDate = new Date(year, month - 1, day, hour, minute, 0)
        payload.scheduled_at = localDate.toISOString()
      }

      if (sendType === 'smart_spacing') {
        payload.gap_min_max = Math.round(gapMinMax * 60)

        payload.business_hours_only = businessHoursOnly
        payload.daily_cap = dailyCap
        payload.business_hours_start = businessHoursStart
        payload.business_hours_end = businessHoursEnd
      }

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create campaign')
      }

      toast.success('Campaign created!')
      router.push('/')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold">Create New Campaign</h1>
            <p className="text-sm text-muted-foreground">Set up a new email campaign</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Top row: Campaign Name + Subject + Layer + Send From + Display Name */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

            <div className="space-y-1.5">
              <Label>Campaign Name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Q1 Cold Outreach"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <div className="relative">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="pr-24"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <div className="relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSubjectTokens(!showSubjectTokens)}
                      className="h-7 text-xs text-primary hover:text-primary px-2"
                      title="Insert personalization token"
                    >
                      <Variable className="h-3.5 w-3.5 mr-1" />
                      {showSubjectTokens ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </Button>
                    {showSubjectTokens && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-popover border rounded-md shadow-lg max-h-72 overflow-y-auto">
                        <div className="p-2 border-b">
                          <p className="text-xs font-medium text-muted-foreground">Insert personalization token</p>
                        </div>
                        <div className="p-1">
                          {[
                            { label: 'First Name', token: '{{first_name}}' },
                            { label: 'Last Name', token: '{{last_name}}' },
                            { label: 'Full Name', token: '{{full_name}}' },
                            { label: 'Company', token: '{{company}}' },
                            { label: 'Website', token: '{{website}}' },
                            { label: 'Positive Points', token: '{{positive_points}}' },
                            { label: 'Positive Point 1', token: '{{positive_point_1}}' },
                            { label: 'Positive Point 2', token: '{{positive_point_2}}' },
                            { label: 'Positive Point 3', token: '{{positive_point_3}}' },
                            { label: 'Positive Point 4', token: '{{positive_point_4}}' },
                            { label: 'Positive Point 5', token: '{{positive_point_5}}' },
                            { label: 'Positive Point 6', token: '{{positive_point_6}}' },
                            { label: 'Positive Point 7', token: '{{positive_point_7}}' },
                            { label: 'Positive Point 8', token: '{{positive_point_8}}' },
                            { label: 'Positive Point 9', token: '{{positive_point_9}}' },
                            { label: 'Positive Point 10', token: '{{positive_point_10}}' },
                            { label: 'Improvements', token: '{{improvements}}' },
                            { label: 'Improvements 1', token: '{{improvements_1}}' },
                            { label: 'Improvements 2', token: '{{improvements_2}}' },
                            { label: 'Improvements 3', token: '{{improvements_3}}' },
                            { label: 'Improvements 4', token: '{{improvements_4}}' },
                            { label: 'Improvements 5', token: '{{improvements_5}}' },
                            { label: 'Improvements 6', token: '{{improvements_6}}' },
                            { label: 'Improvements 7', token: '{{improvements_7}}' },
                            { label: 'Improvements 8', token: '{{improvements_8}}' },
                            { label: 'Improvements 9', token: '{{improvements_9}}' },
                            { label: 'Improvements 10', token: '{{improvements_10}}' },
                            { label: 'Current Website Updates', token: '{{current_website_updates}}' },
                            { label: 'FB Ads Notes', token: '{{fb_ads_notes}}' },
                            { label: 'Pixel Status', token: '{{pixel_status}}' },
                            { label: 'Custom Notes', token: '{{custom_notes}}' },
                            { label: 'Video Link', token: '{{video_link}}' },
                            { label: 'Image Link', token: '{{image_link}}' },
                          ].map((t, i) => (


                            <button
                              key={i}
                              type="button"
                              className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded flex items-center gap-2 group"
                              onClick={() => {
                                setSubject(prev => prev + t.token)
                                setShowSubjectTokens(false)
                              }}
                            >
                              <span className="flex-1">{t.label}</span>
                              <code className="text-[10px] text-muted-foreground bg-muted px-1 rounded group-hover:bg-background">
                                {t.token}
                              </code>
                            </button>
                          ))}
                        </div>
                        <div className="p-2 border-t bg-muted/30">
                          <p className="text-[10px] text-muted-foreground">
                            Tokens are replaced with actual data when sending.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Outreach Layer</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={campaignLayer}
                onChange={(e) => setCampaignLayer(e.target.value)}
              >
                <option value="campaign">None (General Campaign)</option>
                <option value="L1">L1 - First Contact</option>
                <option value="L2">L2 - Follow Up</option>
                <option value="L3">L3 - Second Follow Up</option>
                <option value="L4">L4 - Third Follow Up</option>
                <option value="L5+">L5+ - Extended Follow Up</option>
              </select>
              <p className="text-[10px] text-muted-foreground">Tags sent emails under this layer in lead history</p>
            </div>
            <div className="space-y-1.5">
              <Label>Send From</Label>

              <select
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              >
                <option value="">Default (mailbox setting)</option>
                {mailboxEmail && <option value={mailboxEmail}>{mailboxEmail} (main)</option>}
                {mailboxSendAs && mailboxSendAs !== mailboxEmail && (
                  <option value={mailboxSendAs}>{mailboxSendAs} (alias)</option>
                )}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="e.g., Labintial (leave empty for default)"
              />
            </div>
          </div>

          {/* Template Selector */}
          {templates.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Use a Template</CardTitle>
                <CardDescription className="text-xs">
                  Select a saved template to auto-fill the subject and body. Personalization tokens like {'{{first_name}}'}, {'{{positive_points}}'} etc. will be replaced with each lead's latest data when sending.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                >
                  <option value="">-- Select a template --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id.toString()}>
                      {t.name} {t.category !== 'general' ? `(${t.category})` : ''}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>
          )}

          {/* Email Body - full width */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Email Body</CardTitle>
              <CardDescription className="text-xs">
                Use personalization tokens like {'{{first_name}}'}, {'{{company}}'}, {'{{positive_points}}'}, {'{{improvements}}'}, {'{{current_website_updates}}'} etc. Click "Personalize" in the editor toolbar to see all available fields.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                content={body}
                onChange={setBody}
                placeholder="Write your email... Use {{first_name}}, {{company}}, etc."
                minHeight="300px"
                showPersonalization={true}
              />
            </CardContent>
          </Card>


          {/* Signature */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Email Signature</CardTitle>
              <CardDescription className="text-xs">
                If you set a campaign signature, it will be used instead of the mailbox signature.
                Leave empty to automatically use your mailbox signature.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={campaignSignature}
                onChange={(e) => setCampaignSignature(e.target.value)}
                placeholder={`Enter a campaign-specific signature (optional)...

Leave empty to use your mailbox signature automatically.

Example:
--
John Doe
CEO, Your Company
Phone: +1 234 567 890
www.yourcompany.com`}
                className="w-full min-h-[100px] px-3 py-2 text-sm border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {mailboxSignature && !campaignSignature && (
                <div className="p-3 border border-primary/20 rounded-md bg-primary/5">
                  <p className="text-xs font-medium text-primary mb-1">Mailbox signature will be auto-appended:</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{mailboxSignature}</p>
                </div>
              )}
              {mailboxSignature && campaignSignature && (
                <p className="text-xs text-muted-foreground">
                  Campaign signature will be used. Your mailbox signature is saved in mailbox settings.
                </p>
              )}
              {!mailboxSignature && !campaignSignature && (
                <p className="text-xs text-muted-foreground">
                  No signature will be appended. Set a signature in{' '}
                  <a href="/mailbox" className="text-primary underline">Mailbox Settings</a> to have it auto-appended.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Two-column section: Send Options + Lead Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Send Options */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Send Options</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={sendType} onValueChange={(v) => setSendType(v as any)}>
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="instant">Send Now</TabsTrigger>
                    <TabsTrigger value="scheduled">Schedule</TabsTrigger>
                    <TabsTrigger value="smart_spacing">Smart Spacing</TabsTrigger>
                  </TabsList>
                  <div className="mt-3 p-3 border rounded-md bg-muted/30">
                    <TabsContent value="instant" className="mt-0">
                      <p className="text-sm text-muted-foreground">All emails sent immediately. Not recommended for bulk sending.</p>
                    </TabsContent>
                    <TabsContent value="scheduled" className="mt-0 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Date</Label>
                          <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Time</Label>
                          <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Emails start sending at the scheduled time with smart spacing between each.</p>
                    </TabsContent>
                    <TabsContent value="smart_spacing" className="mt-0 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Min Delay</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={gapMinutes}
                            onChange={(e) => setGapMinutes(parseFloat(e.target.value))}
                          >
                            <option value={0.5}>30 seconds</option>
                            <option value={1}>1 minute</option>
                            <option value={1.5}>1 minute 30 seconds</option>
                            <option value={2}>2 minutes</option>
                            <option value={2.5}>2 minutes 30 seconds</option>
                            <option value={3}>3 minutes</option>
                            <option value={5}>5 minutes</option>
                            <option value={10}>10 minutes</option>
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={60}>1 hour</option>
                          </select>

                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Max Delay</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={gapMinMax}
                            onChange={(e) => setGapMinMax(parseFloat(e.target.value))}
                          >

                            <option value={0.5}>30 seconds</option>
                            <option value={1}>1 minute</option>
                            <option value={1.5}>1 minute 30 seconds</option>
                            <option value={2}>2 minutes</option>
                            <option value={2.5}>2 minutes 30 seconds</option>
                            <option value={3}>3 minutes</option>
                            <option value={5}>5 minutes</option>
                            <option value={10}>10 minutes</option>
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={60}>1 hour</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Random delay between Min-Max per email.</p>

                      
                      <div className="border-t pt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="businessHours"
                            checked={businessHoursOnly}
                            onChange={(e) => setBusinessHoursOnly(e.target.checked)}
                            className="rounded"
                          />
                          <Label htmlFor="businessHours" className="text-xs cursor-pointer">Business hours only</Label>
                        </div>
                        {businessHoursOnly && (
                          <div className="grid grid-cols-2 gap-3 ml-5">
                            <div className="space-y-1">
                              <Label className="text-xs">Start</Label>
                              <Input type="time" value={businessHoursStart} onChange={(e) => setBusinessHoursStart(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">End</Label>
                              <Input type="time" value={businessHoursEnd} onChange={(e) => setBusinessHoursEnd(e.target.value)} />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border-t pt-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="dailyCap"
                            checked={dailyCap > 0}
                            onChange={(e) => setDailyCap(e.target.checked ? 50 : 0)}
                            className="rounded"
                          />
                          <Label htmlFor="dailyCap" className="text-xs cursor-pointer">Daily limit</Label>
                        </div>
                        {dailyCap > 0 && (
                          <div className="ml-5 mt-2 space-y-1">
                            <Label className="text-xs">Max per day</Label>
                            <Input type="number" min={1} max={500} value={dailyCap} onChange={(e) => setDailyCap(parseInt(e.target.value) || 50)} />
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>

            {/* Lead Selection */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Select Recipients</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {selectedLeadIds.length} of {leads.length}
                    </span>
                    <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="h-7 text-xs">
                      {selectAll ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Filter bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <select
                      className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={selectedGroupId}
                      onChange={(e) => {
                        setSelectedGroupId(e.target.value)
                        setSelectAll(false)
                        setSelectedLeadIds([])
                      }}
                    >
                      <option value="all">📁 All Leads</option>
                      <option value="null">📂 Ungrouped</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id.toString()}>
                          📁 {g.name} ({g.lead_count})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="relative flex-[2]">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      value={leadSearch}
                      onChange={(e) => {
                        setLeadSearch(e.target.value)
                        setSelectAll(false)
                      }}
                      placeholder="Search..."
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                </div>

                {/* Lead list */}
                <div className="border rounded-md max-h-80 overflow-y-auto">
                  {leads.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No leads found. Import leads first.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {leads
                        .filter((lead) => {
                          if (leadSearch) {
                            const q = leadSearch.toLowerCase()
                            return (
                              lead.first_name.toLowerCase().includes(q) ||
                              (lead.last_name || '').toLowerCase().includes(q) ||
                              lead.email.toLowerCase().includes(q) ||
                              (lead.company_name || '').toLowerCase().includes(q)
                            )
                          }
                          return true
                        })
                        .map((lead) => (
                          <div
                            key={lead.id}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors ${
                              selectedLeadIds.includes(lead.id) ? 'bg-accent/50' : ''
                            }`}
                            onClick={() => toggleLead(lead.id)}
                          >
                            <input
                              type="checkbox"
                              checked={selectedLeadIds.includes(lead.id)}
                              onChange={() => toggleLead(lead.id)}
                              className="rounded shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm truncate font-medium">
                                {lead.first_name} {lead.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">{lead.email}</div>
                            </div>
                            {lead.company_name && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {lead.company_name}
                              </Badge>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Submit */}
          <Button onClick={createCampaign} disabled={isCreating} className="w-full" size="lg">
            {isCreating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Create Campaign ({selectedLeadIds.length} recipients)
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function NewCampaignPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <NewCampaignForm />
    </Suspense>
  )
}
