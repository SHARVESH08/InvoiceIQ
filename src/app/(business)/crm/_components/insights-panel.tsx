'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatRupees } from '@/lib/format'
import type { CrmSegments } from '@/lib/actions/crm'

interface InsightsPanelProps {
  segments: CrmSegments | null
  funnel: {
    leads_total: number
    leads_converted: number
    deals_won: number
    deals_lost: number
    won_value: number
  } | null
}

export function InsightsPanel({ segments, funnel }: InsightsPanelProps) {
  const conversionRate =
    funnel && funnel.leads_total > 0
      ? Math.round((funnel.leads_converted / funnel.leads_total) * 100)
      : null
  const winRate =
    funnel && funnel.deals_won + funnel.deals_lost > 0
      ? Math.round((funnel.deals_won / (funnel.deals_won + funnel.deals_lost)) * 100)
      : null

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Conversion funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!funnel || funnel.leads_total + funnel.deals_won + funnel.deals_lost === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Add leads and deals to see conversion numbers.
            </p>
          ) : (
            <dl className="divide-y divide-border/60">
              <FunnelRow label="Leads" value={String(funnel.leads_total)} />
              <FunnelRow
                label="Converted to customers"
                value={
                  conversionRate === null
                    ? String(funnel.leads_converted)
                    : `${funnel.leads_converted} (${conversionRate}%)`
                }
              />
              <FunnelRow label="Deals won" value={String(funnel.deals_won)} />
              <FunnelRow label="Deals lost" value={String(funnel.deals_lost)} />
              {winRate !== null && <FunnelRow label="Win rate" value={`${winRate}%`} />}
              <FunnelRow label="Won value" value={formatRupees(funnel.won_value)} />
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Customer segments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!segments ? (
            <p className="py-6 text-sm text-muted-foreground">
              Segments appear once you have billing history.
            </p>
          ) : (
            <dl className="divide-y divide-border/60">
              <FunnelRow label="Top spenders (90 days)" value={`${segments.top_spenders}`} />
              <FunnelRow label="Overdue payers" value={`${segments.overdue}`} />
              <FunnelRow
                label="At risk (no purchase in 90 days)"
                value={`${segments.at_risk}`}
              />
              <FunnelRow label="New this month" value={`${segments.new_30d}`} />
            </dl>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Computed live from invoice history; no setup needed.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function FunnelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs font-medium">{value}</dd>
    </div>
  )
}
