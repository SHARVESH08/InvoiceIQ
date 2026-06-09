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
  const [rows, setRows] = useState<HsnRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!from || !to) return
    setLoading(true)
    setError(null)

    getHsnSummary(from, to).then((result) => {
      if ('error' in result) {
        setError(result.error)
      } else {
        setRows(result.rows)
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
