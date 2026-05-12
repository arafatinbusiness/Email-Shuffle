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
  const [sendType, setSendType] = useState<'instant' | 'scheduled' | 'random_gap'>('instant')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [gapMinutes, setGapMinutes] = useState(3)
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isSending, setIsSending] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [campaignsRes, leadsRes, templatesRes, columnsRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/leads'),
        fetch('/api/templates'),
        fetch('/api/import-columns'),
      ])

      if (campaignsRes.ok) setCampaigns(await campaignsRes.json())
      if (leadsRes.ok) setLeads(await leadsRes.json())
      if (templatesRes.ok) setTemplates(await templatesRes.json())
      if (columnsRes.ok) setImportColumns(await columnsRes.json())
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
      }

      if (sendType === 'scheduled') {
        if (!scheduledDate || !scheduledTime) {
          toast.error('Please select a date and time')
          setIsCreating(false)
          return
        }
        payload.scheduled_at = `${scheduledDate}T${scheduledTime}:00`
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Campaign Name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Q1 Cold Outreach"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
                className="mt-1"
              />
            </div>

            <div>
              <Label>Email Body</Label>
              <RichTextEditor
                content={body}
                onChange={setBody}
                placeholder="Write your email... Use {{first_name}}, {{company}}, etc."
                minHeight="200px"
              />
            </div>

            {/* Send Options */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Send Options</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={sendType} onValueChange={(v) => setSendType(v as any)}>
                  <TabsList className="grid grid-cols-3">
                    <TabsTrigger value="instant">Send Now</TabsTrigger>
                    <TabsTrigger value="scheduled">Schedule</TabsTrigger>
                    <TabsTrigger value="random_gap">Random Gap</TabsTrigger>
                  </TabsList>
                  <TabsContent value="instant" className="mt-2">
                    <p className="text-xs text-muted-foreground">All emails sent immediately.</p>
                  </TabsContent>
                  <TabsContent value="scheduled" className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Date</Label>
                        <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Time</Label>
                        <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="mt-1" />
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="random_gap" className="mt-2 space-y-2">
                    <div>
                      <Label className="text-xs">Gap (minutes)</Label>
                      <Input type="number" min={1} max={60} value={gapMinutes} onChange={(e) => setGapMinutes(parseInt(e.target.value) || 3)} className="mt-1" />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Lead Selection */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Select Recipients</CardTitle>
                  <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                    {selectAll ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <CardDescription className="text-xs">
                  {selectedLeadIds.length} of {leads.length} leads selected
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-48 overflow-y-auto">
                {leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No leads found. Import leads first.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {leads.map((lead) => (
                      <div
                        key={lead.id}
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent ${
                          selectedLeadIds.includes(lead.id) ? 'bg-accent' : ''
                        }`}
                        onClick={() => toggleLead(lead.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.includes(lead.id)}
                          onChange={() => toggleLead(lead.id)}
                          className="rounded"
                        />
                        <span className="text-sm">
                          {lead.first_name} {lead.last_name}
                        </span>
                        <span className="text-xs text-muted-foreground">{lead.email}</span>
                        {lead.company_name && (
                          <Badge variant="outline" className="text-xs ml-auto">
                            {lead.company_name}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Button onClick={createCampaign} disabled={isCreating} className="w-full">
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
