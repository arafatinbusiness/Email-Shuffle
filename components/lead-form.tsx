'use client'

import { useState, useEffect } from 'react'
import { Lead, PipelineStage, LeadLayer, LeadPriority, LeadIntent, LeadType, PRIORITY_CONFIG, INTENT_LABELS, LEAD_TYPE_CONFIG } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Loader2, FolderOpen } from 'lucide-react'


interface LeadFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead?: Lead | null
  onSubmit: (data: Partial<Lead>) => Promise<void>
  defaultGroupId?: number | null
}

export function LeadForm({ open, onOpenChange, lead, onSubmit, defaultGroupId }: LeadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<Partial<Lead>>(() => getInitialFormData(lead))
  const [groups, setGroups] = useState<{ id: number; name: string; lead_count: number }[]>([])

  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData(lead))
      // Fetch groups
      fetch('/api/lead-groups')
        .then(res => res.ok ? res.json() : [])
        .then(setGroups)
        .catch(() => {})
    }
  }, [open, lead])

  function getInitialFormData(lead: Lead | null | undefined): Partial<Lead> {
    return {
      first_name: lead?.first_name || '',
      last_name: lead?.last_name || '',
      email: lead?.email || '',
      company_name: lead?.company_name || '',
      website: lead?.website || '',
      group_id: lead?.group_id ?? defaultGroupId ?? null,
      status: lead?.status || '',
      pipeline_stage: lead?.pipeline_stage || 'cold',
      current_layer: lead?.current_layer || 'L1',
      positive_points: lead?.positive_points || '',
      improvements: lead?.improvements || '',
      video_link: lead?.video_link || '',
      image_link: lead?.image_link || '',
      fb_ads_notes: lead?.fb_ads_notes || '',


      pixel_status: lead?.pixel_status || '',
      custom_notes: lead?.custom_notes || '',
      quick_question: lead?.quick_question || '',
      next_follow_up: lead?.next_follow_up?.split('T')[0] || '',

    }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmit(formData)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateField = (field: keyof Lead, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{lead ? 'Edit Lead' : 'Add New Lead'}</SheetTitle>
          <SheetDescription>
            {lead ? 'Update lead information and follow-up details.' : 'Enter the lead details to add them to your pipeline.'}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => updateField('first_name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name || ''}
                onChange={(e) => updateField('last_name', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              value={formData.company_name || ''}
              onChange={(e) => updateField('company_name', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://"
              value={formData.website || ''}
              onChange={(e) => updateField('website', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="video_link">Video Link (Screen Recording)</Label>
            <Input
              id="video_link"
              type="url"
              placeholder="https://www.loom.com/share/..."
              value={formData.video_link || ''}
              onChange={(e) => updateField('video_link', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_link">Image Link (Screenshot)</Label>
            <Input
              id="image_link"
              type="url"
              placeholder="https://example.com/screenshot.png"
              value={formData.image_link || ''}
              onChange={(e) => updateField('image_link', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group_id" className="flex items-center gap-1">


              <FolderOpen className="h-3.5 w-3.5" />
              Group / Folder
            </Label>
            <Select
              value={formData.group_id?.toString() || 'none'}
              onValueChange={(value: string) => updateField('group_id', value === 'none' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a group..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">📂 No Group</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id.toString()}>
                    📁 {g.name} ({g.lead_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead_type">Type</Label>

            <Select
              value={formData.lead_type || 'lead'}
              onValueChange={(value: LeadType) => updateField('lead_type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">📋 Lead - Pitch & Follow-up</SelectItem>
                <SelectItem value="customer">🤝 Customer - Daily Updates</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status (free text - e.g. CEO, Owner, etc.)</Label>
            <Input
              id="status"
              placeholder="e.g. CEO, Owner, Decision Maker..."
              value={formData.status || ''}
              onChange={(e) => updateField('status', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pipeline_stage">Pipeline Stage</Label>
              <Select
                value={formData.pipeline_stage || 'cold'}
                onValueChange={(value: PipelineStage) => updateField('pipeline_stage', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cold">Cold</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="dead">Dead</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_layer">Current Layer</Label>
              <Select
                value={formData.current_layer}
                onValueChange={(value: LeadLayer) => updateField('current_layer', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1">L1 - First Contact</SelectItem>
                  <SelectItem value="L2">L2 - Follow-up</SelectItem>
                  <SelectItem value="L3">L3 - Strong Follow-up</SelectItem>
                  <SelectItem value="L4">L4 - Break-up</SelectItem>
                  <SelectItem value="L5+">L5+ - Final Persuasion</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority || 'none'}
                onValueChange={(value: string) => updateField('priority', value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Set priority..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="high">🔴 High</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="low">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="intent">Intent</Label>
              <Select
                value={formData.intent || 'none'}
                onValueChange={(value: string) => updateField('intent', value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Set intent..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="cold-outreach">❄️ Cold Outreach</SelectItem>
                  <SelectItem value="follow-up">📬 Follow-up</SelectItem>
                  <SelectItem value="closing">🎯 Closing Attempt</SelectItem>
                  <SelectItem value="re-engagement">🔄 Re-engagement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="next_follow_up">Next Follow-up Date</Label>
            <Input
              id="next_follow_up"
              type="date"
              value={formData.next_follow_up || ''}
              onChange={(e) => updateField('next_follow_up', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="positive_points">Positive Points</Label>
            <Textarea
              id="positive_points"
              placeholder="What stands out about this lead..."
              value={formData.positive_points || ''}
              onChange={(e) => updateField('positive_points', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="improvements">Improvements / Value Proposition</Label>
            <Textarea
              id="improvements"
              placeholder="How you can help them..."
              value={formData.improvements || ''}
              onChange={(e) => updateField('improvements', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom_notes">Custom Notes</Label>
            <Textarea
              id="custom_notes"
              placeholder="Additional notes..."
              value={formData.custom_notes || ''}
              onChange={(e) => updateField('custom_notes', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick_question">Quick Question</Label>
            <Textarea
              id="quick_question"
              placeholder="A quick question to ask the lead..."
              value={formData.quick_question || ''}
              onChange={(e) => updateField('quick_question', e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4">

            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {lead ? 'Update Lead' : 'Add Lead'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
