import * as XLSX from 'xlsx'
import type { Gstr1Sections } from '@/lib/gst/gstr1'

export interface GstnMeta {
  gstin: string
  fy: string
  period: string
}

export interface GstnGstr1Json {
  gstin: string
  fp: string
  b2b: any[]
  b2cs: any[]
  b2cl: any[]
  hsn: { data: any[] }
}

function toFilingPeriod(fy: string, period: string): string {
  const month = parseInt(period, 10)
  const startYear = parseInt(fy.split('-')[0], 10)
  const year = month >= 4 ? startYear : startYear + 1
  return `${period}${year}`
}

export function buildGstnJson(sections: Gstr1Sections, meta: GstnMeta): GstnGstr1Json {
  return {
    gstin: meta.gstin,
    fp: toFilingPeriod(meta.fy, meta.period),
    b2b: sections.b2b.map((entry) => ({
      ctin: entry.ctin,
      inv: entry.inv.map((inv) => ({
        inum: inv.inum,
        idt: inv.idt,
        val: inv.val,
        pos: inv.pos,
        rchrg: inv.rchrg ?? 'N',
        inv_typ: inv.inv_typ ?? 'R',
        itms: inv.itms.map((itm) => ({
          num: itm.num,
          itm_det: {
            rt: itm.itm_det.rt,
            txval: itm.itm_det.txval,
            iamt: itm.itm_det.iamt,
            camt: itm.itm_det.camt,
            samt: itm.itm_det.samt,
            csamt: itm.itm_det.csamt ?? 0,
          },
        })),
      })),
    })),
    b2cs: sections.b2cs,
    b2cl: sections.b2cl,
    hsn: { data: sections.hsn },
  }
}

export function buildGstnExcel(sections: Gstr1Sections, meta: GstnMeta): Buffer {
  const wb = XLSX.utils.book_new()

  const b2bRows = sections.b2b.flatMap((entry) =>
    entry.inv.flatMap((inv) =>
      inv.itms.map((itm) => [
        entry.ctin, inv.inum, inv.idt, inv.val, inv.pos,
        itm.itm_det.rt, itm.itm_det.txval, itm.itm_det.iamt,
        itm.itm_det.camt, itm.itm_det.samt, itm.itm_det.csamt,
      ])
    )
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['GSTIN', 'Invoice No', 'Invoice Date', 'Invoice Value', 'Place of Supply',
       'Rate', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'],
      ...b2bRows,
    ]),
    'B2B'
  )

  const b2csRows = sections.b2cs.map((e) => [
    e.sply_ty, e.pos, e.typ, e.rt, e.txval, e.iamt, e.camt, e.samt, e.csamt,
  ])
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Supply Type', 'Place of Supply', 'Type', 'Rate', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'],
      ...b2csRows,
    ]),
    'B2CS'
  )

  const hsnRows = sections.hsn.map((e) => [
    e.hsn_sc, e.rt, e.txval, e.iamt, e.camt, e.samt, e.csamt,
  ])
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['HSN Code', 'Rate', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'],
      ...hsnRows,
    ]),
    'HSN'
  )

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
