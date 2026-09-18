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

// ─── Customer-portal Excel export ─────────────────────────────────────────────

export type ExportCustomerInvoiceRow = {
  invoice_number: string | null
  invoice_date: string
  business_name: string
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  paid_amount: number
  /** Already resolved by the caller: 'cancelled' wins over payment_status. */
  status: string
  due_date: string | null
}

/**
 * Workbook for the customer portal's "download all invoices".
 * Differs from buildInvoiceExcel on purpose: a customer cares about WHO billed
 * them (business_name) and what's still owed (paid/balance) — not about the
 * customer column a business needs.
 */
export async function buildCustomerInvoiceExcel(
  invoices: ExportCustomerInvoiceRow[]
): Promise<Uint8Array> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const headers = [
    'Invoice No',
    'Date',
    'Business',
    'Taxable',
    'CGST',
    'SGST',
    'IGST',
    'Total',
    'Paid',
    'Balance',
    'Status',
    'Due Date',
  ]
  const rows = invoices.map((inv) => [
    inv.invoice_number ?? '',
    inv.invoice_date,
    inv.business_name,
    inv.taxable_amount,
    inv.cgst_amount,
    inv.sgst_amount,
    inv.igst_amount,
    inv.total_amount,
    inv.paid_amount,
    Number((inv.total_amount - inv.paid_amount).toFixed(2)),
    inv.status,
    inv.due_date ?? '',
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ]
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
