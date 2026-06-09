import { describe, it, expect } from 'vitest'
import {
  determineTaxType,
  computeLineItemTax,
  computeInvoiceTotals,
  type TaxType,
  type LineItemTaxResult,
} from '@/lib/tax/gst'

// RED phase: src/lib/tax/gst.ts does not exist yet.
// All tests here MUST FAIL until Plan 03 creates the implementation.

describe('determineTaxType', () => {
  it('B2B intra-state: buyer GSTIN state 33 = seller state 33 → intra', () => {
    expect(determineTaxType('33', '33AAPFU0939F1ZV', null)).toBe('intra')
  })

  it('B2B inter-state: buyer GSTIN state 29 ≠ seller state 33 → inter', () => {
    expect(determineTaxType('33', '29AAPFU0939F1ZV', null)).toBe('inter')
  })

  it('B2C intra-state: customer.state_code 33 = seller state 33 → intra', () => {
    expect(determineTaxType('33', null, '33')).toBe('intra')
  })

  it('B2C inter-state: customer.state_code 29 ≠ seller state 33 → inter', () => {
    expect(determineTaxType('33', null, '29')).toBe('inter')
  })

  it('unknown buyer state (both null) → inter (IGST safe default per D-05)', () => {
    expect(determineTaxType('33', null, null)).toBe('inter')
  })

  it('invalid GSTIN → treat as unknown → inter (IGST)', () => {
    expect(determineTaxType('33', 'INVALID_GSTIN', null)).toBe('inter')
  })
})

describe('computeLineItemTax', () => {
  it('₹100 × 1 qty × 18% intra-state → taxable 10000p, CGST 900p, SGST 900p, IGST 0', () => {
    const result = computeLineItemTax(10000, 1000, 0, 1800, 'intra')
    expect(result).toEqual({
      taxableAmountPaise: 10000,
      cgstPaise: 900,
      sgstPaise: 900,
      igstPaise: 0,
    })
  })

  it('₹100 × 1 qty × 18% inter-state → taxable 10000p, CGST 0, SGST 0, IGST 1800p', () => {
    const result = computeLineItemTax(10000, 1000, 0, 1800, 'inter')
    expect(result).toEqual({
      taxableAmountPaise: 10000,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 1800,
    })
  })

  it('odd paise case: ₹100.01 × 1 qty × 18% intra — CGST gets extra paisa (cgstPaise >= sgstPaise)', () => {
    const result = computeLineItemTax(10001, 1000, 0, 1800, 'intra')
    const totalTax = Math.round(10001 * 1800 / 10000)
    expect(result.cgstPaise + result.sgstPaise).toBe(totalTax)
    expect(result.cgstPaise).toBeGreaterThanOrEqual(result.sgstPaise)
    expect(result.igstPaise).toBe(0)
  })

  it('discount case: ₹100 × 2 qty × 10% discount × 5% intra → taxable 18000p', () => {
    // gross = 10000 * 2000 / 1000 = 20000p
    // discount = 20000 * 1000 / 10000 = 2000p
    // taxable = 20000 - 2000 = 18000p
    const result = computeLineItemTax(10000, 2000, 1000, 500, 'intra')
    expect(result.taxableAmountPaise).toBe(18000)
  })
})

describe('computeInvoiceTotals', () => {
  it('sums multiple line items and converts paise to rupees', () => {
    const lineItems: LineItemTaxResult[] = [
      {
        grossPaise: 10000,
        discountPaise: 0,
        taxableAmountPaise: 10000,
        cgstPaise: 900,
        sgstPaise: 900,
        igstPaise: 0,
      },
      {
        grossPaise: 20000,
        discountPaise: 2000,
        taxableAmountPaise: 18000,
        cgstPaise: 450,
        sgstPaise: 450,
        igstPaise: 0,
      },
    ]
    const totals = computeInvoiceTotals(lineItems)
    expect(totals.subtotal).toBeCloseTo(300) // (10000 + 20000) / 100
    expect(totals.discount_amount).toBeCloseTo(20) // 2000 / 100
    expect(totals.taxable_amount).toBeCloseTo(280) // (10000 + 18000) / 100
    expect(totals.cgst_amount).toBeCloseTo(13.5) // (900 + 450) / 100
    expect(totals.sgst_amount).toBeCloseTo(13.5) // (900 + 450) / 100
    expect(totals.igst_amount).toBeCloseTo(0)
    expect(totals.total_amount).toBeCloseTo(307) // 28000 + 1800 = 29700... wait
    // total_amount = taxable + cgst + sgst + igst = 28000 + 1350 + 1350 + 0 = 30700p = 307
  })
})
