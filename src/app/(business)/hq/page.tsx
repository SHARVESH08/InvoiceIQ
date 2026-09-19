import Link from 'next/link'
import { ArrowRight, Building2 } from 'lucide-react'

import { KpiCard } from '@/components/dashboard/kpi-card'
import { FranchiseTrendChart } from '@/components/franchise/franchise-trend-chart'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatRupees } from '@/lib/format'
import {
  getFranchiseOverview,
  getShowroomComparison,
  getFranchiseRevenueTrend,
  getFranchiseTopProducts,
} from '@/lib/actions/franchise'
import { ShowroomComparisonTable } from './_components/showroom-comparison-table'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// Franchise Overview — consolidated franchise view.
// All data comes from SECURITY DEFINER RPCs that gate on franchise_owners and
// return aggregates only; no row-level data crosses the tenant boundary here.
// ─────────────────────────────────────────────────────────────────────────────

export default async function HqOverviewPage() {
  const overview = await getFranchiseOverview()

  // Not an owner yet (or group deleted): explain + route to setup.
  if (!overview) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="size-6" />
        </span>
        <h1 className="font-display text-2xl font-semibold">Set up your franchise</h1>
        <p className="text-sm text-muted-foreground">
          Create a group, invite your showrooms, and see revenue, outstanding and
          stock across all of them in one place. Each showroom keeps its own
          separate account and data.
        </p>
        <Button asChild>
          <Link href="/hq/showrooms">
            Create a group <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </div>
    )
  }

  const [comparison, trend, topProducts] = await Promise.all([
    getShowroomComparison(),
    getFranchiseRevenueTrend(6),
    getFranchiseTopProducts(5),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{overview.group_name}</h1>
          <p className="text-sm text-muted-foreground">
            Group overview · {overview.member_count}{' '}
            {overview.member_count === 1 ? 'showroom' : 'showrooms'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/hq/showrooms">Manage showrooms</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Group revenue (MTD, ex-GST)"
          value={formatRupees(Number(overview.revenue_mtd))}
          highlight
        />
        <KpiCard label="Outstanding" value={formatRupees(Number(overview.outstanding))} />
        <KpiCard label="Invoices this month" value={overview.invoice_count_mtd} />
        <KpiCard label="Low stock alerts" value={overview.low_stock_count} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <FranchiseTrendChart data={trend} />
        </div>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top products, group-wide
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No sales recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {topProducts.map((p) => (
                  <li key={p.name} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="min-w-0 truncate pr-3">{p.name}</span>
                    <span className="shrink-0 font-mono text-xs">
                      {formatRupees(Number(p.revenue))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ShowroomComparisonTable rows={comparison} />
    </div>
  )
}
