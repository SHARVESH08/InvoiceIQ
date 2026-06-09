import { describe, it, expect } from 'vitest'
import { InvoiceSchema, LineItemSchema } from '@/lib/schemas/invoice'

// RED phase: src/lib/schemas/invoice.ts does not exist yet.
// All tests here MUST FAIL until Plan 03 creates the implementation.

// Minimal valid line item for reuse in invoice tests
const validLineItem = {
  product_id: '',
  description: 'Test product',
  hsn_code: '1234',
  qty: 1,
  rate: 100,
  discount_percent: 0,
  tax_rate: 18,
}

// Minimal valid sale invoice
const validSaleInvoice = {
  doc_type: 'sale',
  customer_id: '00000000-0000-0000-0000-000000000001',
  invoice_date: '2026-05-19',
  due_date: '2026-06-18',
  status: 'draft',
  line_items: [validLineItem],
}

describe('InvoiceSchema', () => {
  it('valid sale invoice with customer_id and 1 line item → parses successfully', () => {
    const result = InvoiceSchema.safeParse(validSaleInvoice)
    expect(result.success).toBe(true)
  })

  it('sale invoice missing customer_id → fails with "Customer required for this invoice type"', () => {
    const input = { ...validSaleInvoice, customer_id: undefined }
    const result = InvoiceSchema.safeParse(input)
    expect(result.success).toBe(false)
    const messages = result.error?.issues.map((i) => i.message) ?? []
    expect(messages).toContain('Customer required for this invoice type')
  })

  it('purchase invoice with supplier_id, no customer_id → parses successfully', () => {
    const input = {
      doc_type: 'purchase',
      supplier_id: '00000000-0000-0000-0000-000000000002',
      invoice_date: '2026-05-19',
      status: 'draft',
      line_items: [validLineItem],
    }
    const result = InvoiceSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('purchase invoice missing supplier_id → fails with "Supplier required for purchase invoices"', () => {
    const input = {
      doc_type: 'purchase',
      invoice_date: '2026-05-19',
      status: 'draft',
      line_items: [validLineItem],
    }
    const result = InvoiceSchema.safeParse(input)
    expect(result.success).toBe(false)
    const messages = result.error?.issues.map((i) => i.message) ?? []
    expect(messages).toContain('Supplier required for purchase invoices')
  })

  it('invoice with zero line_items → fails with "At least one line item required"', () => {
    const input = { ...validSaleInvoice, line_items: [] }
    const result = InvoiceSchema.safeParse(input)
    expect(result.success).toBe(false)
    const messages = result.error?.issues.map((i) => i.message) ?? []
    expect(messages.some((m) => m.includes('line item'))).toBe(true)
  })

  it('status "paid" is rejected — only draft and sent are accepted', () => {
    const input = { ...validSaleInvoice, status: 'paid' }
    const result = InvoiceSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('status "draft" is accepted', () => {
    const input = { ...validSaleInvoice, status: 'draft' }
    const result = InvoiceSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('status "sent" is accepted', () => {
    const input = { ...validSaleInvoice, status: 'sent' }
    const result = InvoiceSchema.safeParse(input)
    expect(result.success).toBe(true)
  })
})

describe('LineItemSchema', () => {
  it('qty of 0 → fails', () => {
    const result = LineItemSchema.safeParse({ ...validLineItem, qty: 0 })
    expect(result.success).toBe(false)
  })

  it('qty of 0.001 → passes (minimum valid quantity)', () => {
    const result = LineItemSchema.safeParse({ ...validLineItem, qty: 0.001 })
    expect(result.success).toBe(true)
  })

  it('discount_percent of 101 → fails', () => {
    const result = LineItemSchema.safeParse({ ...validLineItem, discount_percent: 101 })
    expect(result.success).toBe(false)
  })

  it('discount_percent of 100 → passes (full discount allowed)', () => {
    const result = LineItemSchema.safeParse({ ...validLineItem, discount_percent: 100 })
    expect(result.success).toBe(true)
  })

  it('product_id empty string → passes (optional free-text line item)', () => {
    const result = LineItemSchema.safeParse({ ...validLineItem, product_id: '' })
    expect(result.success).toBe(true)
  })

  it('description required → empty string fails', () => {
    const result = LineItemSchema.safeParse({ ...validLineItem, description: '' })
    expect(result.success).toBe(false)
  })
})
