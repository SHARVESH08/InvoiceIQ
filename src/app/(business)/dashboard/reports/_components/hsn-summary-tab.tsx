'use client'

import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRupees } from '@/lib/format'
import { getHsnSummary } from '@/lib/actions/reports'
import type { HsnRow } from '@/lib/actions/reports'

interface HsnSummaryTabProps {
  from: string
  to: string
}

export function HsnSummaryTab({ from, to }: HsnSummaryTabProps) {
  // Result keyed by the request params; `loading` is derived instead of set
  // synchronously in the effect (react-hooks/set-state-in-effect). The key
  // check also drops stale responses when from/to change mid-flight.
  const key = `${from}|${to}`
  const [result, setResult] = useState<{
    key: string
    rows?: HsnRow[]
    error?: string
  } | null>(null)

  useEffect(() => {
    if (!from || !to) return
    let stale = false
    getHsnSummary(from, to).then((res) => {
      if (stale) return
      setResult('error' in res ? { key, error: res.error } : { key, rows: res.rows })
    })
    return () => {
      stale = true
    }
  }, [from, to, key])

  const loading = Boolean(from && to) && result?.key !== key
  const error = result?.key === key ? result.error ?? null : null
  const rows = (result?.key === key ? result.rows : undefined) ?? []

  if (loading) {
    return <p className="text-sm text-muted-foreground py-6">Loading...</p>
  }

  if (error) {
    return <p className="text-sm text-destructive py-6">{error}</p>
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6">
        No data for this period.
      </p>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>HSN Code</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Taxable Value</TableHead>
            <TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead>
            <TableHead className="text-right">IGST</TableHead>
            <TableHead className="text-right">Total Tax</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.hsn_code}>
              <TableCell className="font-medium">{row.hsn_code}</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-right">{formatRupees(row.taxable_value)}</TableCell>
              <TableCell className="text-right">{formatRupees(row.cgst)}</TableCell>
              <TableCell className="text-right">{formatRupees(row.sgst)}</TableCell>
              <TableCell className="text-right">{formatRupees(row.igst)}</TableCell>
              <TableCell className="text-right font-medium">{formatRupees(row.total_tax)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
