'use client'

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatRupees } from '@/lib/format'
import type { ShowroomComparisonRow } from '@/lib/actions/franchise'
import { SwitchIntoCompanyButton } from './switch-into-company-button'

interface ShowroomComparisonTableProps {
  rows: ShowroomComparisonRow[]
}

/** Month-over-month delta vs the previous FULL month (approximation shown as-is). */
function momDelta(row: ShowroomComparisonRow): number | null {
  const prev = Number(row.revenue_prev_month)
  if (prev <= 0) return null
  return ((Number(row.revenue_mtd) - prev) / prev) * 100
}

export function ShowroomComparisonTable({ rows }: ShowroomComparisonTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Showroom comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No showrooms in the group yet. Invite one from Manage showrooms.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Showroom</TableHead>
                  <TableHead className="text-right">Revenue MTD</TableHead>
                  <TableHead className="text-right">vs last month</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Low stock</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const delta = momDelta(row)
                  return (
                    <TableRow key={row.company_id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatRupees(Number(row.revenue_mtd))}
                      </TableCell>
                      <TableCell className="text-right">
                        {delta === null ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Minus className="size-3" /> n/a
                          </span>
                        ) : delta >= 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-success">
                            <ArrowUpRight className="size-3" />
                            {delta.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-destructive">
                            <ArrowDownRight className="size-3" />
                            {delta.toFixed(1)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatRupees(Number(row.outstanding))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.invoice_count_mtd}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.low_stock_count}
                      </TableCell>
                      <TableCell className="text-right">
                        <SwitchIntoCompanyButton
                          companyId={row.company_id}
                          companyName={row.name}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
