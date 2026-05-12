'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Mail,
  MailOpen,
  Send,
  RefreshCw,
  Reply,
  Settings,
  User,
  Clock,
  Inbox,
  MessageSquare,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface ThreadData {
  id: number
  lead_id: number | null
  subject: string
  last_message_at: string
  created_at: string
  lead_first_name: string | null
  lead_last_name: string | null
  lead_email: string | null
  message_count: number
  unread_count: number
  last_subject: string | null
  last_preview: string | null
  last_sender: string | null
}

interface MessageData {
  id: number
  thread_id: number
  direction: 'incoming' | 'outgoing'
  subject: string
  body: string
  body_html: string | null
  sender: string
  recipient: string
  message_id: string
  in_reply_to: string | null
  refs: string | null
  is_read: boolean
  sent_at: string
}

interface ThreadDetail {
  thread: ThreadData
  messages: MessageData[]
}

interface MailboxInboxProps {
  onOpenSettings?: () => void
}

// Helper to get initials from name
const getInitials = (name: string): string => {
  if (!name) return '?'
  const parts = name.split(/[\s<@]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Helper to extract email from "Name <email>" format
const extractEmail = (raw: string): string => {
  if (!raw) return ''
  const match = raw.match(/<([^>]+)>/)
  if (match) return match[1].trim()
  if (raw.includes('@')) return raw.trim()
  return raw.trim()
}

// Helper to extract display name from "Name <email>" format
const extractName = (raw: string): string => {
  if (!raw) return 'Unknown'
  const match = raw.match(/^([^<]+)</)
  if (match) return match[1].trim()
  if (raw.includes('@')) return raw.split('@')[0]
  return raw
}

// Helper to get a color based on a string (for avatar backgrounds)
const getAvatarColor = (str: string): string => {
  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
    'bg-orange-500', 'bg-cyan-500',
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// Format relative time
const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  return format(date, 'MMM d')
}

export function MailboxInbox({ onOpenSettings }: MailboxInboxProps) {
  const [threads, setThreads] = useState<ThreadData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedThread, setSelectedThread] = useState<ThreadDetail | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeSending, setComposeSending] = useState(false)
  const [accountEmail, setAccountEmail] = useState('')
  const [accountAlias, setAccountAlias] = useState('')
  const [composeFrom, setComposeFrom] = useState('')
  const [composeSuggestions, setComposeSuggestions] = useState<{ name: string; email: string }[]>([])
  const [composeShowSuggestions, setComposeShowSuggestions] = useState(false)
  const [composeToFocused, setComposeToFocused] = useState(false)
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set())

  const fetchThreads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mailbox/threads')
      if (res.ok) {
        const data = await res.json()
        setThreads(data)
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  const fetchThreadDetail = async (threadId: number) => {
    try {
      const res = await fetch(`/api/mailbox/threads/${threadId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedThread(data)
        // Mark unread messages as read
        for (const msg of data.messages) {
          if (msg.direction === 'incoming' && !msg.is_read) {
            await fetch(`/api/mailbox/messages/${msg.id}/read`, { method: 'POST' })
          }
        }
        // Refresh threads list to update unread counts
        fetchThreads()
      }
    } catch {
      toast.error('Failed to load conversation')
    }
  }

  const handleSendReply = async () => {
    if (!selectedThread || !replyText.trim()) return

    // Find the last incoming message to reply to
    const lastIncoming = [...selectedThread.messages].reverse().find(m => m.direction === 'incoming')
    const recipient = lastIncoming ? extractEmail(lastIncoming.sender) : ''

    if (!recipient || !recipient.includes('@')) {
      toast.error('Could not determine recipient email')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/mailbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          subject: selectedThread.thread.subject.startsWith('Re:')
            ? selectedThread.thread.subject
            : `Re: ${selectedThread.thread.subject}`,
          body: replyText,
          thread_id: selectedThread.thread.id,
          lead_id: selectedThread.thread.lead_id,
          in_reply_to: lastIncoming?.message_id || undefined,
          references: lastIncoming?.refs || lastIncoming?.message_id || undefined,
        }),
      })

      if (!res.ok) throw new Error('Failed to send')

      toast.success('Reply sent!')
      setReplyText('')
      await fetchThreadDetail(selectedThread.thread.id)
    } catch {
      toast.error('Failed to send reply')
    } finally {
      setSending(false)
    }
  }

  const handleSync = async () => {
    toast.info('Syncing inbox...')
    try {
      const res = await fetch('/api/mailbox/sync', { method: 'POST' })
      if (!res.ok) throw new Error('Sync failed')
      const data = await res.json()
      toast.success(`Synced ${data.synced} emails (${data.replies} replies)`)
      await fetchThreads()
    } catch {
      toast.error('Failed to sync inbox')
    }
  }

  const handleReSyncAll = async () => {
    const confirmed = window.confirm(
      'This will delete ALL existing emails and threads, then re-sync everything from your inbox. Continue?'
    )
    if (!confirmed) return

    toast.info('Re-syncing all emails...')
    try {
      const res = await fetch('/api/mailbox/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearFirst: true }),
      })
      if (!res.ok) throw new Error('Re-sync failed')
      const data = await res.json()
      toast.success(`Re-synced ${data.synced} emails (${data.replies} replies)`)
      await fetchThreads()
    } catch {
      toast.error('Failed to re-sync inbox')
    }
  }

  // Build a tree of messages based on in_reply_to
  // Messages whose parent is not in our DB appear as top-level comments
  const buildMessageTree = (messages: MessageData[]): { root: MessageData[]; replies: Map<string, MessageData[]> } => {
    const replies = new Map<string, MessageData[]>()
    const messageIds = new Set<string>()
    const root: MessageData[] = []

    // First pass: collect all message_ids
    for (const msg of messages) {
      messageIds.add(msg.message_id)
    }

    // Second pass: build tree - only nest if parent message_id exists in our DB
    for (const msg of messages) {
      if (msg.in_reply_to && messageIds.has(msg.in_reply_to)) {
        const existing = replies.get(msg.in_reply_to) || []
        existing.push(msg)
        replies.set(msg.in_reply_to, existing)
      } else {
        root.push(msg)
      }
    }

    return { root, replies }
  }

  // Render a message and its replies recursively (Facebook comment style)
  const renderMessage = (msg: MessageData, replies: Map<string, MessageData[]>, depth: number = 0) => {
    const childMessages = replies.get(msg.message_id) || []
    const hasReplies = childMessages.length > 0
    const isExpanded = expandedReplies.has(msg.id)
    const isIncoming = msg.direction === 'incoming'
    const displayName = isIncoming ? extractName(msg.sender) : 'You'
    const email = isIncoming ? extractEmail(msg.sender) : extractEmail(msg.recipient)

    return (
      <div key={msg.id} className={`${depth > 0 ? 'ml-8 border-l-2 border-muted pl-4' : ''}`}>
        {/* Facebook comment-style message card */}
        <div className={`flex gap-3 group ${depth > 0 ? 'mt-2' : 'mt-3'}`}>
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className={`h-8 w-8 rounded-full ${getAvatarColor(email)} flex items-center justify-center text-white text-xs font-bold`}>
              {getInitials(displayName)}
            </div>
          </div>

          {/* Message content */}
          <div className="flex-1 min-w-0">
            <div className={`rounded-lg px-3 py-2 ${
              isIncoming
                ? 'bg-muted/50 border border-border'
                : 'bg-primary/10 border border-primary/20'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold">{displayName}</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(msg.sent_at), 'MMM d, h:mm a')}
                </span>
                {!isIncoming && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">Sent</Badge>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">
                {msg.body || (msg.body_html ? msg.body_html.replace(/<[^>]*>/g, '').trim() : '(No content)')}
              </p>
            </div>

            {/* Reply / Expand toggle */}
            <div className="flex items-center gap-3 mt-1 px-1">
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                onClick={() => {
                  setReplyText(`> ${msg.body.split('\n')[0]}\n\n`)
                }}
              >
                <Reply className="h-3 w-3" />
                Reply
              </button>
              {hasReplies && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  onClick={() => {
                    setExpandedReplies(prev => {
                      const next = new Set(prev)
                      if (next.has(msg.id)) next.delete(msg.id)
                      else next.add(msg.id)
                      return next
                    })
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {childMessages.length} {childMessages.length === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>

            {/* Nested replies */}
            {hasReplies && isExpanded && (
              <div className="mt-1">
                {childMessages.map(child => renderMessage(child, replies, depth + 1))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const unreadCount = threads.reduce((sum, t) => sum + t.unread_count, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Messages</h2>
          <p className="text-sm text-muted-foreground">
            {threads.length} conversation{threads.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onOpenSettings}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm" onClick={handleSync}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync
          </Button>
          <Button variant="default" size="sm" onClick={async () => {
            try {
              const res = await fetch('/api/mailbox/account')
              if (res.ok) {
                const data = await res.json()
                if (data) {
                  setAccountEmail(data.email)
                  setAccountAlias(data.send_as || '')
                  setComposeFrom(data.send_as || data.email)
                }
              }
            } catch {}
            try {
              const res = await fetch('/api/leads?limit=500')
              if (res.ok) {
                const data = await res.json()
                const contacts: { name: string; email: string }[] = []
                for (const lead of data) {
                  if (lead.email && lead.email.includes('@')) {
                    contacts.push({
                      name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email,
                      email: lead.email,
                    })
                  }
                }
                setComposeSuggestions(contacts)
              }
            } catch {}
            setShowCompose(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Compose
          </Button>
          <Button variant="outline" size="sm" onClick={handleReSyncAll} className="text-destructive hover:text-destructive">
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-sync All
          </Button>
        </div>
      </div>

      {/* Main layout: WhatsApp-style left panel + Facebook comment-style right panel */}
      <div className="flex h-[calc(100vh-220px)] min-h-[500px] border rounded-lg overflow-hidden bg-background">
        {/* Left Panel - WhatsApp/Signal style contact list */}
        <div className="w-[340px] border-r flex flex-col bg-muted/10">
          {/* Search / Filter bar */}
          <div className="p-3 border-b bg-background">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All conversations'}
              </span>
            </div>
          </div>

          {/* Contact list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground px-4">
                No conversations yet. Sync your inbox or send an email to get started.
              </div>
            ) : (
              threads.map((thread) => {
                const displayName = thread.lead_first_name
                  ? `${thread.lead_first_name} ${thread.lead_last_name || ''}`
                  : extractName(thread.last_sender || thread.lead_email || '')
                const email = thread.lead_email || extractEmail(thread.last_sender || '')
                const isSelected = selectedThread?.thread.id === thread.id

                return (
                  <button
                    key={thread.id}
                    className={`w-full text-left p-3 flex gap-3 transition-colors hover:bg-muted/50 border-b border-border/50 ${
                      isSelected ? 'bg-muted/30' : ''
                    } ${thread.unread_count > 0 ? 'bg-primary/5' : ''}`}
                    onClick={() => fetchThreadDetail(thread.id)}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 relative">
                      <div className={`h-12 w-12 rounded-full ${getAvatarColor(email)} flex items-center justify-center text-white text-sm font-bold`}>
                        {getInitials(displayName)}
                      </div>
                      {thread.unread_count > 0 && (
                        <div className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-[9px] text-primary-foreground font-bold">{thread.unread_count}</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${thread.unread_count > 0 ? 'font-semibold' : ''}`}>
                          {displayName}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                          {formatRelativeTime(thread.last_message_at)}
                        </span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${thread.unread_count > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                        {thread.last_subject || thread.subject}
                      </p>
                      {thread.last_preview && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {thread.last_preview}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Panel - Facebook comment-style thread view */}
        <div className="flex-1 flex flex-col bg-background">
          {selectedThread ? (
            <>
              {/* Thread header */}
              <div className="p-3 border-b bg-muted/5 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full ${getAvatarColor(
                  selectedThread.thread.lead_email || extractEmail(selectedThread.thread.last_sender || '')
                )} flex items-center justify-center text-white text-sm font-bold`}>
                  {getInitials(
                    selectedThread.thread.lead_first_name
                      ? `${selectedThread.thread.lead_first_name} ${selectedThread.thread.lead_last_name || ''}`
                      : extractName(selectedThread.thread.last_sender || '')
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {selectedThread.thread.lead_first_name
                      ? `${selectedThread.thread.lead_first_name} ${selectedThread.thread.lead_last_name || ''}`
                      : extractName(selectedThread.thread.last_sender || '')}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedThread.thread.subject}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {selectedThread.messages.length} message{selectedThread.messages.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {/* Messages - Facebook comment style */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {(() => {
                  const { root, replies } = buildMessageTree(selectedThread.messages)
                  return root.map(msg => renderMessage(msg, replies, 0))
                })()}
              </div>

              {/* Reply input */}
              <div className="p-3 border-t bg-muted/5">
                <div className="flex gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    rows={2}
                    className="min-h-[40px] resize-none text-sm"
                  />
                  <Button
                    onClick={handleSendReply}
                    disabled={sending || !replyText.trim()}
                    size="sm"
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3 py-16">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium">Select a conversation</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Choose a person from the list to view their messages and reply.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Dialog */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">New Email</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => {
                  setShowCompose(false)
                  setComposeTo('')
                  setComposeSubject('')
                  setComposeBody('')
                }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">From</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={composeFrom}
                  onChange={(e) => setComposeFrom(e.target.value)}
                >
                  {accountEmail && (
                    <option value={accountEmail}>{accountEmail} (Main)</option>
                  )}
                  {accountAlias && (
                    <option value={accountAlias}>{accountAlias} (Alias)</option>
                  )}
                </select>
              </div>
              <div className="space-y-1 relative">
                <label className="text-xs text-muted-foreground font-medium">To</label>
                <Input
                  value={composeTo}
                  onChange={(e) => {
                    setComposeTo(e.target.value)
                    if (e.target.value.length >= 1) {
                      const query = e.target.value.toLowerCase()
                      const filtered = composeSuggestions.filter(
                        s => s.name.toLowerCase().includes(query) || s.email.toLowerCase().includes(query)
                      )
                      setComposeShowSuggestions(filtered.length > 0)
                    } else {
                      setComposeShowSuggestions(false)
                    }
                  }}
                  onFocus={() => {
                    setComposeToFocused(true)
                    if (composeTo.length >= 1) {
                      const query = composeTo.toLowerCase()
                      const filtered = composeSuggestions.filter(
                        s => s.name.toLowerCase().includes(query) || s.email.toLowerCase().includes(query)
                      )
                      setComposeShowSuggestions(filtered.length > 0)
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setComposeToFocused(false)
                      setComposeShowSuggestions(false)
                    }, 200)
                  }}
                  placeholder="Type name or email..."
                  type="text"
                />
                {composeShowSuggestions && composeToFocused && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {composeSuggestions
                      .filter(s => {
                        const query = composeTo.toLowerCase()
                        return s.name.toLowerCase().includes(query) || s.email.toLowerCase().includes(query)
                      })
                      .slice(0, 10)
                      .map((s, i) => (
                        <button
                          key={i}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                          onMouseDown={() => {
                            setComposeTo(s.email)
                            setComposeShowSuggestions(false)
                          }}
                        >
                          <User className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{s.name}</span>
                          <span className="text-muted-foreground truncate text-xs">{s.email}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Subject</label>
                <Input
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Email subject..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Message</label>
                <Textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your message..."
                  rows={8}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => {
                  setShowCompose(false)
                  setComposeTo('')
                  setComposeSubject('')
                  setComposeBody('')
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!composeTo || !composeSubject || !composeBody) {
                      toast.error('Please fill in all fields')
                      return
                    }
                    setComposeSending(true)
                    try {
                      const res = await fetch('/api/mailbox/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          to: composeTo,
                          subject: composeSubject,
                          body: composeBody,
                          send_as: composeFrom !== accountEmail ? composeFrom : undefined,
                        }),
                      })
                      if (!res.ok) throw new Error('Failed to send')
                      toast.success('Email sent!')
                      setShowCompose(false)
                      setComposeTo('')
                      setComposeSubject('')
                      setComposeBody('')
                      await fetchThreads()
                    } catch {
                      toast.error('Failed to send email')
                    } finally {
                      setComposeSending(false)
                    }
                  }}
                  disabled={composeSending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {composeSending ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
