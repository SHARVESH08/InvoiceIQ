import type { Gstr2bRow } from '@/lib/gst/gstr2b-parser'

export interface PurchaseOrderRow {
  supplier_gstin: string
  po_number: string
  total_amount: number
}

export interface ReconcileResult {
  matched: Gstr2bRow[]
  in2BOnly: Gstr2bRow[]
  inSystemOnly: PurchaseOrderRow[]
}

function normalizeInvoiceNumber(s: string): string {
  return s.trim().toUpperCase().replace(/[\s\-\/]/g, '')
}

function makeKey(gstin: string, invoiceNum: string, amount: number): string {
  return `${gstin.trim().toUpperCase()}|${normalizeInvoiceNumber(invoiceNum)}|${amount.toFixed(2)}`
}

export function reconcile2b(
  parsed: Gstr2bRow[],
  poRows: PurchaseOrderRow[]
): ReconcileResult {
  const poKeyMap = new Map<string, PurchaseOrderRow>()
  for (const po of poRows) {
    poKeyMap.set(makeKey(po.supplier_gstin, po.po_number, po.total_amount), po)
  }

  const matched: Gstr2bRow[] = []
  const in2BOnly: Gstr2bRow[] = []
  const matchedPoKeys = new Set<string>()

  for (const row of parsed) {
    const key = makeKey(row.gstin, row.invoiceNum, row.invoiceValue)
    if (poKeyMap.has(key)) {
      matched.push(row)
      matchedPoKeys.add(key)
    } else {
      in2BOnly.push(row)
    }
  }

  const inSystemOnly: PurchaseOrderRow[] = []
  for (const [key, po] of poKeyMap) {
    if (!matchedPoKeys.has(key)) inSystemOnly.push(po)
  }

  return { matched, in2BOnly, inSystemOnly }
}
