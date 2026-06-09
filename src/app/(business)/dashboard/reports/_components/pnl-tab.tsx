'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatRupees } from '@/lib/format'
import { getPnlSummary, listInvoicesForExport } from '@/lib/actions/reports'
import type { PnlResult, ExportInvoiceRow } from '@/lib/actions/reports'

interface PnlTabProps {
  from: string
  to: string
}

interface MonthlyBar {
  month: string
  Revenue: number
}

function buildMonthlyData(invoices: ExportInvoiceRow[]): MonthlyBar[] {
  const map = new Map<string, number>()
  for (const inv of invoices) {
    // invoice_date is 'YYYY-MM-DD'
    const month = inv.invoice_date.slice(0, 7) // 'YYYY-MM'
    map.set(month, (map.get(month) ?? 0) + inv.total_amount)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, Revenue]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      Revenue,
    }))
}

export function PnlTab({ from, to }: PnlTabProps) {
  const [pnlData, setPnlData] = useState<PnlResult | null>(null)
  const [chartData, setChartData] = useState<MonthlyBar[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!from || !to) return
    setLoading(true)
    setError(null)

    Promise.all([
      getPnlSummary(from, to),
      listInvoicesForExport(from, to),
    ]).then(([pnl, exportResult]) => {
      if ('error' in pnl) {
        setError(pnl.error)
      } else {
        setPnlData(pnl)
      }
      if (!('error' in exportResult)) {
        setChartData(buildMonthlyData(exportResult.invoices))
      }
      setLoading(false)
    })
  }, [from, to])

  if (loading) {
    return <p className="text-sm text-muted-foreground py-6">Loading...</p>
  }

  if (error) {
    return <p className="text-sm text-destructive py-6">{error}</p>
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {pnlData ? formatRupees(pnlData.revenue) : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">COGS</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {pnlData ? formatRupees(pnlData.cogs) : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gross Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {pnlData ? formatRupees(pnlData.gross_margin) : '—'}
            </p>
            {pnlData && (
              <span className="text-sm text-muted-foreground">
                {pnlData.margin_percent}%
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Month BarChart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue by Month</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No sale invoices found for this period.
            </p>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(v) => formatRupees(v)}
                    tick={{ fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip
                    formatter={(v) => [formatRupees(Number(v ?? 0)), 'Revenue']}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Revenue" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            COGS total shown above in KPI cards.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
