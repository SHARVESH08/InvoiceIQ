'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatRupees } from '@/lib/format'

interface FranchiseTrendChartProps {
  data: { month: string; revenue: number }[]
}

/**
 * FranchiseTrendChart — pure render component; receives pre-fetched RPC data
 * from the HQ overview RSC (same pattern as dashboard ChartPanel).
 */
export function FranchiseTrendChart({ data }: FranchiseTrendChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Group revenue trend (ex-GST)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="hqGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(38 91% 55%)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="hsl(38 91% 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(28 6% 17%)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                stroke="hsl(40 10% 45%)"
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => formatRupees(v)}
                tick={{ fontSize: 11 }}
                stroke="hsl(40 10% 45%)"
                tickLine={false}
                width={84}
              />
              <Tooltip
                formatter={(value) => [formatRupees(Number(value)), 'Revenue']}
                contentStyle={{
                  background: 'hsl(30 6% 9%)',
                  border: '1px solid hsl(28 6% 17%)',
                  borderRadius: 10,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(38 91% 55%)"
                strokeWidth={2}
                fill="url(#hqGold)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
