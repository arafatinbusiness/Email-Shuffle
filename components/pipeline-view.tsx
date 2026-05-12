'use client'

import { Lead, LeadLayer, LAYER_DESCRIPTIONS } from '@/lib/types'
import { getPipelineStats } from '@/lib/workflow-rules'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PipelineViewProps {
  leads: Lead[]
}

export function PipelineView({ leads }: PipelineViewProps) {
  const stats = getPipelineStats(leads)
  const total = Object.values(stats).reduce((a, b) => a + b, 0)
  const layers: LeadLayer[] = ['L1', 'L2', 'L3', 'L4', 'L5+']

  const converted = leads.filter(l => l.status === 'converted').length
  const dead = leads.filter(l => l.status === 'dead').length

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Pipeline Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Funnel Visualization */}
        <div className="space-y-2">
          {layers.map((layer, index) => {
            const count = stats[layer]
            const percentage = total > 0 ? (count / total) * 100 : 0
            const layerInfo = LAYER_DESCRIPTIONS[layer]
            
            return (
              <div key={layer} className="group">
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs w-12 justify-center">
                      {layer}
                    </Badge>
                    <span className="text-muted-foreground">{layerInfo.name}</span>
                  </div>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="h-8 bg-muted rounded-md overflow-hidden">
                  <div 
                    className="h-full bg-primary/20 group-hover:bg-primary/30 transition-colors flex items-center px-2"
                    style={{ width: `${Math.max(percentage, count > 0 ? 10 : 0)}%` }}
                  >
                    {count > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {layerInfo.timing}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Outcomes */}
        <div className="flex gap-4 mt-4 pt-4 border-t">
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-green-500">{converted}</div>
            <div className="text-xs text-muted-foreground">Converted</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-red-500">{dead}</div>
            <div className="text-xs text-muted-foreground">Dead</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
