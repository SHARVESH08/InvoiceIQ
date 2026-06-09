'use client'

import { KpiCard } from '@/components/dashboard/kpi-card'
import dynamic from 'next/dynamic'
import { PlaceholderWidget } from '@/components/dashboard/placeholder-widget'
import { formatRupees } from '@/lib/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const ChartPanel = dynamic(
  () => import('@/components/dashboard/chart-panel').then(m => m.ChartPanel),
  {
    ssr: false,
    loading: () => <div className="h-64 bg-muted animate-pulse rounded-md" />,
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// GSTR-1 due date computation (D-12)
// Monthly filer assumption: 11th of the following month.
// Labeled "Est. GSTR-1 Due Date" to signal it is an estimate (07-REVIEWS.md).
// ─────────────────────────────────────────────────────────────────────────────
function computeGstrDueDate(): string {
  const now = new Date()
  // Next month's 11th
  const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 11)
  return dueDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export interface OemDashboardProps {
  isAdmin: boolean
  revenueMtd: number
  topDistributors: { name: string; revenue: number }[]
  /** Wave 3: ChartPanel data — passed through; empty array acceptable for now */
  revenueTrend: { month: string; revenue: number }[]
  topProducts: { name: string; revenue: number }[]
  paymentSplit: { mode: string; count: number; total: number }[]
}

export function OemDashboard({
  isAdmin,
  revenueMtd,
  topDistributors,
  revenueTrend,
  topProducts,
  paymentSplit,
}: OemDashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI Grid: 2-col mobile, 4-col desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Financial widget — hidden for non-admin (T-07-06) */}
        <KpiCard
          label="Revenue This Month"
          value={formatRupees(revenueMtd)}
          financial={true}
          isAdmin={isAdmin}
        />

        {/* GSTR due date — informational, not financial, always visible */}
        <KpiCard
          label="Est. GSTR-1 Due Date"
          value={computeGstrDueDate()}
          financial={false}
          isAdmin={isAdmin}
        />

        {/* PO count — placeholder (D-13) */}
        <PlaceholderWidget
          label="Purchase Orders"
          note="PO management arrives in a future update"
        />
      </div>

      {/* Top Distributors table */}
      <div>
        <h2 className="text-base font-semibold mb-3">Top Distributors</h2>
        {/* overflow-x-auto: prevents mobile layout breakage (07-REVIEWS.md) */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topDistributors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No data yet
                  </TableCell>
                </TableRow>
              ) : (
                topDistributors.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell>{d.name}</TableCell>
                    <TableCell className="text-right">{formatRupees(d.revenue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* WR-03: ChartPanel — revenue trend, top products, payment split */}
      <ChartPanel
        revenueTrend={revenueTrend}
        topProducts={topProducts}
        paymentSplit={paymentSplit}
      />
    </div>
  )
}
