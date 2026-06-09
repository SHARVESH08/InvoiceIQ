export interface GstPeriodDataRow {
  period_type: 'GSTR-1' | 'GSTR-3B'
  period: string
  data: any
}

export interface Gstr9Data {
  table4: { txval: number; igst: number; cgst: number; sgst: number }
  table9: { igst: number; cgst: number; sgst: number }
}

function sumGstr1Sections(sections: any) {
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
