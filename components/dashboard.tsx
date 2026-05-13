'use client'

import { useState, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import useSWR, { mutate } from 'swr'
import { Lead, LeadStatus, LeadLayer } from '@/lib/types'
import { calculateNextFollowUp, NEXT_LAYER } from '@/lib/workflow-rules'
import { exportToCSV, parseCSV, parseXLSX, downloadCSV } from '@/lib/excel-utils'
import { LeadCard } from './lead-card'
import { LeadForm } from './lead-form'
import { LeadDetail } from './lead-detail'
import { ActionCenter } from './action-center'
import { PipelineView } from './pipeline-view'
import { CustomerUpdates } from './customer-updates'
import { MailboxInbox } from './mailbox-inbox'
import { MailboxSettings } from './mailbox-settings'
import { CampaignManager } from './campaign-manager'
import { EmailComposer } from './email-composer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  Database,
  Download,
  Upload,
  LayoutDashboard,
  ListTodo,
  Users,
  LogOut,
  User,
  Handshake,
  Mail,
  Send
} from 'lucide-react'
import { toast } from 'sonner'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export function Dashboard() {
  const { data: session } = useSession()
  const { data: leads = [], error, isLoading } = useSWR<Lead[]>('/api/leads', fetcher)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [layerFilter, setLayerFilter] = useState<LeadLayer | 'all'>('all')
  const [activeTab, setActiveTab] = useState('actions')
  const [activeMailboxView, setActiveMailboxView] = useState<'inbox' | 'settings'>('inbox')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Separate leads and customers
  const leadsOnly = leads.filter(l => l.lead_type !== 'customer')
  const customers = leads.filter(l => l.lead_type === 'customer')

  const filteredLeads = leadsOnly.filter(lead => {
    const matchesSearch = 
      lead.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
    const matchesLayer = layerFilter === 'all' || lead.current_layer === layerFilter

    return matchesSearch && matchesStatus && matchesLayer
  })

  const handleCreateLead = async (data: Partial<Lead>) => {
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create lead')
      await mutate('/api/leads')
      toast.success('Lead created successfully')
    } catch {
      toast.error('Failed to create lead')
    }
  }

  const handleUpdateLead = async (data: Partial<Lead>) => {
    const leadToUpdate = isEditing && selectedLead ? selectedLead : selectedLead
    if (!leadToUpdate) return
    try {
      const res = await fetch(`/api/leads/${leadToUpdate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...leadToUpdate, ...data }),
      })
      if (!res.ok) throw new Error('Failed to update lead')
      const updated = await res.json()
      setSelectedLead(updated)
      await mutate('/api/leads')
      toast.success('Lead updated successfully')
    } catch {
      toast.error('Failed to update lead')
    }
  }

  const handleMarkEmailSent = async (lead: Lead) => {
    const nextLayer = NEXT_LAYER[lead.current_layer]
    const nextFollowUp = calculateNextFollowUp(lead.current_layer)
    
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...lead,
          status: lead.status === 'cold' ? 'contacted' : lead.status,
          current_layer: nextLayer,
          last_email_sent: new Date().toISOString(),
          next_follow_up: nextFollowUp.toISOString().split('T')[0],
        }),
      })
      if (!res.ok) throw new Error('Failed to update lead')
      await mutate('/api/leads')
      toast.success(`Moved to ${nextLayer} - Follow up on ${nextFollowUp.toLocaleDateString()}`)
    } catch {
      toast.error('Failed to update lead')
    }
  }

  const handleDeleteLead = async (id: number) => {
    if (!confirm('Are you sure you want to delete this lead?')) return
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete lead')
      await mutate('/api/leads')
      toast.success('Lead deleted successfully')
    } catch {
      toast.error('Failed to delete lead')
    }
  }

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead)
    setIsDetailOpen(true)
  }

  const handleEditLead = () => {
    setIsEditing(true)
    setIsDetailOpen(false)
    setIsFormOpen(true)
  }

  // Excel Export
  const handleExport = () => {
    const csv = exportToCSV(leads)
    const date = new Date().toISOString().split('T')[0]
    downloadCSV(csv, `leads-export-${date}.csv`)
    toast.success('Leads exported to CSV')
  }

  // Extract column names from the first row of the imported file
  const extractAndSaveColumns = async (leads: Partial<Lead>[]) => {
    if (leads.length === 0) return
    // Get all keys from the first lead that are custom fields (not standard)
    const standardFields = new Set([
      'first_name', 'last_name', 'email', 'company_name', 'website',
      'status', 'current_layer', 'lead_type', 'priority', 'intent',
      'positive_points', 'improvements', 'current_website_updates',
      'fb_ads_notes', 'pixel_status', 'custom_notes', 'next_follow_up',
      'group_id', 'import_batch_id', 'upsert',
    ])
    const customColumns = new Set<string>()
    for (const lead of leads) {
      for (const key of Object.keys(lead)) {
        if (!standardFields.has(key)) {
          customColumns.add(key)
        }
      }
    }
    if (customColumns.size > 0) {
      try {
        await fetch('/api/import-columns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columns: Array.from(customColumns) }),
        })
      } catch {
        // Silently fail - columns are just for personalization hints
      }
    }
  }

  // Excel Import (supports .csv, .xlsx, .xls) - uses upsert to overwrite existing leads
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isXLSX = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

    const processLeads = async (parsedLeads: Partial<Lead>[]) => {
      if (parsedLeads.length === 0) {
        toast.error('No valid leads found. Make sure the file has "First Name" and "Email" columns.')
        return
      }

      // Save custom columns for personalization
      await extractAndSaveColumns(parsedLeads)

      let successCount = 0
      let errorCount = 0
      let customerCount = 0
      let leadCount = 0

      for (const leadData of parsedLeads) {
        try {
          // Use upsert=true so re-importing overwrites existing leads by email
          const res = await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...leadData, upsert: true }),
          })
          if (res.ok) {
            successCount++
            if (leadData.lead_type === 'customer') customerCount++
            else leadCount++
          } else errorCount++
        } catch {
          errorCount++
        }
      }

      await mutate('/api/leads')
      const typeInfo = customerCount > 0 ? ` (${customerCount} customers, ${leadCount} leads)` : ''
      toast.success(`Imported/Updated ${successCount} leads${typeInfo}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`)

    }

    if (isXLSX) {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const data = event.target?.result as ArrayBuffer
          const parsedLeads = parseXLSX(data)
          await processLeads(parsedLeads)
        } catch {
          toast.error('Failed to parse Excel file. Make sure it\'s a valid .xlsx file.')
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const content = event.target?.result as string
        const parsedLeads = parseCSV(content)
        await processLeads(parsedLeads)
      }
      reader.readAsText(file)
    }
    
    if (fileInputRef.current) fileInputRef.current.value = ''
  }


  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Database className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Database Connection Required</h2>
          <p className="text-muted-foreground max-w-md">
            Please set up your DATABASE_URL environment variable to connect to your PostgreSQL database.
          </p>
          <p className="text-sm text-muted-foreground">
            Run the SQL script in <code className="bg-muted px-1 rounded">scripts/setup-database.sql</code> to create the required tables.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Lead Manager</h1>
              <p className="text-sm text-muted-foreground">Email Outreach Workflow</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleImport}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={leads.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => mutate('/api/leads')}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={() => { setIsEditing(false); setSelectedLead(null); setIsFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{session?.user?.name || 'User'}</p>
                      <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })} className="text-red-600 cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="actions" className="gap-2">
              <ListTodo className="h-4 w-4" />
              Today's Actions
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="all-leads" className="gap-2">
              <Users className="h-4 w-4" />
              All Leads ({leadsOnly.length})
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-2">
              <Handshake className="h-4 w-4" />
              Customers ({customers.length})
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2">
              <Send className="h-4 w-4" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="mailbox" className="gap-2">
              <Mail className="h-4 w-4" />
              Mailbox
            </TabsTrigger>
          </TabsList>

          {/* TODAY'S ACTIONS - Main Feature */}
          <TabsContent value="actions" className="space-y-6">
            <ActionCenter 
              leads={leadsOnly} 
              onSelectLead={handleSelectLead}
              onUpdateLead={handleMarkEmailSent}
            />
          </TabsContent>

          {/* PIPELINE VIEW */}
          <TabsContent value="pipeline" className="space-y-6">
            <PipelineView leads={leadsOnly} />
          </TabsContent>

          {/* ALL LEADS */}
          <TabsContent value="all-leads" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatus | 'all')}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="replied">Replied</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="dead">Dead</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={layerFilter} onValueChange={(v) => setLayerFilter(v as LeadLayer | 'all')}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Layer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Layers</SelectItem>
                    <SelectItem value="L1">L1</SelectItem>
                    <SelectItem value="L2">L2</SelectItem>
                    <SelectItem value="L3">L3</SelectItem>
                    <SelectItem value="L4">L4</SelectItem>
                    <SelectItem value="L5+">L5+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-40 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {leadsOnly.length === 0 ? 'No leads yet. Add your first lead to get started!' : 'No leads match your filters.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onSelect={handleSelectLead}
                    onDelete={handleDeleteLead}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* CUSTOMERS TAB */}
          <TabsContent value="customers" className="space-y-6">
            <CustomerUpdates
              customers={customers}
              onSelectCustomer={handleSelectLead}
              onUpdateCustomer={handleUpdateLead}
              onDeleteCustomer={handleDeleteLead}
            />
          </TabsContent>

          {/* CAMPAIGNS TAB */}
          <TabsContent value="campaigns" className="space-y-6">
            <CampaignManager />
          </TabsContent>

          {/* MAILBOX TAB */}
          <TabsContent value="mailbox" className="space-y-6">
            {activeMailboxView === 'inbox' ? (
              <MailboxInbox onOpenSettings={() => setActiveMailboxView('settings')} />
            ) : (
              <MailboxSettings onBack={() => setActiveMailboxView('inbox')} />
            )}
          </TabsContent>
        </Tabs>
      </main>

      <LeadForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        lead={isEditing ? selectedLead : null}
        onSubmit={isEditing ? handleUpdateLead : handleCreateLead}
      />

      <LeadDetail
        lead={selectedLead}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={handleEditLead}
        onUpdate={handleUpdateLead}
      />
    </div>
  )
}
