'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, Settings, Check, X, RefreshCw, Eye, EyeOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { SPACEMAIL_IMAP_HOST, SPACEMAIL_SMTP_HOST, DEFAULT_IMAP_PORT, DEFAULT_SMTP_PORT } from '@/lib/mailbox-types'

interface MailboxAccountData {
  id: number
  email: string
  imap_host: string
  imap_port: number
  smtp_host: string
  smtp_port: number
  sync_enabled: boolean
  last_sync_at: string | null
  created_at: string
}

interface MailboxSettingsProps {
  onBack?: () => void
}

export function MailboxSettings({ onBack }: MailboxSettingsProps) {
  const [account, setAccount] = useState<MailboxAccountData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [imapHost, setImapHost] = useState(SPACEMAIL_IMAP_HOST)
  const [imapPort, setImapPort] = useState(DEFAULT_IMAP_PORT)
  const [smtpHost, setSmtpHost] = useState(SPACEMAIL_SMTP_HOST)
  const [smtpPort, setSmtpPort] = useState(DEFAULT_SMTP_PORT)
  const [syncEnabled, setSyncEnabled] = useState(true)

  useEffect(() => {
    fetchAccount()
  }, [])

  const fetchAccount = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mailbox/account')
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setAccount(data)
          setEmail(data.email)
          setImapHost(data.imap_host)
          setImapPort(data.imap_port)
          setSmtpHost(data.smtp_host)
          setSmtpPort(data.smtp_port)
          setSyncEnabled(data.sync_enabled)
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!email || !password) {
      toast.error('Email and password are required')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/mailbox/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          imap_host: imapHost,
          imap_port: imapPort,
          smtp_host: smtpHost,
          smtp_port: smtpPort,
          sync_enabled: syncEnabled,
        }),
      })

      if (!res.ok) throw new Error('Failed to save')
      
      const data = await res.json()
      setAccount(data)
      setPassword('')
      toast.success('Mailbox account saved successfully')
    } catch {
      toast.error('Failed to save mailbox account')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Remove mailbox account? This will not delete emails from your actual mailbox.')) return

    try {
      const res = await fetch('/api/mailbox/account', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      
      setAccount(null)
      setEmail('')
      setPassword('')
      setImapHost(SPACEMAIL_IMAP_HOST)
      setImapPort(DEFAULT_IMAP_PORT)
      setSmtpHost(SPACEMAIL_SMTP_HOST)
      setSmtpPort(DEFAULT_SMTP_PORT)
      setSyncEnabled(true)
      toast.success('Mailbox account removed')
    } catch {
      toast.error('Failed to remove mailbox account')
    }
  }

  const handleSync = async () => {
    toast.info('Syncing inbox...')
    try {
      const res = await fetch('/api/mailbox/sync', { method: 'POST' })
      if (!res.ok) throw new Error('Sync failed')
      const data = await res.json()
      toast.success(`Synced ${data.synced} emails (${data.replies} replies detected)`)
      await fetchAccount()
    } catch {
      toast.error('Failed to sync inbox')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mailbox Settings</h2>
          <p className="text-sm text-muted-foreground">
            Connect your SpaceMail or other IMAP/SMTP email account
          </p>
        </div>
        {account && (
          <Badge variant="outline" className="text-emerald-500 border-emerald-500/50">
            <Check className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {account ? 'Update Mailbox Account' : 'Add Mailbox Account'}
          </CardTitle>
          <CardDescription>
            Configure your email account for sending and receiving emails through the app.
            Uses SpaceMail defaults (mail.spacemail.com for both IMAP and SMTP).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourdomain.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={account ? 'Leave blank to keep current' : 'Email account password'}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="imap_host">IMAP Host</Label>
              <Input
                id="imap_host"
                value={imapHost}
                onChange={(e) => setImapHost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imap_port">IMAP Port</Label>
              <Input
                id="imap_port"
                type="number"
                value={imapPort}
                onChange={(e) => setImapPort(parseInt(e.target.value) || 993)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp_host">SMTP Host</Label>
              <Input
                id="smtp_host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp_port">SMTP Port</Label>
              <Input
                id="smtp_port"
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(parseInt(e.target.value) || 465)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Switch
                id="sync_enabled"
                checked={syncEnabled}
                onCheckedChange={setSyncEnabled}
              />
              <Label htmlFor="sync_enabled">Enable inbox sync</Label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {account ? 'Update Account' : 'Save Account'}
                </>
              )}
            </Button>
            {account && (
              <>
                <Button variant="outline" onClick={handleSync}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </>
            )}
          </div>

          {account?.last_sync_at && (
            <p className="text-xs text-muted-foreground pt-2">
              Last synced: {new Date(account.last_sync_at).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
