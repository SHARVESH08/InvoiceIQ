import { roundToRupee } from '@/lib/tax/gst'

export interface B2bItemDet {
  rt: number
  txval: number
  iamt: number
  camt: number
  samt: number
  csamt: number
}

export interface B2bItem {
  num: number
  itm_det: B2bItemDet
}

export interface B2bInv {
  inum: string
  idt: string
  val: number
  pos: string
  rchrg: string
  inv_typ: string
  itms: B2bItem[]
}

export interface B2bEntry {
  ctin: string
  inv: B2bInv[]
}

export interface B2csEntry {
  sply_ty: 'INTRA' | 'INTER'
  pos: string
  typ: string
  rt: number
  txval: number
  iamt: number
  camt: number
  samt: number
  csamt: number
}

export type B2clEntry = B2bEntry

export interface CdnrEntry {}

export interface HsnEntry {
  hsn_sc: string
  rt: number
  txval: number
  iamt: number
  camt: number
  samt: number
  csamt: number
}

export interface Gstr1Sections {
  b2b: B2bEntry[]
  b2cs: B2csEntry[]
  b2cl: B2clEntry[]
  cdnr: CdnrEntry[]
  hsn: HsnEntry[]
}

export interface InvoiceRow {
  id: string
  invoice_number: string
  invoice_date: string
  invoice_type: 'B2B' | 'B2CS' | 'B2CL'
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  state_code: string
  customer_gstin: string | null
}

export interface InvoiceItemRow {
  invoice_id: string
  hsn_code: string
  tax_rate: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
}

function toGstnDate(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
  return dateStr
}

function buildItms(invItems: InvoiceItemRow[], fallback: InvoiceRow): B2bItem[] {
  if (invItems.length > 0) {
    return invItems.map((item, idx) => ({
      num: idx + 1,
      itm_det: {
        rt: item.tax_rate,
        txval: item.taxable_amount,
        iamt: item.igst_amount,
        camt: item.cgst_amount,
        samt: item.sgst_amount,
        csamt: 0,
      },
    }))
  }
  return [{
    num: 1,
    itm_det: {
      rt: 0,
      txval: fallback.taxable_amount,
      iamt: fallback.igst_amount,
      camt: fallback.cgst_amount,
      samt: fallback.sgst_amount,
      csamt: 0,
    },
  }]
}

export function groupInvoicesIntoGstr1(
  invoices: InvoiceRow[],
  items: InvoiceItemRow[]
): Gstr1Sections {
  const itemsByInvoice = new Map<string, InvoiceItemRow[]>()
  for (const item of items) {
    const arr = itemsByInvoice.get(item.invoice_id) ?? []
    arr.push(item)
    itemsByInvoice.set(item.invoice_id, arr)
  }

  const b2b: B2bEntry[] = []
  const b2clMap = new Map<string, B2clEntry>()
  const b2csMap = new Map<string, {
    state_code: string; rt: number
    txvalPaise: number; igstPaise: number; cgstPaise: number; sgstPaise: number
  }>()
  const hsnMap = new Map<string, {
    hsn_sc: string; rt: number
    txvalPaise: number; igstPaise: number; cgstPaise: number; sgstPaise: number
  }>()

  for (const inv of invoices) {
    const invItems = itemsByInvoice.get(inv.id) ?? []
    const effectiveRate = invItems.length > 0 ? invItems[0].tax_rate : 0
    const itms = buildItms(invItems, inv)

    if (inv.invoice_type === 'B2B') {
      b2b.push({
        ctin: inv.customer_gstin ?? '',
        inv: [{
          inum: inv.invoice_number,
          idt: toGstnDate(inv.invoice_date),
          val: inv.taxable_amount + inv.cgst_amount + inv.sgst_amount + inv.igst_amount,
          pos: inv.state_code,
          rchrg: 'N',
          inv_typ: 'R',
          itms,
        }],
      })
    } else if (inv.invoice_type === 'B2CL' && inv.taxable_amount > 250000) {
      const ctin = inv.customer_gstin ?? ''
      const existing = b2clMap.get(ctin)
      const invEntry: B2bInv = {
        inum: inv.invoice_number,
        idt: toGstnDate(inv.invoice_date),
        val: inv.taxable_amount + inv.igst_amount,
        pos: inv.state_code,
        rchrg: 'N',
        inv_typ: 'R',
        itms,
      }
      if (existing) {
        existing.inv.push(invEntry)
      } else {
        b2clMap.set(ctin, { ctin, inv: [invEntry] })
      }
    } else if (inv.invoice_type === 'B2CS') {
      const key = `${inv.state_code}_${effectiveRate}`
      const agg = b2csMap.get(key)
      if (agg) {
        agg.txvalPaise += Math.round(inv.taxable_amount * 100)
        agg.igstPaise += Math.round(inv.igst_amount * 100)
        agg.cgstPaise += Math.round(inv.cgst_amount * 100)
        agg.sgstPaise += Math.round(inv.sgst_amount * 100)
      } else {
        b2csMap.set(key, {
          state_code: inv.state_code,
          rt: effectiveRate,
          txvalPaise: Math.round(inv.taxable_amount * 100),
          igstPaise: Math.round(inv.igst_amount * 100),
          cgstPaise: Math.round(inv.cgst_amount * 100),
          sgstPaise: Math.round(inv.sgst_amount * 100),
        })
      }
    }

    for (const item of invItems) {
      const key = `${item.hsn_code}_${item.tax_rate}`
      const agg = hsnMap.get(key)
      if (agg) {
        agg.txvalPaise += Math.round(item.taxable_amount * 100)
        agg.igstPaise += Math.round(item.igst_amount * 100)
        agg.cgstPaise += Math.round(item.cgst_amount * 100)
        agg.sgstPaise += Math.round(item.sgst_amount * 100)
      } else {
        hsnMap.set(key, {
          hsn_sc: item.hsn_code,
          rt: item.tax_rate,
          txvalPaise: Math.round(item.taxable_amount * 100),
          igstPaise: Math.round(item.igst_amount * 100),
          cgstPaise: Math.round(item.cgst_amount * 100),
          sgstPaise: Math.round(item.sgst_amount * 100),
        })
      }
    }
  }

  return {
    b2b,
    b2cs: Array.from(b2csMap.values()).map((agg) => ({
      sply_ty: agg.igstPaise > 0 ? 'INTER' : 'INTRA',
      pos: agg.state_code,
      typ: 'OE',
      rt: agg.rt,
      txval: roundToRupee(agg.txvalPaise),
      iamt: roundToRupee(agg.igstPaise),
      camt: roundToRupee(agg.cgstPaise),
      samt: roundToRupee(agg.sgstPaise),
      csamt: 0,
    })),
    b2cl: Array.from(b2clMap.values()),
    cdnr: [],
    hsn: Array.from(hsnMap.values()).map((agg) => ({
      hsn_sc: agg.hsn_sc,
      rt: agg.rt,
      txval: roundToRupee(agg.txvalPaise),
      iamt: roundToRupee(agg.igstPaise),
      camt: roundToRupee(agg.cgstPaise),
      samt: roundToRupee(agg.sgstPaise),
      csamt: 0,
    })),
  }
}
