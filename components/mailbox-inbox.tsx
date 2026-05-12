'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Mail,
  MailOpen,
  Send,
  RefreshCw,
  Reply,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  Inbox,
  MessageSquare,
  ExternalLink,
  Copy,
  Check,
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

export function MailboxInbox({ onOpenSettings }: MailboxInboxProps) {
  const [threads, setThreads] = useState<ThreadData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedThread, setSelectedThread] = useState<ThreadDetail | null>(null)
  const [activeTab, setActiveTab] = useState('inbox')
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [manualRecipient, setManualRecipient] = useState('')
  const [showManualRecipient, setShowManualRecipient] = useState(false)

  const fetchThreads = useCallback(async (unreadOnly = false) => {
    setLoading(true)
    try {
      const url = unreadOnly ? '/api/mailbox/threads?unread=true' : '/api/mailbox/threads'
      const res = await fetch(url)
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

  // Helper to extract email address from "Name <email>" format
  const extractEmail = (raw: string): string => {
    if (!raw) return ''
    // Try to extract from "Name" <email> format
    const match = raw.match(/<([^>]+)>/)
    if (match) return match[1].trim()
    // If it's already just an email, return as-is
    if (raw.includes('@')) return raw.trim()
    // Fallback: return raw trimmed
    return raw.trim()
  }

  // Determine the best recipient email for the current thread
  const getRecipientEmail = useCallback((): string => {
    if (!selectedThread) return ''

    // Priority 1: lead_email from the thread (from leads table)
    if (selectedThread.thread.lead_email) {
      const extracted = extractEmail(selectedThread.thread.lead_email)
      if (extracted.includes('@')) return extracted
    }

    // Priority 2: For incoming messages, extract email from sender field
    const lastMessage = selectedThread.messages[selectedThread.messages.length - 1]
    if (lastMessage.direction === 'incoming') {
      const extracted = extractEmail(lastMessage.sender)
      if (extracted.includes('@')) return extracted
    }

    // Priority 3: Look for any outgoing message's recipient in the thread (that's the lead's email)
    const outgoingMsg = [...selectedThread.messages].reverse().find(m => m.direction === 'outgoing')
    if (outgoingMsg) {
      const extracted = extractEmail(outgoingMsg.recipient)
      if (extracted.includes('@')) return extracted
    }

    // Priority 4: Last resort - try the last message's sender/recipient
    const raw = lastMessage.direction === 'incoming' ? lastMessage.sender : lastMessage.recipient
    const extracted = extractEmail(raw)
    if (extracted.includes('@')) return extracted

    return ''
  }, [selectedThread])

  // Show manual recipient input when email can't be determined
  useEffect(() => {
    if (selectedThread) {
      const email = getRecipientEmail()
      setShowManualRecipient(!email)
      if (email) setManualRecipient(email)
    } else {
      setShowManualRecipient(false)
      setManualRecipient('')
    }
  }, [selectedThread, getRecipientEmail])

  const handleSendReply = async () => {
    if (!selectedThread || !replyText.trim()) return

    // Use manual recipient if provided, otherwise auto-detect
    let recipient = manualRecipient
    if (!recipient || !recipient.includes('@')) {
      recipient = getRecipientEmail()
    }

    if (!recipient || !recipient.includes('@')) {
      toast.error('Please enter a valid recipient email address')
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
        }),
      })

      if (!res.ok) throw new Error('Failed to send')

      toast.success('Reply sent!')
      setReplyText('')
      // Refresh thread
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

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const unreadCount = threads.reduce((sum, t) => sum + t.unread_count, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mailbox</h2>
          <p className="text-sm text-muted-foreground">
            Conversations with your leads and customers
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
          <Button variant="outline" size="sm" onClick={handleReSyncAll} className="text-destructive hover:text-destructive">
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-sync All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Thread List */}
        <div className="lg:col-span-1 space-y-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="inbox" className="flex-1 gap-1">
                <Inbox className="h-4 w-4" />
                Inbox
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all" className="flex-1 gap-1">
                <MessageSquare className="h-4 w-4" />
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Loading conversations...
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No conversations yet. Sync your inbox or send an email to get started.
              </div>
            ) : (
              threads
                .filter(t => activeTab === 'inbox' ? t.unread_count > 0 : true)
                .map((thread) => (
                  <button
                    key={thread.id}
                    className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                      selectedThread?.thread.id === thread.id 
                        ? 'border-primary bg-muted/30' 
                        : 'border-border'
                    } ${thread.unread_count > 0 ? 'border-l-2 border-l-primary' : ''}`}
                    onClick={() => fetchThreadDetail(thread.id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 ${thread.unread_count > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {thread.unread_count > 0 ? (
                          <Mail className="h-4 w-4" />
                        ) : (
                          <MailOpen className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${thread.unread_count > 0 ? 'font-semibold' : ''}`}>
                          {thread.lead_first_name 
                            ? `${thread.lead_first_name} ${thread.lead_last_name || ''}`
                            : thread.last_sender || thread.lead_email || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {thread.last_subject || thread.subject}
                        </p>
                        {thread.last_preview && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {thread.last_preview}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {format(new Date(thread.last_message_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      {thread.unread_count > 0 && (
                        <Badge variant="secondary" className="text-xs px-1.5">
                          {thread.unread_count}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))
            )}
          </div>
        </div>

        {/* Thread Detail */}
        <div className="lg:col-span-2">
          {selectedThread ? (
            <div className="space-y-4">
              {/* Thread Header */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {selectedThread.thread.subject}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedThread.thread.lead_first_name 
                          ? `${selectedThread.thread.lead_first_name} ${selectedThread.thread.lead_last_name || ''}`
                          : selectedThread.thread.last_sender || 'Unknown'} 
                        {selectedThread.thread.lead_email && (
                          <span className="ml-2">({selectedThread.thread.lead_email})</span>
                        )}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {selectedThread.messages.length} message{selectedThread.messages.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>

              {/* Messages */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {selectedThread.messages.map((msg) => (
                  <Card key={msg.id} className={`${msg.direction === 'incoming' ? 'border-l-2 border-l-primary' : 'border-l-2 border-l-muted-foreground'}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={msg.direction === 'incoming' ? 'default' : 'secondary'} className="text-xs">
                            {msg.direction === 'incoming' ? 'Received' : 'Sent'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {msg.sender}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.sent_at), 'MMM d, yyyy h:mm a')}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(msg.body, `body-${msg.id}`)}
                          >
                            {copiedField === `body-${msg.id}` ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.body || (msg.body_html ? msg.body_html.replace(/<[^>]*>/g, '').trim() : '(No content)')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Reply Box */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Reply className="h-4 w-4" />
                    Reply
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {showManualRecipient && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground font-medium">
                        To (email address)
                      </label>
                      <Input
                        value={manualRecipient}
                        onChange={(e) => setManualRecipient(e.target.value)}
                        placeholder="Enter recipient email address..."
                        type="email"
                      />
                    </div>
                  )}
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your reply..."
                    rows={5}
                  />
                  <Button 
                    onClick={handleSendReply} 
                    disabled={sending || !replyText.trim()}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sending ? 'Sending...' : 'Send Reply'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3 py-16">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-medium">Select a Conversation</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Choose a conversation from the list to view messages and reply.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
