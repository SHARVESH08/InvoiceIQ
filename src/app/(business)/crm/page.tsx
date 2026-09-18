import { getCrmPageData } from '@/lib/actions/crm'
import { getTelephonyStatus } from '@/lib/actions/telephony'
import { CrmTabs } from './_components/crm-tabs'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// CRM — Pipeline / Leads / Follow-ups / Insights.
// RSC fetches everything once; tabs are pure client presentation over it.
//
// getCrmPageData bundles the five CRM reads behind a single auth + company-id
// resolution; telephony status is independent, so it runs alongside.
// ─────────────────────────────────────────────────────────────────────────────

export default async function CrmPage() {
  const [data, telephony] = await Promise.all([getCrmPageData(), getTelephonyStatus()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">CRM</h1>
        <p className="text-sm text-muted-foreground">
          Leads, deals and follow-ups, next to the invoices they become.
        </p>
      </div>

      <CrmTabs
        deals={data.deals}
        leads={data.leads}
        tasks={data.tasks}
        segments={data.segments}
        funnel={data.funnel}
        telephonyEnabled={telephony.configured}
      />
    </div>
  )
}
