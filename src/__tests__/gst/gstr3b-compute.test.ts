import { describe, it, expect } from 'vitest'
import { computeGstr3b } from '@/lib/gst/gstr3b'
import type { Gstr1Sections } from '@/lib/gst/gstr1'

function makeB2bSections(igst: number, cgst: number, sgst: number, txval = 10000): Gstr1Sections {
  return {
    b2b: [{
      ctin: '33AABCU9603R1ZX',
      inv: [{
        inum: 'INV-001', idt: '01-06-2025', val: txval + igst + cgst + sgst,
        pos: '33', rchrg: 'N', inv_typ: 'R',
        itms: [{ num: 1, itm_det: { rt: 18, txval, iamt: igst, camt: cgst, samt: sgst, csamt: 0 } }],
      }],
    }],
    b2cs: [],
    b2cl: [],
    cdnr: [],
    hsn: [],
  }
}

const zeroItc = { igst: 0, cgst: 0, sgst: 0 }

describe('computeGstr3b [GST-02]', () => {
  it('net payable = Math.max(0, outputTax - itc) when ITC < output [GST-02]', () => {
    const sections = makeB2bSections(1800, 0, 0)
    const result = computeGstr3b(sections, { igst: 500, cgst: 0, sgst: 0 })
    expect(result.net.igst).toBeCloseTo(1300)
    expect(result.net.cgst).toBe(0)
    expect(result.net.sgst).toBe(0)
  })

  it('net payable = 0 when ITC >= output tax [GST-02]', () => {
    const sections = makeB2bSections(900, 900, 0)
    const result = computeGstr3b(sections, { igst: 2000, cgst: 2000, sgst: 0 })
    expect(result.net.igst).toBe(0)
    expect(result.net.cgst).toBe(0)
  })

  it('splits output tax into CGST + SGST for intra-state and IGST for inter-state [GST-02]', () => {
    const intra = makeB2bSections(0, 900, 900)
    const intraResult = computeGstr3b(intra, zeroItc)
    expect(intraResult.outward.igst).toBe(0)
    expect(intraResult.outward.cgst).toBe(900)
    expect(intraResult.outward.sgst).toBe(900)

    const inter = makeB2bSections(1800, 0, 0)
    const interResult = computeGstr3b(inter, zeroItc)
    expect(interResult.outward.igst).toBe(1800)
    expect(interResult.outward.cgst).toBe(0)
    expect(interResult.outward.sgst).toBe(0)
  })

  it('returns zero net payable when both output and ITC are zero [GST-02]', () => {
    const empty: Gstr1Sections = { b2b: [], b2cs: [], b2cl: [], cdnr: [], hsn: [] }
    const result = computeGstr3b(empty, zeroItc)
    expect(result.net).toEqual({ igst: 0, cgst: 0, sgst: 0 })
    expect(result.outward).toEqual({ txval: 0, igst: 0, cgst: 0, sgst: 0 })
  })

  it('itc in result equals the manualItc argument (D-01 manual entry preserved) [GST-02]', () => {
    const sections = makeB2bSections(1800, 0, 0)
    const manualItc = { igst: 300, cgst: 100, sgst: 50 }
    const result = computeGstr3b(sections, manualItc)
    expect(result.itc).toEqual(manualItc)
  })

  it('over-large ITC clamps net to 0, not negative [GST-02]', () => {
    const sections = makeB2bSections(500, 0, 0)
    const result = computeGstr3b(sections, { igst: 9999, cgst: 0, sgst: 0 })
    expect(result.net.igst).toBe(0)
  })

  it('sums tax across b2b + b2cs + b2cl sections (no double-counting from hsn) [GST-02]', () => {
    const sections: Gstr1Sections = {
      b2b: [{
        ctin: '33AABCU9603R1ZX',
        inv: [{ inum: 'INV-001', idt: '01-06-2025', val: 11800, pos: '33', rchrg: 'N', inv_typ: 'R',
          itms: [{ num: 1, itm_det: { rt: 18, txval: 10000, iamt: 1800, camt: 0, samt: 0, csamt: 0 } }] }],
      }],
      b2cs: [{ sply_ty: 'INTRA', pos: '33', typ: 'OE', rt: 12, txval: 5000, iamt: 0, camt: 300, samt: 300, csamt: 0 }],
      b2cl: [],
      cdnr: [],
      hsn: [{ hsn_sc: '9983', rt: 18, txval: 10000, iamt: 1800, camt: 0, samt: 0, csamt: 0 }],
    }
    const result = computeGstr3b(sections, zeroItc)
    // b2b igst=1800 + b2cs igst=0 = 1800 (hsn not counted)
    expect(result.outward.igst).toBe(1800)
    // b2cs cgst=300
    expect(result.outward.cgst).toBe(300)
    // b2cs sgst=300
    expect(result.outward.sgst).toBe(300)
  })
})
