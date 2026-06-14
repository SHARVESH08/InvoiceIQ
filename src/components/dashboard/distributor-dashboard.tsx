'use client'

import { KpiCard } from '@/components/dashboard/kpi-card'
import dynamic from 'next/dynamic'
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

export interface DistributorDashboardProps {
  isAdmin: boolean
  godownStock: { godownName: string; totalQty: number }[]
  retailerOutstanding: { customerName: string; outstanding: number }[]
  pendingTransferCount: number
  /** Wave 3: ChartPanel data — passed through */
  revenueTrend: { month: string; revenue: number }[]
  topProducts: { name: string; revenue: number }[]
  paymentSplit: { mode: string; count: number; total: number }[]
}

export function DistributorDashboard({
  isAdmin,
  godownStock,
  retailerOutstanding,
  pendingTransferCount,
  revenueTrend,
  topProducts,
  paymentSplit,
}: DistributorDashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI Grid: 2-col mobile, 4-col desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Operational widget — visible to all roles */}
        <KpiCard
          label="Pending Transfers"
          value={pendingTransferCount}
          financial={false}
          isAdmin={isAdmin}
          highlight
        />
      </div>

      {/* Godown Stock table — operational, visible to all roles */}
      <div>
        <h2 className="text-base font-semibold mb-3">Godown Stock Levels</h2>
        {/* overflow-x-auto: prevents mobile layout breakage (07-REVIEWS.md) */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Godown</TableHead>
                <TableHead className="text-right">Total Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {godownStock.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No godown data yet
                  </TableCell>
                </TableRow>
              ) : (
                godownStock.map((g) => (
                  <TableRow key={g.godownName}>
                    <TableCell>{g.godownName}</TableCell>
                    <TableCell className="text-right">{g.totalQty}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Retailer Outstanding balances — financial, admin only (D-04, T-07-06) */}
      {isAdmin && (
        <div>
          <h2 className="text-base font-semibold mb-3">Retailer Outstanding Balances</h2>
          {/* overflow-x-auto: prevents mobile layout breakage (07-REVIEWS.md) */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {retailerOutstanding.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No outstanding balances
                    </TableCell>
                  </TableRow>
                ) : (
                  retailerOutstanding.map((r) => (
                    <TableRow key={r.customerName}>
                      <TableCell>{r.customerName}</TableCell>
                      <TableCell className="text-right">{formatRupees(r.outstanding)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* WR-03: ChartPanel — revenue trend, top products, payment split */}
      <ChartPanel
        revenueTrend={revenueTrend}
        topProducts={topProducts}
        paymentSplit={paymentSplit}
      />
    </div>
  )
}
