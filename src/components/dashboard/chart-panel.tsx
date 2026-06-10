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
// ChartPanel — pure render component; receives pre-fetched data from RSC.
// Never fetches data itself. All Recharts imports are inside 'use client' to
// prevent RSC build crashes.
// ─────────────────────────────────────────────────────────────────────────────

interface ChartPanelProps {
  revenueTrend: { month: string; revenue: number }[]
  topProducts: { name: string; revenue: number }[]
  paymentSplit: { mode: string; count: number; total: number }[]
}

// Payment mode colors (semantic, per UI-SPEC)
const PAYMENT_COLORS: Record<string, string> = {
  cash: '#22c55e',
  upi: '#3b82f6',
  bank_transfer: '#f59e0b',
  razorpay: '#8b5cf6',
  cheque: '#ec4899',
}

// Human-readable payment-mode labels (no underscores) for the legend + tooltip
const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  razorpay: 'Razorpay',
  cheque: 'Cheque',
}

function paymentLabel(mode: string): string {
  return (
    PAYMENT_LABELS[mode] ??
    mode.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

export function ChartPanel({ revenueTrend, topProducts, paymentSplit }: ChartPanelProps) {
  // Truncate long product names so Y-axis labels fit (layout="vertical")
  const truncatedProducts = topProducts.map((p) => ({
    ...p,
    name: p.name.length > 16 ? p.name.slice(0, 16) + '...' : p.name,
  }))

  return (
    <div className="space-y-6">

      {/* ── Section 1: Revenue Trend LineChart ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Trend (12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueTrend.length === 0 ? (
            <div className="h-[240px] lg:h-[320px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                No data yet — your dashboard will populate as invoices are created.
              </p>
            </div>
          ) : (
            <div className="h-[240px] w-full lg:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(v) => formatRupees(v)}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(v) => [formatRupees(Number(v ?? 0)), 'Revenue']}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: Top Products BarChart (horizontal — layout="vertical") ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 5 Products by Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          {truncatedProducts.length === 0 ? (
            <div className="h-[240px] lg:h-[320px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No data yet</p>
            </div>
          ) : (
            <div className="h-[240px] w-full lg:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                {/* layout="vertical" places product names on Y axis (readable, per UI-SPEC) */}
                <BarChart data={truncatedProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => formatRupees(v)}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(v) => [formatRupees(Number(v ?? 0)), 'Revenue']}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Payment Mode PieChart ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Mode Split</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentSplit.length === 0 ? (
            <div className="h-[240px] lg:h-[320px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No data yet</p>
            </div>
          ) : (
            <div className="h-[240px] w-full lg:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentSplit}
                    dataKey="total"
                    nameKey="mode"
                    cx="50%"
                    cy="45%"
                    outerRadius={80}
                    label={({ percent }: PieLabelRenderProps) =>
                      (percent ?? 0) > 0 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ''
                    }
                  >
                    {paymentSplit.map((entry) => (
                      <Cell
                        key={entry.mode}
                        fill={PAYMENT_COLORS[entry.mode] ?? '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value) => paymentLabel(String(value))}
                  />
                  <Tooltip
                    formatter={(v, name) => [
                      formatRupees(Number(v ?? 0)),
                      paymentLabel(String(name)),
                    ]}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
