'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { CrmDeal, CrmLead, CrmTask, CrmSegments } from '@/lib/actions/crm'
import { PipelineBoard } from './pipeline-board'
import { LeadsTable } from './leads-table'
import { FollowUpsList } from './followups-list'
import { InsightsPanel } from './insights-panel'

interface CrmTabsProps {
  deals: CrmDeal[]
  leads: CrmLead[]
  tasks: CrmTask[]
  segments: CrmSegments | null
  funnel: {
    leads_total: number
    leads_converted: number
    deals_won: number
    deals_lost: number
    won_value: number
  } | null
}

export function CrmTabs({ deals, leads, tasks, segments, funnel }: CrmTabsProps) {
  const openTaskCount = tasks.length

  return (
    <Tabs defaultValue="pipeline">
      <TabsList>
        <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        <TabsTrigger value="leads">Leads</TabsTrigger>
        <TabsTrigger value="followups">
          Follow-ups{openTaskCount > 0 ? ` (${openTaskCount})` : ''}
        </TabsTrigger>
        <TabsTrigger value="insights">Insights</TabsTrigger>
      </TabsList>

      <TabsContent value="pipeline" className="mt-4">
        <PipelineBoard deals={deals} leads={leads} />
      </TabsContent>
      <TabsContent value="leads" className="mt-4">
        <LeadsTable leads={leads} />
      </TabsContent>
      <TabsContent value="followups" className="mt-4">
        <FollowUpsList tasks={tasks} />
      </TabsContent>
      <TabsContent value="insights" className="mt-4">
        <InsightsPanel segments={segments} funnel={funnel} />
      </TabsContent>
    </Tabs>
  )
}
