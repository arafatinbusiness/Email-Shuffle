'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
} from 'lucide-react'

interface Lead {
  id: number
  first_name: string
  last_name: string | null
  email: string
  company_name: string | null
  status: string
}

export default function NewCampaignPage() {
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
  const [gapMinutes, setGapMinutes] = useState(3)
  const [gapMinMax, setGapMinMax] = useState(7)
  const [businessHoursOnly, setBusinessHoursOnly] = useState(false)
  const [dailyCap, setDailyCap] = useState(50)
  const [businessHoursStart, setBusinessHoursStart] = useState('09:00')
  const [businessHoursEnd, setBusinessHoursEnd] = useState('18:00')
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [campaignSignature, setCampaignSignature] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Filters
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all')
  const [leadSearch, setLeadSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

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
      const [leadsRes, groupsRes, mailboxRes] = await Promise.all([
        fetch('/api/leads?limit=500'),
        fetch('/api/lead-groups'),
        fetch('/api/mailbox/account'),
      ])

      if (leadsRes.ok) setLeads(await leadsRes.json())
      if (groupsRes.ok) setGroups(await groupsRes.json())
      if (mailboxRes.ok) {
        const mailbox = await mailboxRes.json()
        if (mailbox) {
          setMailboxEmail(mailbox.email || '')
          setMailboxSendAs(mailbox.send_as || '')
        }
      }
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

  const createCampaign = async () => {
    if (!campaignName) { toast.error('Please enter a campaign name'); return }
    if (!subject) { toast.error('Please enter a subject'); return }
    if (!body) { toast.error('Please write an email body'); return }
    if (selectedLeadIds.length === 0) { toast.error('Please select at least one lead'); return }

    setIsCreating(true)
    try {
      const payload: any = {
        name: campaignName,
        subject,
        body,
        send_type: sendType,
        gap_minutes: gapMinutes,
        lead_ids: selectedLeadIds,
        signature: campaignSignature,
        from_email: fromEmail || undefined,
      }

      if (sendType === 'scheduled') {
        if (!scheduledDate || !scheduledTime) {
          toast.error('Please select a date and time')
          setIsCreating(false)
          return
        }
        const [year, month, day] = scheduledDate.split('-').map(Number)
        const [hour, minute] = scheduledTime.split(':').map(Number)
        const localDate = new Date(year, month - 1, day, hour, minute, 0)
        payload.scheduled_at = localDate.toISOString()
      }

      if (sendType === 'smart_spacing') {
        payload.gap_min_max = gapMinMax
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
          {/* Top row: Campaign Name + Subject + Send From */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
              />
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
          </div>

          {/* Email Body - full width */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Email Body</CardTitle>
              <CardDescription className="text-xs">
                Use {'{{first_name}}'}, {'{{company}}'}, etc. for personalization
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
              <CardTitle className="text-sm">Email Signature (optional)</CardTitle>
              <CardDescription className="text-xs">
                This signature will be appended to every email in this campaign.
                If you also have a mailbox signature set, the campaign signature will be used instead.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={campaignSignature}
                onChange={(e) => setCampaignSignature(e.target.value)}
                placeholder={`Enter your email signature...

Example:
--
John Doe
CEO, Your Company
Phone: +1 234 567 890
www.yourcompany.com`}
                className="w-full min-h-[100px] px-3 py-2 text-sm border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              />
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
                          <Label className="text-xs">Min Delay (min)</Label>
                          <Input type="number" min={1} max={120} value={gapMinutes} onChange={(e) => setGapMinutes(parseInt(e.target.value) || 3)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Max Delay (min)</Label>
                          <Input type="number" min={1} max={120} value={gapMinMax} onChange={(e) => setGapMinMax(parseInt(e.target.value) || 7)} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Random delay between Min-Max minutes per email.</p>
                      
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
