'use client'

import { Lead } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Mail, MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react'
import { isToday, isPast, isFuture } from 'date-fns'

interface StatsCardsProps {
  leads: Lead[]
}

export function StatsCards({ leads }: StatsCardsProps) {
  const stats = {
    total: leads.length,
    cold: leads.filter(l => l.status === 'cold').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    replied: leads.filter(l => l.status === 'replied').length,
    converted: leads.filter(l => l.status === 'converted').length,
    dead: leads.filter(l => l.status === 'dead').length,
    overdueFollowups: leads.filter(l => 
      l.next_follow_up && isPast(new Date(l.next_follow_up)) && !isToday(new Date(l.next_follow_up))
    ).length,
    todayFollowups: leads.filter(l => 
      l.next_follow_up && isToday(new Date(l.next_follow_up))
    ).length,
  }

  const cards = [
    { title: 'Total Leads', value: stats.total, icon: Users, color: 'text-foreground' },
    { title: 'Cold', value: stats.cold, icon: Mail, color: 'text-blue-400' },
    { title: 'Contacted', value: stats.contacted, icon: MessageSquare, color: 'text-amber-400' },
    { title: 'Replied', value: stats.replied, icon: MessageSquare, color: 'text-emerald-400' },
    { title: 'Converted', value: stats.converted, icon: CheckCircle, color: 'text-green-400' },
    { title: 'Dead', value: stats.dead, icon: XCircle, color: 'text-red-400' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {(stats.overdueFollowups > 0 || stats.todayFollowups > 0) && (
        <div className="flex gap-4">
          {stats.overdueFollowups > 0 && (
            <Card className="bg-red-500/10 border-red-500/30 flex-1">
              <CardContent className="flex items-center gap-3 py-3">
                <Clock className="h-5 w-5 text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-400">
                    {stats.overdueFollowups} Overdue Follow-up{stats.overdueFollowups !== 1 ? 's' : ''}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {stats.todayFollowups > 0 && (
            <Card className="bg-amber-500/10 border-amber-500/30 flex-1">
              <CardContent className="flex items-center gap-3 py-3">
                <Clock className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-400">
                    {stats.todayFollowups} Follow-up{stats.todayFollowups !== 1 ? 's' : ''} Due Today
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
