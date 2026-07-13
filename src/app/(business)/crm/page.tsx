import {
  listDeals,
  listLeads,
  listOpenTasks,
  getCrmSegments,
  getCrmFunnel,
} from '@/lib/actions/crm'
import { CrmTabs } from './_components/crm-tabs'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// CRM — Pipeline / Leads / Follow-ups / Insights.
// RSC fetches everything once; tabs are pure client presentation over it.
// ─────────────────────────────────────────────────────────────────────────────

export default async function CrmPage() {
  const [deals, leads, tasks, segments, funnel] = await Promise.all([
    listDeals(),
    listLeads(),
    listOpenTasks(),
    getCrmSegments(),
    getCrmFunnel(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">CRM</h1>
        <p className="text-sm text-muted-foreground">
          Leads, deals and follow-ups, next to the invoices they become.
        </p>
      </div>

      <CrmTabs
        deals={deals}
        leads={leads}
        tasks={tasks}
        segments={segments}
        funnel={funnel}
      />
    </div>
  )
}
