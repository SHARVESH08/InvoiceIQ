'use client'

import { KpiCard } from '@/components/dashboard/kpi-card'
import dynamic from 'next/dynamic'
import { WhatsAppOrdersWidget } from '@/components/dashboard/whatsapp-orders-widget'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardDescription, CardTitle } from '@/components/ui/card'
import { formatRupees } from '@/lib/format'

const ChartPanel = dynamic(
  () => import('@/components/dashboard/chart-panel').then(m => m.ChartPanel),
  {
    ssr: false,
    loading: () => <div className="h-64 bg-muted animate-pulse rounded-md" />,
  }
)

export interface RetailerDashboardProps {
  isAdmin: boolean
  todaySales: number
  lowStockCount: number
  whatsappOrderCount: number
  /** Wave 3: ChartPanel data — passed through */
  revenueTrend: { month: string; revenue: number }[]
  topProducts: { name: string; revenue: number }[]
  paymentSplit: { mode: string; count: number; total: number }[]
}

export function RetailerDashboard({
  isAdmin,
  todaySales,
  lowStockCount,
  whatsappOrderCount,
  revenueTrend,
  topProducts,
  paymentSplit,
}: RetailerDashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI Grid: 2-col mobile, 4-col desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Financial widget — hidden for non-admin (T-07-06, D-04) */}
        <KpiCard
          label="Today's Sales"
          value={formatRupees(todaySales)}
          financial={true}
          isAdmin={isAdmin}
          highlight
        />

        {/* Low Stock Items — operational, visible to all roles */}
        <Card aria-label={`Low Stock Items: ${lowStockCount}`} className="min-h-[44px]">
          <CardHeader className="pb-2">
            <CardDescription className="text-sm text-muted-foreground">
              Low Stock Items
            </CardDescription>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
              {lowStockCount > 0 ? (
                <Badge
                  variant="destructive"
                  className="ml-1 h-4 px-1 text-xs tabular-nums"
                >
                  {lowStockCount > 99 ? '99+' : lowStockCount}
                </Badge>
              ) : (
                <span className="text-muted-foreground">0</span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* WhatsApp orders — live count widget (WA-08, D-14) */}
        <WhatsAppOrdersWidget count={whatsappOrderCount} />
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
