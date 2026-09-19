import type { B2bItemDet, B2csEntry } from '@/lib/gst/gstr1'

// ─────────────────────────────────────────────────────────────────────────────
// These rows come straight out of the gst_periods.data jsonb column, which may
// hold a partially-filled return saved mid-edit. Every level is therefore
// optional — that is what the `?? 0` reads below are guarding against, and the
// types say so rather than hiding it behind `any`.
// ─────────────────────────────────────────────────────────────────────────────

type PartialB2bEntry = {
  ctin?: string
  inv?: Array<{
    inum?: string
    idt?: string
    val?: number
    pos?: string
    rchrg?: string
    inv_typ?: string
    itms?: Array<{ num?: number; itm_det?: Partial<B2bItemDet> }>
  }>
}

type PartialB2csEntry = Partial<Pick<B2csEntry, 'txval' | 'iamt' | 'camt' | 'samt'>>

export interface Gstr1Payload {
  b2b?: PartialB2bEntry[]
  b2cl?: PartialB2bEntry[]
  b2cs?: PartialB2csEntry[]
  /** Present in stored returns but not part of the Table 4 sum. */
  cdnr?: unknown[]
  hsn?: unknown[]
}

export interface Gstr3bPayload {
  itc?: { igst?: number; cgst?: number; sgst?: number }
}

export type GstPeriodPayload = Gstr1Payload & Gstr3bPayload

export interface GstPeriodDataRow {
  period_type: 'GSTR-1' | 'GSTR-3B'
  period: string
  data: GstPeriodPayload | null
}

export interface Gstr9Data {
  table4: { txval: number; igst: number; cgst: number; sgst: number }
  table9: { igst: number; cgst: number; sgst: number }
}

function sumGstr1Sections(sections: Gstr1Payload) {
  let txval = 0, igst = 0, cgst = 0, sgst = 0
  for (const entry of (sections.b2b ?? [])) {
    for (const inv of (entry.inv ?? [])) {
      for (const itm of (inv.itms ?? [])) {
        const d = itm.itm_det ?? {}
        txval += d.txval ?? 0
        igst += d.iamt ?? 0
        cgst += d.camt ?? 0
        sgst += d.samt ?? 0
      }
    }
  }
  for (const entry of (sections.b2cl ?? [])) {
    for (const inv of (entry.inv ?? [])) {
      for (const itm of (inv.itms ?? [])) {
        const d = itm.itm_det ?? {}
        txval += d.txval ?? 0
        igst += d.iamt ?? 0
        cgst += d.camt ?? 0
        sgst += d.samt ?? 0
      }
    }
  }
  for (const entry of (sections.b2cs ?? [])) {
    txval += entry.txval ?? 0
    igst += entry.iamt ?? 0
    cgst += entry.camt ?? 0
    sgst += entry.samt ?? 0
  }
  return { txval, igst, cgst, sgst }
}

export function aggregateMonthlyForGstr9(rows: GstPeriodDataRow[]): Gstr9Data {
  let txval = 0, igst4 = 0, cgst4 = 0, sgst4 = 0
  let igst9 = 0, cgst9 = 0, sgst9 = 0

  for (const row of rows) {
    const d = row.data ?? {}
    if (row.period_type === 'GSTR-1') {
      const out = sumGstr1Sections(d)
      txval += out.txval
      igst4 += out.igst
      cgst4 += out.cgst
      sgst4 += out.sgst
    } else if (row.period_type === 'GSTR-3B') {
      const itc = d.itc ?? {}
      igst9 += itc.igst ?? 0
      cgst9 += itc.cgst ?? 0
      sgst9 += itc.sgst ?? 0
    }
  }

  return {
    table4: { txval, igst: igst4, cgst: cgst4, sgst: sgst4 },
    table9: { igst: igst9, cgst: cgst9, sgst: sgst9 },
  }
}
