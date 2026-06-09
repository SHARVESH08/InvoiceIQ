import Papa from 'papaparse'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportInvoiceRow = {
  invoice_number: string
  invoice_date: string
  customer_name: string
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  payment_status: string
}

// ─── Excel export ─────────────────────────────────────────────────────────────

/**
 * Build a valid .xlsx workbook from invoice rows.
 * Returns a Uint8Array suitable for download or Blob construction.
 * Mirrors the pattern in src/lib/gst/gstn-export.ts.
 */
export async function buildInvoiceExcel(invoices: ExportInvoiceRow[]): Promise<Uint8Array> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const headers = ['Invoice No', 'Date', 'Customer', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Status']
  const rows = invoices.map((inv) => [
    inv.invoice_number,
    inv.invoice_date,
    inv.customer_name,
    inv.taxable_amount,
    inv.cgst_amount,
    inv.sgst_amount,
    inv.igst_amount,
    inv.total_amount,
    inv.payment_status,
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices')

  const rawArr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayLike<number>
  return new Uint8Array(rawArr)
}

// ─── CSV export ───────────────────────────────────────────────────────────────

/**
 * Build a CSV string from invoice rows.
 * First column is 'Invoice No' (maps to invoice_number).
 */
export function buildInvoiceCsv(invoices: ExportInvoiceRow[]): string {
  return Papa.unparse({
    fields: ['Invoice No', 'Date', 'Customer', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Status'],
    data: invoices.map((inv) => [
      inv.invoice_number,
      inv.invoice_date,
      inv.customer_name,
      inv.taxable_amount,
      inv.cgst_amount,
      inv.sgst_amount,
      inv.igst_amount,
      inv.total_amount,
      inv.payment_status,
    ]),
  })
}

// ─── Download trigger ─────────────────────────────────────────────────────────

/**
 * Programmatically trigger a file download in the browser.
 */
export function triggerDownload(
  data: Uint8Array | string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([data as BlobPart], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
