import type { Gstr1Sections } from '@/lib/gst/gstr1'

export interface Gstr3bData {
  outward: { txval: number; igst: number; cgst: number; sgst: number }
  itc: { igst: number; cgst: number; sgst: number }
  net: { igst: number; cgst: number; sgst: number }
}

function sumOutputTaxFromGstr1(sections: Gstr1Sections) {
  let txval = 0, igst = 0, cgst = 0, sgst = 0

  for (const entry of sections.b2b) {
    for (const inv of entry.inv) {
      for (const itm of inv.itms) {
        txval += itm.itm_det.txval
        igst += itm.itm_det.iamt
        cgst += itm.itm_det.camt
        sgst += itm.itm_det.samt
      }
    }
  }
  for (const entry of sections.b2cl) {
    for (const inv of entry.inv) {
      for (const itm of inv.itms) {
        txval += itm.itm_det.txval
        igst += itm.itm_det.iamt
        cgst += itm.itm_det.camt
        sgst += itm.itm_det.samt
      }
    }
  }
  for (const entry of sections.b2cs) {
    txval += entry.txval
    igst += entry.iamt
    cgst += entry.camt
    sgst += entry.samt
  }

  return { txval, igst, cgst, sgst }
}

export function computeGstr3b(
  gstr1Data: Gstr1Sections,
  manualItc: { igst: number; cgst: number; sgst: number }
): Gstr3bData {
  const outward = sumOutputTaxFromGstr1(gstr1Data)
  return {
    outward,
    itc: { ...manualItc },
    net: {
      igst: Math.max(0, outward.igst - manualItc.igst),
      cgst: Math.max(0, outward.cgst - manualItc.cgst),
      sgst: Math.max(0, outward.sgst - manualItc.sgst),
    },
  }
}
