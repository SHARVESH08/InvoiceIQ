import { describe, it, expect } from 'vitest'
import { reconcile2b } from '@/lib/gst/gstr2b-reconcile'
import type { Gstr2bRow } from '@/lib/gst/gstr2b-parser'
import type { PurchaseOrderRow } from '@/lib/gst/gstr2b-reconcile'

const GSTIN = '33AABCU9603R1ZX'

function make2bRow(invoiceNum: string, amount = 10000): Gstr2bRow {
  return {
    gstin: GSTIN,
    invoiceNum,
    invoiceDate: '01-06-2025',
    invoiceValue: amount,
    taxableValue: amount,
    igst: 1800,
    cgst: 0,
    sgst: 0,
    cess: 0,
  }
}

function makePo(po_number: string, total_amount = 10000): PurchaseOrderRow {
  return { supplier_gstin: GSTIN, po_number, total_amount }
}

describe('reconcile2b [GST-04]', () => {
  it('returns result with matched, inSystemOnly, and in2BOnly buckets [GST-04]', () => {
    const result = reconcile2b([], [])
    expect(result).toHaveProperty('matched')
    expect(result).toHaveProperty('inSystemOnly')
    expect(result).toHaveProperty('in2BOnly')
  })

  it('places invoice present in both system and 2B into matched bucket [GST-04]', () => {
    const parsed = [make2bRow('INV001')]
    const poRows = [makePo('INV001')]
    const result = reconcile2b(parsed, poRows)
    expect(result.matched).toHaveLength(1)
    expect(result.in2BOnly).toHaveLength(0)
    expect(result.inSystemOnly).toHaveLength(0)
  })

  it('places invoice only in system (not in 2B) into inSystemOnly bucket [GST-04]', () => {
    const result = reconcile2b([], [makePo('INV002')])
    expect(result.inSystemOnly).toHaveLength(1)
    expect(result.matched).toHaveLength(0)
  })

  it('places invoice only in 2B (not in system) into in2BOnly bucket [GST-04]', () => {
    const result = reconcile2b([make2bRow('INV003')], [])
    expect(result.in2BOnly).toHaveLength(1)
    expect(result.matched).toHaveLength(0)
  })

  it('matches invoice numbers differing only by dashes (INV-001 vs INV001) [GST-04]', () => {
    const parsed = [make2bRow('INV-001')]
    const poRows = [makePo('INV001')]
    const result = reconcile2b(parsed, poRows)
    expect(result.matched).toHaveLength(1)
    expect(result.in2BOnly).toHaveLength(0)
  })

  it('matches invoice numbers differing by spaces and slashes [GST-04]', () => {
    const parsed = [make2bRow('INV 001/A')]
    const poRows = [makePo('INV001A')]
    const result = reconcile2b(parsed, poRows)
    expect(result.matched).toHaveLength(1)
  })

  it('does not match when GSTIN differs [GST-04]', () => {
    const parsed: Gstr2bRow[] = [{ ...make2bRow('INV004'), gstin: '29AABCU9603R1ZX' }]
    const poRows = [makePo('INV004')]
    const result = reconcile2b(parsed, poRows)
    expect(result.matched).toHaveLength(0)
    expect(result.in2BOnly).toHaveLength(1)
    expect(result.inSystemOnly).toHaveLength(1)
  })

  it('does not match when amount differs [GST-04]', () => {
    const parsed = [make2bRow('INV005', 9999)]
    const poRows = [makePo('INV005', 10000)]
    const result = reconcile2b(parsed, poRows)
    expect(result.matched).toHaveLength(0)
  })
})
