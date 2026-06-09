'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  type PieLabelRenderProps,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatRupees } from '@/lib/format'

// ─────────────────────────────────────────────────────────────────────────────
// CustomerChartPanel — pure render component; receives pre-fetched RPC data
// from the /my RSC. Never fetches data itself.
// Renders: LineChart (12-month spend trend), BarChart (by merchant),
//          PieChart (% breakdown).
// ─────────────────────────────────────────────────────────────────────────────

interface CustomerChartPanelProps {
  spendTrend: { month: string; spend: number }[]
  spendByMerchant: { merchant: string; total: number }[]
}

const MERCHANT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6']

const TOOLTIP_STYLE = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
}

function fmtMonth(m: string) {
  return new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

export function CustomerChartPanel({ spendTrend, spendByMerchant }: CustomerChartPanelProps) {
  // Truncate long merchant names for BarChart Y-axis labels
  const truncatedMerchants = spendByMerchant.map((m) => ({
    ...m,
    merchant: m.merchant.length > 20 ? m.merchant.slice(0, 20) + '...' : m.merchant,
  }))

  return (
    <div className="space-y-6">

      {/* ── Card 1: Spend Trend LineChart ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spend Trend (12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          {spendTrend.length === 0 ? (
            <p className="text-center text-muted-foreground py-8" style={{ height: 280 }}>
              No spend data yet
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={spendTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => formatRupees(Number(v))}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v) => [formatRupees(Number(v ?? 0)), 'Spend']}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Line
                  type="monotone"
                  dataKey="spend"
                  stroke="hsl(var(--primary))"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Card 2: Spend by Business BarChart (horizontal) ─────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spend by Business</CardTitle>
        </CardHeader>
        <CardContent>
          {spendByMerchant.length === 0 ? (
            <p className="text-center text-muted-foreground py-8" style={{ height: 320 }}>
              No spend data yet
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={truncatedMerchants} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <YAxis
                  type="category"
                  dataKey="merchant"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatRupees(Number(v))}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v) => [formatRupees(Number(v ?? 0)), 'Spend']}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="total" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Card 3: Spend Breakdown PieChart ────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spend Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {spendByMerchant.length === 0 ? (
            <p className="text-center text-muted-foreground py-8" style={{ height: 320 }}>
              No spend data yet
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={spendByMerchant}
                  dataKey="total"
                  nameKey="merchant"
                  cx="50%"
                  cy="45%"
                  outerRadius={90}
                  label={({ percent }: PieLabelRenderProps) =>
                    (percent ?? 0) > 0 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ''
                  }
                >
                  {spendByMerchant.map((entry, index) => (
                    <Cell
                      key={entry.merchant}
                      fill={MERCHANT_COLORS[index % MERCHANT_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" />
                <Tooltip
                  formatter={(v) => [formatRupees(Number(v ?? 0)), 'Spend']}
                  contentStyle={TOOLTIP_STYLE}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
