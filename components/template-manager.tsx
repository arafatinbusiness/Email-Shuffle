'use client'

import { useState, useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { RichTextEditor } from '@/components/rich-text-editor'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Plus,
  Loader2,
  Trash2,
  Edit3,
  FileText,
  Save,
  X,
  Variable,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'


interface Template {
  id: number
  name: string
  subject: string
  body: string
  category: string
  created_at: string
  updated_at: string
}

export function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Form for creating/editing
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateSubject, setTemplateSubject] = useState('')
  const [templateBody, setTemplateBody] = useState('')
  const [templateCategory, setTemplateCategory] = useState('general')
  const [showSubjectTokens, setShowSubjectTokens] = useState(false)
  const subjectInputRef = useRef<HTMLInputElement>(null)

  const insertTokenAtCursor = (token: string) => {
    const input = subjectInputRef.current
    if (!input) {
      setTemplateSubject(prev => prev + token)
      return
    }
    const start = input.selectionStart ?? templateSubject.length
    const end = input.selectionEnd ?? templateSubject.length
    const newValue = templateSubject.substring(0, start) + token + templateSubject.substring(end)
    setTemplateSubject(newValue)
    setShowSubjectTokens(false)
    // Refocus and set cursor position after the inserted token
    requestAnimationFrame(() => {
      input.focus()
      const newCursorPos = start + token.length
      input.setSelectionRange(newCursorPos, newCursorPos)
    })
  }

  useEffect(() => {

    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/templates')
      if (res.ok) setTemplates(await res.json())
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setTemplateName('')
    setTemplateSubject('')
    setTemplateBody('')
    setTemplateCategory('general')
  }

  const startEdit = (template: Template) => {
    setEditingId(template.id)
    setTemplateName(template.name)
    setTemplateSubject(template.subject)
    setTemplateBody(template.body)
    setTemplateCategory(template.category || 'general')
    setShowForm(true)
  }

  const saveTemplate = async () => {
    if (!templateName) { toast.error('Please enter a template name'); return }
    if (!templateSubject) { toast.error('Please enter a subject'); return }
    if (!templateBody) { toast.error('Please write an email body'); return }

    setIsSaving(true)
    try {
      const url = '/api/templates'
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId
        ? JSON.stringify({ id: editingId, name: templateName, subject: templateSubject, templateBody, category: templateCategory })
        : JSON.stringify({ name: templateName, subject: templateSubject, body: templateBody, category: templateCategory })

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      })

      if (!res.ok) throw new Error('Failed to save template')

      toast.success(editingId ? 'Template updated!' : 'Template created!')
      resetForm()
      loadTemplates()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const deleteTemplate = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete template')
      toast.success('Template deleted')
      loadTemplates()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      general: 'bg-gray-500/10 text-gray-400',
      cold_outreach: 'bg-blue-500/10 text-blue-400',
      follow_up: 'bg-amber-500/10 text-amber-400',
      closing: 'bg-emerald-500/10 text-emerald-400',
      re_engagement: 'bg-purple-500/10 text-purple-400',
    }
    const color = colors[category] || 'bg-gray-500/10 text-gray-400'
    const label = category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return <Badge className={`${color} border-0 text-xs`}>{label}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Templates</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage reusable email templates with personalization tokens
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => { resetForm(); setShowForm(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-sm">{editingId ? 'Edit Template' : 'Create Template'}</CardTitle>
              <CardDescription className="text-xs">
                Use personalization tokens like {'{{first_name}}'}, {'{{company}}'}, {'{{positive_points}}'}, {'{{improvements}}'}, {'{{current_website_updates}}'} etc.
                These will be replaced with each lead's latest data when used in a campaign.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Template Name</Label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Cold Outreach L1"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                >
                  <option value="general">General</option>
                  <option value="cold_outreach">Cold Outreach</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="closing">Closing</option>
                  <option value="re_engagement">Re-engagement</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Subject</Label>
              <div className="relative">
                <Input
                  ref={subjectInputRef}
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                  placeholder="e.g., Hi {{first_name}}, quick question..."
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
              { label: 'Quick Question', token: '{{quick_question}}' },
              { label: 'Video Link', token: '{{video_link}}' },
              { label: 'Image Link', token: '{{image_link}}' },
            ].map((t, i) => (

                            <button
                              key={i}
                              type="button"
                              className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded flex items-center gap-2 group"
                              onClick={() => insertTokenAtCursor(t.token)}
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
              <Label>Email Body</Label>
              <RichTextEditor
                content={templateBody}
                onChange={setTemplateBody}
                placeholder="Write your email template... Use {{first_name}}, {{company}}, {{positive_points}}, etc."
                minHeight="250px"
                showPersonalization={true}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={saveTemplate} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingId ? 'Update Template' : 'Save Template'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 && !showForm ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No templates yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first email template to reuse across campaigns
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {getCategoryBadge(template.category)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(template)}
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTemplate(template.id)}
                      className="text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs mt-1">
                  {template.subject.substring(0, 80)}
                  {template.subject.length > 80 ? '...' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="text-sm p-3 bg-muted rounded prose prose-sm dark:prose-invert max-w-none line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: template.body.substring(0, 200) + (template.body.length > 200 ? '...' : '') }}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Updated: {new Date(template.updated_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
