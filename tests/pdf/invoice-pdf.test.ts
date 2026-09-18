import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { rupeesToWords } from '@/lib/pdf/number-to-words'
import { generateInvoicePdf, type InvoiceForPdf } from '@/lib/pdf/invoice-pdf'

describe('rupeesToWords', () => {
  it('returns Rupees Zero Only for 0 paise', () => {
    expect(rupeesToWords(0)).toBe('Rupees Zero Only')
  })

  it('returns Rupees One Only for 100 paise (₹1)', () => {
    expect(rupeesToWords(100)).toBe('Rupees One Only')
  })

  it('returns correct words for 125000 paise (₹1,250)', () => {
    expect(rupeesToWords(125000)).toBe('Rupees One Thousand Two Hundred Fifty Only')
  })

  it('returns correct words for 4250000 paise (₹42,500)', () => {
    expect(rupeesToWords(4250000)).toBe('Rupees Forty Two Thousand Five Hundred Only')
  })

  it('returns correct words for 10000000 paise (₹1,00,000 = 1 lakh)', () => {
    expect(rupeesToWords(10000000)).toBe('Rupees One Lakh Only')
  })

  it('returns correct words for 1000000000 paise (₹1,00,00,000 = 1 crore)', () => {
    // 1 crore rupees = 10,000,000 rupees = 1,000,000,000 paise
    expect(rupeesToWords(1000000000)).toBe('Rupees One Crore Only')
  })

  it('truncates paise — 125012345 paise (₹12,50,123.45 → ₹12,50,123)', () => {
    expect(rupeesToWords(125012345)).toBe(
      'Rupees Twelve Lakh Fifty Thousand One Hundred Twenty Three Only'
    )
  })
})

const intraStateFixture: InvoiceForPdf = {
  id: 'inv-fixture-001',
  invoice_number: 'INV-2024-0042',
  invoice_date: '2024-03-15',
  due_date: '2024-04-15',
  doc_type: 'sale',
  subtotal: 10000,
  discount_amount: 0,
  taxable_amount: 10000,
  cgst_amount: 900,
  sgst_amount: 900,
  igst_amount: 0,
  total_amount: 11800,
  customer_name: 'Acme Corp Ltd',
  customer_gstin: '33AABCA1234A1Z5',
  customer_address: '123 Industrial Estate, Chennai',
  customer_state_code: '33',
  company: {
    name: 'InvoiceIQ Technologies',
    gstin: '27AABCI5555B1Z6',
    address: '456 Tech Park, Mumbai',
  },
  invoice_items: [
    {
      description: 'Software License',
      hsn_code: '8523',
      quantity: 10,
      unit_price: 1000,
      discount_percent: 0,
      tax_rate: 18,
      taxable_amount: 10000,
      cgst_amount: 900,
      sgst_amount: 900,
      igst_amount: 0,
      total_amount: 11800,
    },
  ],
}

// @react-pdf/renderer renders a real document per call. That takes ~1.5s on an
// idle machine but comfortably exceeds vitest's 5s default when the rest of the
// suite is running in parallel, which made these tests intermittently fail.
describe('invoice-pdf', { timeout: 30_000 }, () => {
  it('PDF-01: generateInvoicePdf returns a non-empty Node Buffer', async () => {
    const buffer = await generateInvoicePdf(intraStateFixture)
    expect(buffer).toBeDefined()
    expect(buffer instanceof Buffer || buffer instanceof Uint8Array).toBe(true)
    // Real PDF is significantly larger than empty/stub output
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('PDF-01: invoice-pdf.tsx module declares import \'server-only\' on line 1', () => {
    const filePath = resolve(__dirname, '../../src/lib/pdf/invoice-pdf.tsx')
    const content = readFileSync(filePath, 'utf-8')
    const firstLine = content.split('\n')[0].trimEnd()
    expect(firstLine).toBe("import 'server-only'")
  })

  it('PDF-03: rendered PDF buffer is a valid PDF (starts with %PDF header)', async () => {
    const buffer = await generateInvoicePdf(intraStateFixture)
    // PDF spec requires first bytes to be %PDF
    const header = buffer.toString('ascii', 0, 4)
    expect(header).toBe('%PDF')
  })

  it('PDF-03: generateInvoicePdf renders without error for inter-state (IGST) invoice', async () => {
    const igstFixture: InvoiceForPdf = {
      ...intraStateFixture,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 1800,
    }
    const buffer = await generateInvoicePdf(igstFixture)
    expect(buffer.length).toBeGreaterThan(1000)
    const header = buffer.toString('ascii', 0, 4)
    expect(header).toBe('%PDF')
  })

  it('PDF-03: total_amount is correctly converted to words via rupeesToWords', () => {
    // Verify the conversion logic: total_amount=11800 → paise=1180000 → "Rupees Eleven Thousand Eight Hundred Only"
    const totalPaise = Math.round(Number(intraStateFixture.total_amount) * 100)
    const words = rupeesToWords(totalPaise)
    expect(words).toBe('Rupees Eleven Thousand Eight Hundred Only')
    expect(words).toMatch(/^Rupees .+ Only$/)
  })
})
