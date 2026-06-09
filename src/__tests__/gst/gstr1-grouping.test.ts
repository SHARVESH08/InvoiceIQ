import { describe, it, expect } from 'vitest'
import { groupInvoicesIntoGstr1 } from '@/lib/gst/gstr1'
import type { InvoiceRow, InvoiceItemRow } from '@/lib/gst/gstr1'

const baseItem = (invoice_id: string, hsn_code: string, tax_rate: number): InvoiceItemRow => ({
  invoice_id,
  hsn_code,
  tax_rate,
  taxable_amount: 1000,
  cgst_amount: tax_rate / 2 * 10,
  sgst_amount: tax_rate / 2 * 10,
  igst_amount: 0,
})

const b2bInvoice = (id: string): InvoiceRow => ({
  id,
  invoice_number: `INV-${id}`,
  invoice_date: '2025-06-01',
  invoice_type: 'B2B',
  taxable_amount: 10000,
  cgst_amount: 900,
  sgst_amount: 900,
  igst_amount: 0,
  state_code: '33',
  customer_gstin: '33AABCU9603R1ZX',
})

describe('groupInvoicesIntoGstr1 [GST-01]', () => {
  it('places invoice with taxable_amount > 250000 in B2CL, not B2CS [GST-01]', () => {
    const inv: InvoiceRow = {
      id: '1', invoice_number: 'INV-001', invoice_date: '2025-06-01',
      invoice_type: 'B2CL', taxable_amount: 300000,
      cgst_amount: 0, sgst_amount: 0, igst_amount: 27000,
      state_code: '29', customer_gstin: null,
    }
    const item: InvoiceItemRow = {
      invoice_id: '1', hsn_code: '9983', tax_rate: 18,
      taxable_amount: 300000, cgst_amount: 0, sgst_amount: 0, igst_amount: 27000,
    }
    const result = groupInvoicesIntoGstr1([inv], [item])
    expect(result.b2cl).toHaveLength(1)
    expect(result.b2cs).toHaveLength(0)
  })

  it('places invoice with taxable_amount <= 250000 in B2CS, not B2CL [GST-01]', () => {
    const inv: InvoiceRow = {
      id: '2', invoice_number: 'INV-002', invoice_date: '2025-06-01',
      invoice_type: 'B2CL', taxable_amount: 200000,
      cgst_amount: 0, sgst_amount: 0, igst_amount: 18000,
      state_code: '29', customer_gstin: null,
    }
    const item: InvoiceItemRow = {
      invoice_id: '2', hsn_code: '9983', tax_rate: 18,
      taxable_amount: 200000, cgst_amount: 0, sgst_amount: 0, igst_amount: 18000,
    }
    const result = groupInvoicesIntoGstr1([inv], [item])
    expect(result.b2cl).toHaveLength(0)
    expect(result.b2cs).toHaveLength(0) // B2CL type with <= 250000 is dropped (not B2CS)
  })

  it('places registered buyer invoice in B2B regardless of amount [GST-01]', () => {
    const inv = b2bInvoice('3')
    const item = baseItem('3', '9983', 18)
    const result = groupInvoicesIntoGstr1([inv], [item])
    expect(result.b2b).toHaveLength(1)
    expect(result.b2b[0].ctin).toBe('33AABCU9603R1ZX')
    expect(result.b2cs).toHaveLength(0)
    expect(result.b2cl).toHaveLength(0)
  })

  it('groups line items by HSN code in hsn section [GST-01]', () => {
    const inv = b2bInvoice('4')
    const items: InvoiceItemRow[] = [
      { invoice_id: '4', hsn_code: '5050', tax_rate: 12, taxable_amount: 500, cgst_amount: 30, sgst_amount: 30, igst_amount: 0 },
      { invoice_id: '4', hsn_code: '5050', tax_rate: 12, taxable_amount: 500, cgst_amount: 30, sgst_amount: 30, igst_amount: 0 },
    ]
    const result = groupInvoicesIntoGstr1([inv], items)
    expect(result.hsn).toHaveLength(1)
    expect(result.hsn[0].txval).toBeCloseTo(1000)
  })

  it('B2CL at 300000 appears in b2cl; at 200000 does not [GST-01]', () => {
    const inv300: InvoiceRow = {
      id: '5', invoice_number: 'INV-005', invoice_date: '2025-06-01',
      invoice_type: 'B2CL', taxable_amount: 300000,
      cgst_amount: 0, sgst_amount: 0, igst_amount: 27000,
      state_code: '29', customer_gstin: null,
    }
    const inv200: InvoiceRow = {
      id: '6', invoice_number: 'INV-006', invoice_date: '2025-06-01',
      invoice_type: 'B2CL', taxable_amount: 200000,
      cgst_amount: 0, sgst_amount: 0, igst_amount: 18000,
      state_code: '29', customer_gstin: null,
    }
    const result = groupInvoicesIntoGstr1([inv300, inv200], [])
    expect(result.b2cl).toHaveLength(1)
    expect(result.b2cl[0].inv[0].inum).toBe('INV-005')
  })

  it('groups two same-state same-rate B2CS invoices into one entry [GST-01]', () => {
    const makeB2cs = (id: string): InvoiceRow => ({
      id, invoice_number: `INV-${id}`, invoice_date: '2025-06-01',
      invoice_type: 'B2CS', taxable_amount: 1000,
      cgst_amount: 90, sgst_amount: 90, igst_amount: 0,
      state_code: '33', customer_gstin: null,
    })
    const item1 = baseItem('7', '1234', 18)
    const item2 = baseItem('8', '1234', 18)
    const result = groupInvoicesIntoGstr1([makeB2cs('7'), makeB2cs('8')], [item1, item2])
    expect(result.b2cs).toHaveLength(1)
    expect(result.b2cs[0].txval).toBeCloseTo(2000)
  })

  it('HSN same code same rate → one row; same code different rate → two rows [GST-01]', () => {
    const inv = b2bInvoice('9')
    const items: InvoiceItemRow[] = [
      { invoice_id: '9', hsn_code: '5050', tax_rate: 12, taxable_amount: 500, cgst_amount: 30, sgst_amount: 30, igst_amount: 0 },
      { invoice_id: '9', hsn_code: '5050', tax_rate: 18, taxable_amount: 500, cgst_amount: 45, sgst_amount: 45, igst_amount: 0 },
    ]
    const result = groupInvoicesIntoGstr1([inv], items)
    expect(result.hsn).toHaveLength(2)
    const rates = result.hsn.map((h) => h.rt).sort()
    expect(rates).toEqual([12, 18])
  })

  it('cdnr is always an empty array [GST-01]', () => {
    const result = groupInvoicesIntoGstr1([b2bInvoice('10')], [baseItem('10', '9983', 18)])
    expect(result.cdnr).toEqual([])
  })

  it('empty invoice array returns all-empty sections [GST-01]', () => {
    const result = groupInvoicesIntoGstr1([], [])
    expect(result.b2b).toEqual([])
    expect(result.b2cs).toEqual([])
    expect(result.b2cl).toEqual([])
    expect(result.cdnr).toEqual([])
    expect(result.hsn).toEqual([])
  })
})
