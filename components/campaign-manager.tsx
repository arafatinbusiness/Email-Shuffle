'use client'

import { useState, useEffect } from 'react'
import { RichTextEditor } from './rich-text-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  FileText,
  Variable,
  Loader2,
  Check,
  X,
  Plus,
  Trash2,
  Users,
  Play,
  Pause,
  Ban,
  Eye,
  BarChart3,
  FolderOpen,
  Search,
  Filter,
  ChevronDown,
} from 'lucide-react'

interface Lead {
  id: number
  first_name: string
  last_name: string | null
  email: string
  company_name: string | null
  status: string
}

interface Campaign {
  id: number
  name: string
  subject: string
  body: string
  status: string
  send_type: string
  scheduled_at: string | null
  gap_minutes: number
  total_recipients: number
  sent_count: number
  failed_count: number
  created_at: string
}

interface Template {
  id: number
  name: string
  subject: string
  body: string
  category: string
}

export function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [importColumns, setImportColumns] = useState<string[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState<Campaign | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // New campaign form
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
  const [mailboxEmail, setMailboxEmail] = useState('')
  const [mailboxSendAs, setMailboxSendAs] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isSending, setIsSending] = useState<number | null>(null)

  // Group/folder state
  const [groups, setGroups] = useState<{ id: number; name: string; lead_count: number }[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all')
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')

  // Search/filter state
  const [leadSearch, setLeadSearch] = useState('')
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])

  // Import batch state
  const [importBatches, setImportBatches] = useState<string[]>([])
  const [selectedImportBatch, setSelectedImportBatch] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [])

  // Re-fetch leads when group or import batch filter changes
  useEffect(() => {
    fetchFilteredLeads()
  }, [selectedGroupId, selectedImportBatch])

  const fetchFilteredLeads = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedGroupId !== 'all') params.set('group_id', selectedGroupId)
      if (selectedImportBatch !== 'all') params.set('import_batch_id', selectedImportBatch)
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
      const [campaignsRes, leadsRes, templatesRes, columnsRes, groupsRes, batchesRes, mailboxRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/leads?limit=500'),
        fetch('/api/templates'),
        fetch('/api/import-columns'),
        fetch('/api/lead-groups'),
        fetch('/api/leads?limit=1&group_by=import_batch_id'),
        fetch('/api/mailbox/account'),
      ])

      if (campaignsRes.ok) setCampaigns(await campaignsRes.json())
      if (leadsRes.ok) setLeads(await leadsRes.json())
      if (templatesRes.ok) setTemplates(await templatesRes.json())
      if (columnsRes.ok) setImportColumns(await columnsRes.json())
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
        // Convert local time to UTC for storage
        // The user picks a time in their local timezone (e.g., GMT+6)
        // We need to store it as UTC so the server can compare with NOW() correctly
        const [year, month, day] = scheduledDate.split('-').map(Number)
        const [hour, minute] = scheduledTime.split(':').map(Number)
        // Create a date in local timezone, then convert to UTC
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
      setShowCreateDialog(false)
      resetForm()
      loadData()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsCreating(false)
    }
  }

  const startCampaign = async (campaignId: number) => {
    setIsSending(campaignId)
    try {
      const res = await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to start campaign')
      }

      const result = await res.json()
      toast.success(result.message || 'Campaign started!')
      loadData()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSending(null)
    }
  }

  const updateCampaignStatus = async (campaignId: number, status: string) => {
    try {
      const res = await fetch('/api/campaigns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campaignId, status }),
      })

      if (!res.ok) throw new Error('Failed to update campaign')
      toast.success(`Campaign ${status}`)
      loadData()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const deleteCampaign = async (campaignId: number) => {
    try {
      const res = await fetch(`/api/campaigns?id=${campaignId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete campaign')
      toast.success('Campaign deleted')
      loadData()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const resetForm = () => {
    setCampaignName('')
    setSubject('')
    setBody('')
    setSendType('instant')
    setScheduledDate('')
    setScheduledTime('')
    setGapMinutes(3)
    setSelectedLeadIds([])
    setSelectAll(false)
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; color: string }> = {
      draft: { label: 'Draft', color: 'bg-gray-500/10 text-gray-400' },
      scheduled: { label: 'Scheduled', color: 'bg-blue-500/10 text-blue-400' },
      sending: { label: 'Sending', color: 'bg-amber-500/10 text-amber-400' },
      completed: { label: 'Completed', color: 'bg-emerald-500/10 text-emerald-400' },
      paused: { label: 'Paused', color: 'bg-yellow-500/10 text-yellow-400' },
      cancelled: { label: 'Cancelled', color: 'bg-red-500/10 text-red-400' },
      failed: { label: 'Failed', color: 'bg-red-500/20 text-red-500' },
    }
    const c = config[status] || { label: status, color: 'bg-gray-500/10 text-gray-400' }
    return <Badge className={`${c.color} border-0`}>{c.label}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Campaigns</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage bulk email campaigns
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Send className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No campaigns yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first email campaign to send bulk emails
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {campaign.subject.substring(0, 80)}
                      {campaign.subject.length > 80 ? '...' : ''}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(campaign.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {campaign.total_recipients} recipients
                    </span>
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3 text-emerald-500" />
                      {campaign.sent_count} sent
                    </span>
                    {campaign.failed_count > 0 && (
                      <span className="flex items-center gap-1">
                        <X className="h-3 w-3 text-red-500" />
                        {campaign.failed_count} failed
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {campaign.send_type === 'instant' ? 'Instant' : campaign.send_type === 'scheduled' ? 'Scheduled' : `${campaign.gap_minutes}min gap`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {campaign.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={() => startCampaign(campaign.id)}
                        disabled={isSending === campaign.id}
                      >
                        {isSending === campaign.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3 mr-1" />
                        )}
                        Send
                      </Button>
                    )}
                    {campaign.status === 'sending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateCampaignStatus(campaign.id, 'paused')}
                      >
                        <Pause className="h-3 w-3 mr-1" />
                        Pause
                      </Button>
                    )}
                    {campaign.status === 'paused' && (
                      <Button
                        size="sm"
                        onClick={() => startCampaign(campaign.id)}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Resume
                      </Button>
                    )}
                    {(campaign.status === 'draft' || campaign.status === 'paused' || campaign.status === 'scheduled') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateCampaignStatus(campaign.id, 'cancelled')}
                        className="text-red-500"
                      >
                        <Ban className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowDetailDialog(campaign)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteCampaign(campaign.id)}
                      className="text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
          </DialogHeader>
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
            <div className="space-y-1.5">
              <Label>Email Body</Label>
              <RichTextEditor
                content={body}
                onChange={setBody}
                placeholder="Write your email... Use {{first_name}}, {{company}}, etc."
                minHeight="250px"
                showPersonalization={true}
              />
            </div>

            {/* Signature - full width */}
            <div className="space-y-1.5">
              <Label>Email Signature (optional)</Label>
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
                className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                This signature will be appended to every email in this campaign.
                If you also have a mailbox signature set, the campaign signature will be used instead.
              </p>
            </div>

            {/* Two-column section: Send Options + Lead Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Send Options */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Send Options</h3>
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
              </div>

              {/* Lead Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Select Recipients</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {selectedLeadIds.length} of {leads.length}
                    </span>
                    <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="h-7 text-xs">
                      {selectAll ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                </div>

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
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    onClick={() => setShowCreateGroup(true)}
                  >
                    <FolderOpen className="h-3 w-3 mr-1" />
                    New Group
                  </Button>
                </div>

                {/* Lead list */}
                <div className="border rounded-md max-h-64 overflow-y-auto">
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
                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent transition-colors ${
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
                              <div className="text-sm truncate">
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
              </div>
            </div>

            {/* Create Group Dialog */}
            <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Create New Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Group Name</Label>
                    <Input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g., Q1 Prospects"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Description (optional)</Label>
                    <Input
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      placeholder="Brief description..."
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={async () => {
                      if (!newGroupName.trim()) {
                        toast.error('Please enter a group name')
                        return
                      }
                      try {
                        const res = await fetch('/api/lead-groups', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: newGroupName.trim(),
                            description: newGroupDesc.trim() || null,
                          }),
                        })
                        if (!res.ok) {
                          const err = await res.json()
                          throw new Error(err.error || 'Failed to create group')
                        }
                        toast.success('Group created!')
                        setShowCreateGroup(false)
                        setNewGroupName('')
                        setNewGroupDesc('')
                        const groupsRes = await fetch('/api/lead-groups')
                        if (groupsRes.ok) setGroups(await groupsRes.json())
                      } catch (error: any) {
                        toast.error(error.message)
                      }
                    }}
                  >
                    Create Group
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button onClick={createCampaign} disabled={isCreating} className="w-full" size="lg">
              {isCreating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Create Campaign ({selectedLeadIds.length} recipients)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Detail Dialog */}
      <Dialog open={!!showDetailDialog} onOpenChange={(open) => !open && setShowDetailDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showDetailDialog?.name}</DialogTitle>
          </DialogHeader>
          {showDetailDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  {getStatusBadge(showDetailDialog.status)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Send Type</p>
                  <p className="text-sm capitalize">{showDetailDialog.send_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recipients</p>
                  <p className="text-sm">{showDetailDialog.total_recipients}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sent / Failed</p>
                  <p className="text-sm">
                    <span className="text-emerald-500">{showDetailDialog.sent_count}</span>
                    {showDetailDialog.failed_count > 0 && (
                      <span className="text-red-500 ml-2">/ {showDetailDialog.failed_count} failed</span>
                    )}
                  </p>
                </div>
                {showDetailDialog.scheduled_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Scheduled</p>
                    <p className="text-sm">{new Date(showDetailDialog.scheduled_at).toLocaleString()}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">{new Date(showDetailDialog.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Subject</p>
                <p className="text-sm p-2 bg-muted rounded">{showDetailDialog.subject}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Email Body</p>
                <div
                  className="text-sm p-2 bg-muted rounded prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: showDetailDialog.body }}
                />
              </div>

              {(showDetailDialog as any).signature && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Signature</p>
                  <pre className="text-sm p-2 bg-muted rounded whitespace-pre-wrap font-sans">
                    {(showDetailDialog as any).signature}
                  </pre>
                </div>
              )}

              {(showDetailDialog as any).from_email && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Send From</p>
                  <p className="text-sm p-2 bg-muted rounded">{(showDetailDialog as any).from_email}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
