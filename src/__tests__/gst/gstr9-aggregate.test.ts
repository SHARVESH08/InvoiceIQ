import { describe, it, expect } from 'vitest'
import { aggregateMonthlyForGstr9 } from '@/lib/gst/gstr9'
import type { GstPeriodDataRow } from '@/lib/gst/gstr9'

const INDIAN_FY_MONTHS = ['04','05','06','07','08','09','10','11','12','01','02','03']

function makeGstr1Row(period: string, txval: number, igst: number): GstPeriodDataRow {
  return {
    period_type: 'GSTR-1',
    period,
    data: {
      b2b: [{
        ctin: '33AABCU9603R1ZX',
        inv: [{
          inum: `INV-${period}`, idt: '01-06-2025', val: txval + igst,
          pos: '33', rchrg: 'N', inv_typ: 'R',
          itms: [{ num: 1, itm_det: { rt: 18, txval, iamt: igst, camt: 0, samt: 0, csamt: 0 } }],
        }],
      }],
      b2cs: [], b2cl: [], cdnr: [], hsn: [],
    },
  }
}

function makeGstr3bRow(period: string, itcIgst: number): GstPeriodDataRow {
  return {
    period_type: 'GSTR-3B',
    period,
    data: { itc: { igst: itcIgst, cgst: 0, sgst: 0 } },
  }
}

describe('aggregateMonthlyForGstr9 [GST-03]', () => {
  it('aggregates exactly 12 monthly GSTR-3B records for a full FY [GST-03]', () => {
    const rows = INDIAN_FY_MONTHS.map((m) => makeGstr3bRow(m, 100))
    const result = aggregateMonthlyForGstr9(rows)
    expect(result.table9.igst).toBeCloseTo(1200)
  })

  it('FY spans Apr of start year to Mar of end year (Indian FY) [GST-03]', () => {
    const rows = INDIAN_FY_MONTHS.map((m) => makeGstr3bRow(m, 50))
    expect(() => aggregateMonthlyForGstr9(rows)).not.toThrow()
    const result = aggregateMonthlyForGstr9(rows)
    expect(result.table9.igst).toBeCloseTo(600)
  })

  it('sums output tax across all 12 months from GSTR-1 rows [GST-03]', () => {
    const rows = INDIAN_FY_MONTHS.map((m) => makeGstr1Row(m, 10000, 1800))
    const result = aggregateMonthlyForGstr9(rows)
    expect(result.table4.txval).toBeCloseTo(120000)
    expect(result.table4.igst).toBeCloseTo(21600)
  })

  it('sums ITC across all 12 months from GSTR-3B rows [GST-03]', () => {
    const rows = INDIAN_FY_MONTHS.map((m) => makeGstr3bRow(m, 200))
    const result = aggregateMonthlyForGstr9(rows)
    expect(result.table9.igst).toBeCloseTo(2400)
  })

  it('partial year (3 months) aggregates without error [GST-03]', () => {
    const rows = [makeGstr1Row('04', 10000, 1800), makeGstr1Row('05', 10000, 1800), makeGstr1Row('06', 10000, 1800)]
    const result = aggregateMonthlyForGstr9(rows)
    expect(result.table4.txval).toBeCloseTo(30000)
    expect(result.table4.igst).toBeCloseTo(5400)
  })

  it('row with null data contributes zero [GST-03]', () => {
    const rows: GstPeriodDataRow[] = [
      { period_type: 'GSTR-1', period: '04', data: null },
      makeGstr1Row('05', 10000, 1800),
    ]
    const result = aggregateMonthlyForGstr9(rows)
    expect(result.table4.txval).toBeCloseTo(10000)
  })

  it('missing months do not throw — contributes zero [GST-03]', () => {
    const rows = [makeGstr3bRow('04', 300)]
    expect(() => aggregateMonthlyForGstr9(rows)).not.toThrow()
    const result = aggregateMonthlyForGstr9(rows)
    expect(result.table9.igst).toBeCloseTo(300)
  })
})
