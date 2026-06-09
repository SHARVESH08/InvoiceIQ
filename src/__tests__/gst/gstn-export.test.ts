import { describe, it, expect } from 'vitest'
import { buildGstnJson, buildGstnExcel } from '@/lib/gst/gstn-export'
import type { GstnMeta } from '@/lib/gst/gstn-export'
import type { Gstr1Sections } from '@/lib/gst/gstr1'

const emptySections: Gstr1Sections = { b2b: [], b2cs: [], b2cl: [], cdnr: [], hsn: [] }

const b2bSections: Gstr1Sections = {
  b2b: [{
    ctin: '33AABCU9603R1ZX',
    inv: [{
      inum: 'INV-001', idt: '01-06-2025', val: 11800,
      pos: '33', rchrg: 'N', inv_typ: 'R',
      itms: [{ num: 1, itm_det: { rt: 18, txval: 10000, iamt: 1800, camt: 0, samt: 0, csamt: 0 } }],
    }],
  }],
  b2cs: [],
  b2cl: [],
  cdnr: [],
  hsn: [{ hsn_sc: '9983', rt: 18, txval: 10000, iamt: 1800, camt: 0, samt: 0, csamt: 0 }],
}

const meta2526Apr: GstnMeta = { gstin: '33AABCU9603R1ZX', fy: '2025-26', period: '04' }
const meta2526Mar: GstnMeta = { gstin: '33AABCU9603R1ZX', fy: '2025-26', period: '03' }

describe('buildGstnJson [GST-05]', () => {
  it('output contains gstin, fp, b2b, b2cs, b2cl, and hsn keys [GST-05]', () => {
    const result = buildGstnJson(emptySections, meta2526Apr)
    expect(result).toHaveProperty('gstin')
    expect(result).toHaveProperty('fp')
    expect(result).toHaveProperty('b2b')
    expect(result).toHaveProperty('b2cs')
    expect(result).toHaveProperty('b2cl')
    expect(result).toHaveProperty('hsn')
  })

  it('fp field matches the period in MMYYYY format [GST-05]', () => {
    expect(buildGstnJson(emptySections, meta2526Apr).fp).toBe('042025')
    expect(buildGstnJson(emptySections, meta2526Mar).fp).toBe('032026')
  })

  it('gstin field matches the company GSTIN [GST-05]', () => {
    const result = buildGstnJson(emptySections, meta2526Apr)
    expect(result.gstin).toBe('33AABCU9603R1ZX')
  })

  it('b2b array contains invoice-level breakdowns for registered buyers [GST-05]', () => {
    const result = buildGstnJson(b2bSections, meta2526Apr)
    expect(result.b2b).toHaveLength(1)
    expect(result.b2b[0].ctin).toBe('33AABCU9603R1ZX')
    expect(result.b2b[0].inv[0].itms[0].itm_det.txval).toBe(10000)
  })

  it('fp for April (month >= 4) uses start year [GST-05]', () => {
    expect(buildGstnJson(emptySections, { gstin: 'X', fy: '2024-25', period: '04' }).fp).toBe('042024')
    expect(buildGstnJson(emptySections, { gstin: 'X', fy: '2024-25', period: '09' }).fp).toBe('092024')
  })

  it('fp for March (month < 4) uses end year [GST-05]', () => {
    expect(buildGstnJson(emptySections, { gstin: 'X', fy: '2024-25', period: '03' }).fp).toBe('032025')
    expect(buildGstnJson(emptySections, { gstin: 'X', fy: '2024-25', period: '01' }).fp).toBe('012025')
  })

  it('hsn wraps entries in { data: [...] } [GST-05]', () => {
    const result = buildGstnJson(b2bSections, meta2526Apr)
    expect(result.hsn).toHaveProperty('data')
    expect(Array.isArray(result.hsn.data)).toBe(true)
  })
})

describe('buildGstnExcel [GST-05]', () => {
  it('returns a Buffer [GST-05]', () => {
    const buf = buildGstnExcel(emptySections, meta2526Apr)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
  })
})
