'use client'

import { useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { getAllMyInvoicesForExport } from '@/lib/actions/customer-invoices'
import { buildCustomerInvoiceExcel, triggerDownload } from '@/lib/export'

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Downloads every invoice the customer can see as .xlsx — not just the page
 * currently on screen. The xlsx dependency is loaded lazily inside
 * buildCustomerInvoiceExcel, so it stays out of the initial /my bundle.
 */
export function ExportInvoicesButton({ disabled }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      const result = await getAllMyInvoicesForExport()

      if ('error' in result) {
        toast.error(result.error)
        return
      }
      if (result.invoices.length === 0) {
        toast('No invoices to export yet')
        return
      }

      const workbook = await buildCustomerInvoiceExcel(result.invoices)
      const stamp = new Date().toISOString().slice(0, 10)
      triggerDownload(workbook, `my-invoices-${stamp}.xlsx`, XLSX_MIME)

      if (result.truncated) {
        toast.warning(
          `Exported the ${result.invoices.length} most recent invoices. Contact the business for older records.`
        )
      } else {
        toast.success(`Exported ${result.invoices.length} invoices`)
      }
    } catch {
      toast.error('Could not build the file. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={busy || disabled}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-4 w-4 mr-2" />
      )}
      {busy ? 'Preparing…' : 'Download all as Excel'}
    </Button>
  )
}
