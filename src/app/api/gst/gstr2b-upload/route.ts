export const runtime = 'nodejs'

import { createClient } from '@/lib/supabase/server'
import { parseGstr2bExcel } from '@/lib/gst/gstr2b-parser'
import { reconcile2b } from '@/lib/gst/gstr2b-reconcile'
import type { PurchaseOrderRow } from '@/lib/gst/gstr2b-reconcile'

/** purchase_orders joined to suppliers; PostgREST may embed one or many. */
type PoWithSupplier = {
  po_number: string | null
  total_amount: number | string | null
  suppliers: { gstin: string | null } | { gstin: string | null }[] | null
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid multipart request' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > 10_000_000) {
    return Response.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return Response.json({ error: 'Only .xlsx files are accepted' }, { status: 415 })
  }

  let parsed
  try {
    const buffer = await file.arrayBuffer()
    parsed = parseGstr2bExcel(buffer)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : undefined
    return Response.json({ error: message ?? 'Could not parse GSTR-2B Excel' }, { status: 422 })
  }

  // Join purchase_orders to suppliers to get supplier_gstin (D-06)
  const { data: poRows, error: poError } = await supabase
    .from('purchase_orders')
    .select('po_number, total_amount, suppliers(gstin)')
    .eq('company_id', companyId)
    .neq('status', 'cancelled')

  if (poError) {
    return Response.json({ error: poError.message }, { status: 500 })
  }

  const flatPoRows: PurchaseOrderRow[] = ((poRows ?? []) as PoWithSupplier[]).map((row) => {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers
    return {
      supplier_gstin: supplier?.gstin ?? '',
      // po_number is nullable in the schema (drafts have none); the reconciler
      // matches on it as a string.
      po_number: row.po_number ?? '',
      total_amount: Number(row.total_amount),
    }
  })

  const { matched, in2BOnly, inSystemOnly } = reconcile2b(parsed, flatPoRows)

  return Response.json({
    data: {
      matched: matched.length,
      in2bNotSystem: in2BOnly.length,
      inSystemNot2b: inSystemOnly.length,
      matchedRows: matched,
      in2BOnly,
      inSystemOnly,
    },
  })
}
