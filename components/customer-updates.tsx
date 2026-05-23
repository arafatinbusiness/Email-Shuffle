'use client'

import { useState, useEffect } from 'react'
import { Lead } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Send, Copy, Check, Clock, RefreshCw, User, Building2, Mail, History, ChevronDown, ChevronUp, Edit } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface EmailRecord {
  id: number
  lead_id: number
  layer: string
  subject: string
  body: string
  generated_at: string
}

interface CustomerUpdatesProps {
  customers: Lead[]
  onSelectCustomer: (customer: Lead) => void
  onEditCustomer: (customer: Lead) => void
  onUpdateCustomer: (updates: Partial<Lead>) => Promise<void>
  onDeleteCustomer: (id: number) => void
}

export function CustomerUpdates({ customers, onSelectCustomer, onEditCustomer, onUpdateCustomer, onDeleteCustomer }: CustomerUpdatesProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Lead | null>(null)
  const [updateSubject, setUpdateSubject] = useState('')
  const [updateBody, setUpdateBody] = useState('')
  const [copiedField, setCopiedField] = useState<'subject' | 'body' | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [emailHistory, setEmailHistory] = useState<EmailRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null)

  // Fetch email history when a customer is selected
  useEffect(() => {
    if (selectedCustomer) {
      fetchEmailHistory(selectedCustomer.id)
    } else {
      setEmailHistory([])
    }
  }, [selectedCustomer])

  const fetchEmailHistory = async (leadId: number) => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/emails`)
      if (res.ok) {
        const data = await res.json()
        // API now returns { history: [...], messages: [...] }
        setEmailHistory(data.history || data || [])
      }

    } catch {
      // Silently fail
    } finally {
      setLoadingHistory(false)
    }
  }

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase()
    return (
      c.first_name.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q)
    )
  })

  const handleCopy = async (text: string, field: 'subject' | 'body') => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleSendUpdate = async () => {
    if (!selectedCustomer) return
    if (!updateSubject.trim() && !updateBody.trim()) {
      toast.error('Please write a subject and body first')
      return
    }

    setIsSending(true)
    try {
      // Save the update email to history
      const res = await fetch(`/api/leads/${selectedCustomer.id}/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer: 'daily-update',
          subject: updateSubject,
          body: updateBody,
        }),
      })
      if (!res.ok) throw new Error('Failed to save update')

      // Mark last email sent
      await onUpdateCustomer({
        last_email_sent: new Date().toISOString(),
      })

      toast.success('Daily update saved!')
      setUpdateSubject('')
      setUpdateBody('')

      // Refresh email history
      await fetchEmailHistory(selectedCustomer.id)
    } catch {
      toast.error('Failed to save update')
    } finally {
      setIsSending(false)
    }
  }

  const generateDailyUpdate = () => {
    if (!selectedCustomer) return
    const today = format(new Date(), 'EEEE, MMMM d, yyyy')
    
    setUpdateSubject(`Project Update - ${today}`)
    setUpdateBody(`Hi ${selectedCustomer.first_name},

Here's today's update on our ongoing projects:

• [Project 1]: [Brief status update]
• [Project 2]: [Brief status update]
• [Next Steps]: [What's coming up]

Please let me know if you have any questions or need any clarification.

Best regards,
[Your Name]`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Customer Daily Updates</h2>
          <p className="text-sm text-muted-foreground">
            Send daily project updates to your customers (no pitching)
          </p>
        </div>
        <Badge variant="outline" className="text-emerald-500 border-emerald-500/50">
          {customers.length} Customer{customers.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {customers.length === 0
                  ? 'No customers yet. Add a lead with type "Customer" to get started.'
                  : 'No customers match your search.'}
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <Card
                  key={customer.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    selectedCustomer?.id === customer.id ? 'border-primary ring-1 ring-primary' : ''
                  }`}
                  onClick={() => {
                    setSelectedCustomer(customer)
                    setUpdateSubject('')
                    setUpdateBody('')
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {customer.first_name} {customer.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {customer.company_name || customer.email}
                        </p>
                      </div>
                      {customer.last_email_sent && (
                        <div className="text-xs text-muted-foreground text-right shrink-0">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {format(new Date(customer.last_email_sent), 'MMM d')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Update Composer + History */}
        <div className="lg:col-span-2 space-y-4">
          {selectedCustomer ? (
            <>
              {/* Customer Header */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Mail className="h-4 w-4 text-emerald-500" />
                        Daily Update for {selectedCustomer.first_name} {selectedCustomer.last_name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {selectedCustomer.company_name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {selectedCustomer.company_name}
                          </span>
                        )}
                        <span className="ml-2 text-muted-foreground">
                          {selectedCustomer.email}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditCustomer(selectedCustomer)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateDailyUpdate}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Generate Template
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Subject Line */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Subject Line</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(updateSubject, 'subject')}
                    >
                      {copiedField === 'subject' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span className="ml-1.5">Copy</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Input
                    value={updateSubject}
                    onChange={(e) => setUpdateSubject(e.target.value)}
                    placeholder="Enter subject line for today's update..."
                  />
                </CardContent>
              </Card>

              {/* Email Body */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Email Body</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(updateBody, 'body')}
                    >
                      {copiedField === 'body' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span className="ml-1.5">Copy</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={updateBody}
                    onChange={(e) => setUpdateBody(e.target.value)}
                    className="min-h-[250px]"
                    rows={12}
                    placeholder={`Write your daily update here...

Example:
- Project progress updates
- Milestones achieved
- Next steps
- Any blockers or questions`}
                  />
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex gap-3">
                <Button
                  onClick={handleSendUpdate}
                  disabled={isSending || (!updateSubject.trim() && !updateBody.trim())}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSending ? 'Saving...' : 'Save & Mark Sent'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCustomer(null)
                    setUpdateSubject('')
                    setUpdateBody('')
                  }}
                >
                  Clear
                </Button>
              </div>

              {/* Email History */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Update History</CardTitle>
                    {loadingHistory && (
                      <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                    {!loadingHistory && emailHistory.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {emailHistory.length} update{emailHistory.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingHistory ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Loading history...
                    </div>
                  ) : emailHistory.length === 0 ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No updates saved yet. Write and save your first daily update above.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {emailHistory.map((email) => (
                        <div
                          key={email.id}
                          className="border rounded-lg overflow-hidden"
                        >
                          <button
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                            onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {email.subject}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(email.generated_at), 'MMM d, yyyy h:mm a')}
                                <span className="ml-2 text-emerald-500">daily-update</span>
                              </p>
                            </div>
                            {expandedEmail === email.id ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                            )}
                          </button>
                          {expandedEmail === email.id && (
                            <div className="px-3 pb-3 border-t pt-2">
                              <p className="text-sm whitespace-pre-wrap">{email.body}</p>
                              <div className="flex gap-2 mt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopy(email.subject, 'subject')}
                                >
                                  {copiedField === 'subject' ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                  <span className="ml-1 text-xs">Copy Subject</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopy(email.body, 'body')}
                                >
                                  {copiedField === 'body' ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                  <span className="ml-1 text-xs">Copy Body</span>
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3 py-16">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <Mail className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="text-lg font-medium">Select a Customer</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Choose a customer from the list to compose and send their daily project update.
                  These are not pitches - just regular progress updates.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
