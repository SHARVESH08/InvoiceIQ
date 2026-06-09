/**
 * Phase 12 Plan 04 — Tally CSV import tests
 * Covers: REPORTS-04 (TallyRowSchema, parseTallyCsv)
 */

import { describe, it, expect } from 'vitest'
import { TallyRowSchema, parseTallyCsv, normalizeTallyRow } from '@/lib/tally-import'

// ─── TallyRowSchema ───────────────────────────────────────────────────────────

describe('TallyRowSchema', () => {
  it('validates a well-formed Tally row', () => {
    const result = TallyRowSchema.safeParse({
      invoice_date: '01-Apr-25',
      customer_name: 'ABC Ltd',
      total_amount: '1180',
    })
    expect(result.success).toBe(true)
  })

  it('coerces numeric string fields to numbers', () => {
    const result = TallyRowSchema.safeParse({
      invoice_date: '01-Apr-25',
      customer_name: 'ABC Ltd',
      taxable_amount: '1000',
      cgst_amount: '90',
      sgst_amount: '90',
      igst_amount: '0',
      total_amount: '1180',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(typeof result.data.taxable_amount).toBe('number')
      expect(result.data.taxable_amount).toBe(1000)
      expect(result.data.cgst_amount).toBe(90)
    }
  })

  it('rejects a row with missing invoice_date', () => {
    const result = TallyRowSchema.safeParse({
      customer_name: 'ABC Ltd',
      total_amount: '1180',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a row with missing customer_name', () => {
    const result = TallyRowSchema.safeParse({
      invoice_date: '01-Apr-25',
      total_amount: '1180',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a row missing total_amount', () => {
    const result = TallyRowSchema.safeParse({
      invoice_date: '01-Apr-25',
      customer_name: 'ABC Ltd',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty object', () => {
    const result = TallyRowSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('defaults numeric fields to 0 if absent', () => {
    const result = TallyRowSchema.safeParse({
      invoice_date: '01-Apr-25',
      customer_name: 'ABC Ltd',
      total_amount: '1000',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.taxable_amount).toBe(0)
      expect(result.data.cgst_amount).toBe(0)
    }
  })
})

// ─── normalizeTallyRow ────────────────────────────────────────────────────────

describe('normalizeTallyRow', () => {
  it('maps Tally column names to canonical field names', () => {
    const raw = {
      'Date': '01-Apr-25',
      'Party Name': 'ABC Ltd',
      'Voucher No': 'VCH/001',
      'Taxable Value': '1000',
      'CGST Amount': '90',
      'SGST Amount': '90',
      'IGST Amount': '0',
      'Total Amount': '1180',
    }
    const normalized = normalizeTallyRow(raw)
    expect(normalized.invoice_date).toBe('01-Apr-25')
    expect(normalized.customer_name).toBe('ABC Ltd')
    expect(normalized.tally_voucher_no).toBe('VCH/001')
    expect(normalized.taxable_amount).toBe('1000')
  })

  it('handles alias variants case-insensitively', () => {
    const raw = {
      'invoice date': '01-Apr-25',  // lowercase
      'ledger': 'XYZ Corp',         // alias for customer_name
      'grand total': '500',         // alias for total_amount
    }
    const normalized = normalizeTallyRow(raw)
    expect(normalized.invoice_date).toBe('01-Apr-25')
    expect(normalized.customer_name).toBe('XYZ Corp')
    expect(normalized.total_amount).toBe('500')
  })
})

// ─── parseTallyCsv ────────────────────────────────────────────────────────────

describe('parseTallyCsv', () => {
  it('parses valid CSV and returns valid/invalid row counts', async () => {
    // 3 rows: 2 valid, 1 missing invoice_date (empty Date field)
    const csvContent = [
      'Date,Party Name,Voucher No,Taxable Value,CGST Amount,SGST Amount,IGST Amount,Total Amount',
      '01-Apr-25,ABC Ltd,VCH/001,1000,90,90,0,1180',
      ',Missing Date Co,VCH/002,500,45,45,0,590',  // missing Date → fails invoice_date required
      '15-May-25,XYZ Corp,VCH/003,2000,180,180,0,2360',
    ].join('\n')

    const result = await parseTallyCsv(csvContent)

    expect(result.valid).toHaveLength(2)
    expect(result.invalid).toHaveLength(1)
    expect(result.invalid[0].rowIndex).toBe(3) // row 3 in file (header=1, first data=2, second data=3)
  })

  it('returns all valid when every row passes schema', async () => {
    const csvContent = [
      'Date,Party Name,Voucher No,Total Amount',
      '01-Apr-25,ABC Ltd,VCH/001,1180',
      '02-Apr-25,XYZ Corp,VCH/002,590',
    ].join('\n')

    const result = await parseTallyCsv(csvContent)

    expect(result.valid).toHaveLength(2)
    expect(result.invalid).toHaveLength(0)
  })

  it('returns all invalid when no rows have required fields', async () => {
    const csvContent = [
      'Voucher No,Total Amount',
      'VCH/001,1180',
      'VCH/002,590',
    ].join('\n')

    const result = await parseTallyCsv(csvContent)

    // Missing both invoice_date and customer_name columns
    expect(result.invalid.length).toBeGreaterThan(0)
  })
})
