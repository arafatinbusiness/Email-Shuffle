'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Send,
  Clock,
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
} from 'lucide-react'

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

export function CampaignManager() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showDetailDialog, setShowDetailDialog] = useState<Campaign | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const campaignsRes = await fetch('/api/campaigns')
      if (campaignsRes.ok) setCampaigns(await campaignsRes.json())
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
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

  // Helper to format a timestamp string for display
  // The DB stores timestamps as "timestamptz" (UTC). The API returns them as ISO strings with Z.
  // new Date() correctly converts UTC to the user's local timezone.
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
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
        <Button onClick={() => router.push('/campaigns/new')}>
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
            <Button onClick={() => router.push('/campaigns/new')}>
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
                    <p className="text-sm">{formatDate(showDetailDialog.scheduled_at)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm">{formatDate(showDetailDialog.created_at)}</p>
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
