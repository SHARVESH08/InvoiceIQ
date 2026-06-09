/**
 * Phase 12 Plan 04 — Excel/CSV export tests
 * Covers: REPORTS-03 (buildInvoiceExcel, buildInvoiceCsv)
 */

import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { buildInvoiceExcel, buildInvoiceCsv } from '@/lib/export'

const sampleInvoice = {
  invoice_number: 'INV/2026/0001',
  invoice_date: '2026-04-01',
  customer_name: 'Test Co',
  taxable_amount: 1000,
  cgst_amount: 90,
  sgst_amount: 90,
  igst_amount: 0,
  total_amount: 1180,
  payment_status: 'paid',
}

describe('buildInvoiceExcel', () => {
  it('produces Uint8Array with correct column headers', async () => {
    const result = await buildInvoiceExcel([sampleInvoice])

    expect(result).toBeInstanceOf(Uint8Array)

    // Parse the output to verify it's a valid xlsx
    const wb = XLSX.read(result, { type: 'array' })
    expect(wb.SheetNames).toContain('Invoices')

    const ws = wb.Sheets['Invoices']
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })

    // First row should be headers
    const headers = data[0] as string[]
    expect(headers).toEqual([
      'Invoice No', 'Date', 'Customer', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Status',
    ])
  })

  it('includes data row with invoice_number in column A', async () => {
    const result = await buildInvoiceExcel([sampleInvoice])
    const wb = XLSX.read(result, { type: 'array' })
    const ws = wb.Sheets['Invoices']
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })

    const firstDataRow = data[1] as any[]
    expect(firstDataRow[0]).toBe('INV/2026/0001')
  })

  it('returns empty sheet with only headers for empty input', async () => {
    const result = await buildInvoiceExcel([])
    const wb = XLSX.read(result, { type: 'array' })
    const ws = wb.Sheets['Invoices']
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })
    expect(data).toHaveLength(1) // only header row
  })
})

describe('buildInvoiceCsv', () => {
  it('produces CSV string with invoice_number as first column', () => {
    const result = buildInvoiceCsv([sampleInvoice])

    expect(typeof result).toBe('string')
    const lines = result.trim().split(/\r?\n/)
    // First line is the header
    expect(lines[0]).toBe('Invoice No,Date,Customer,Taxable,CGST,SGST,IGST,Total,Status')
  })

  it('includes invoice data in second row', () => {
    const result = buildInvoiceCsv([sampleInvoice])
    const lines = result.trim().split(/\r?\n/)
    expect(lines[1]).toContain('INV/2026/0001')
  })

  it('returns only header row for empty input', () => {
    const result = buildInvoiceCsv([])
    const lines = result.trim().split(/\r?\n/)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toBe('Invoice No,Date,Customer,Taxable,CGST,SGST,IGST,Total,Status')
  })
})
