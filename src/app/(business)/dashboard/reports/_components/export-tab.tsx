'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { listInvoicesForExport } from '@/lib/actions/reports'
import { buildInvoiceExcel, buildInvoiceCsv, triggerDownload } from '@/lib/export'

interface ExportTabProps {
  from: string
  to: string
}

export function ExportTab({ from, to }: ExportTabProps) {
  const [excelLoading, setExcelLoading] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)

  async function handleExcelDownload() {
    setExcelLoading(true)
    try {
      const result = await listInvoicesForExport(from, to)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      const bytes = await buildInvoiceExcel(result.invoices)
      triggerDownload(bytes, `invoices-${from}-${to}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    } finally {
      setExcelLoading(false)
    }
  }

  async function handleCsvDownload() {
    setCsvLoading(true)
    try {
      const result = await listInvoicesForExport(from, to)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      const csv = buildInvoiceCsv(result.invoices)
      triggerDownload(csv, `invoices-${from}-${to}.csv`, 'text/csv')
    } finally {
      setCsvLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Invoice List</CardTitle>
        <CardDescription>
          Download all invoices for the selected date range.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row gap-3 flex-wrap">
          <Button variant="outline" disabled={excelLoading} onClick={handleExcelDownload}>
            {excelLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export Excel
          </Button>
          <Button variant="outline" disabled={csvLoading} onClick={handleCsvDownload}>
            {csvLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
