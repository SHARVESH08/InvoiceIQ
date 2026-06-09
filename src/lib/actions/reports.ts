'use server'

import { createClient } from '@/lib/supabase/server'
import type { TallyRowInput } from '@/lib/tally-import'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PnlResult = {
  revenue: number
  cogs: number
  gross_margin: number
  margin_percent: number
}

export type HsnRow = {
  hsn_code: string
  taxable_value: number
  cgst: number
  sgst: number
  igst: number
  total_tax: number
}

export type ExportInvoiceRow = {
  invoice_number: string
  invoice_date: string
  customer_name: string
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  payment_status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AuthContext =
  | { error: string }
  | { supabase: Awaited<ReturnType<typeof createClient>>; companyId: string }

async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated' }
  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) return { error: 'Company membership not found' }
  return { supabase, companyId: companyId as string }
}

/**
 * Parse Tally date formats:
 * - 'DD-MMM-YY'  e.g. '01-Apr-25' → '2025-04-01'
 * - 'DD/MM/YYYY' e.g. '01/04/2025' → '2025-04-01'
 */
function parseTallyDate(raw: string): string {
  // Try DD-MMM-YY
  const dmyShort = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(raw.trim())
  if (dmyShort) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    }
    const day = dmyShort[1].padStart(2, '0')
    const mon = months[dmyShort[2].toLowerCase()] ?? '01'
    const yr = parseInt(dmyShort[3], 10)
    const year = yr >= 50 ? 1900 + yr : 2000 + yr
    return `${year}-${mon}-${day}`
  }
  // Try DD/MM/YYYY
  const dmyFull = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim())
  if (dmyFull) {
    const day = dmyFull[1].padStart(2, '0')
    const mon = dmyFull[2].padStart(2, '0')
    return `${dmyFull[3]}-${mon}-${day}`
  }
  // Return as-is (may already be ISO)
  return raw.trim()
}

// ─── Server Actions ───────────────────────────────────────────────────────────

export async function getPnlSummary(
  from: string,
  to: string
): Promise<{ error: string } | PnlResult> {
  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { supabase, companyId } = auth

  const { data, error } = await supabase.rpc('get_pnl_summary', {
    p_company_id: companyId,
    p_from: from,
    p_to: to,
  })
  if (error) return { error: error.message }
  if (!data) return { error: 'No data returned from RPC' }

  const revenue = Number((data as any).revenue ?? 0)
  const cogs = Number((data as any).cogs ?? 0)
  const gross_margin = Number((data as any).gross_margin ?? 0)
  const margin_percent =
    revenue > 0 ? Math.round((gross_margin / revenue) * 100 * 100) / 100 : 0

  return { revenue, cogs, gross_margin, margin_percent }
}

export async function getHsnSummary(
  from: string,
  to: string
): Promise<{ error: string } | { rows: HsnRow[] }> {
  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { supabase, companyId } = auth

  const { data, error } = await supabase
    .from('invoice_items')
    .select(
      'hsn_code, quantity, taxable_amount, cgst_amount, sgst_amount, igst_amount, invoices!inner(invoice_date, doc_type, status, company_id)'
    )
    .eq('invoices.company_id', companyId)
    .eq('invoices.doc_type', 'sale')
    .neq('invoices.status', 'cancelled')
    .gte('invoices.invoice_date', from)
    .lte('invoices.invoice_date', to)
    .not('hsn_code', 'is', null)

  if (error) return { error: error.message }

  const map = new Map<string, HsnRow>()
  for (const item of (data ?? []) as any[]) {
    const code: string = item.hsn_code ?? ''
    const taxable = Number(item.taxable_amount ?? 0)
    const cgst = Number(item.cgst_amount ?? 0)
    const sgst = Number(item.sgst_amount ?? 0)
    const igst = Number(item.igst_amount ?? 0)

    const existing = map.get(code)
    if (existing) {
      existing.taxable_value += taxable
      existing.cgst += cgst
      existing.sgst += sgst
      existing.igst += igst
      existing.total_tax = existing.cgst + existing.sgst + existing.igst
    } else {
      map.set(code, {
        hsn_code: code,
        taxable_value: taxable,
        cgst,
        sgst,
        igst,
        total_tax: cgst + sgst + igst,
      })
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => b.taxable_value - a.taxable_value)
  return { rows }
}

export async function listInvoicesForExport(
  from: string,
  to: string
): Promise<{ error: string } | { invoices: ExportInvoiceRow[] }> {
  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { supabase, companyId } = auth

  const { data, error } = await supabase
    .from('invoices')
    .select(
      'invoice_number, invoice_date, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount, payment_status, customers(name)'
    )
    .eq('company_id', companyId)
    .neq('status', 'cancelled')
    .gte('invoice_date', from)
    .lte('invoice_date', to)
    .order('invoice_date', { ascending: false })

  if (error) return { error: error.message }

  const invoices: ExportInvoiceRow[] = (data ?? []).map((row: any) => {
    const cust = Array.isArray(row.customers) ? row.customers[0] : row.customers
    return {
      invoice_number: row.invoice_number ?? '',
      invoice_date: row.invoice_date ?? '',
      customer_name: cust?.name ?? 'Unknown',
      taxable_amount: Number(row.taxable_amount ?? 0),
      cgst_amount: Number(row.cgst_amount ?? 0),
      sgst_amount: Number(row.sgst_amount ?? 0),
      igst_amount: Number(row.igst_amount ?? 0),
      total_amount: Number(row.total_amount ?? 0),
      payment_status: row.payment_status ?? 'unpaid',
    }
  })

  return { invoices }
}

export async function importTallyInvoices(
  rows: TallyRowInput[]
): Promise<{ error: string } | { imported: number; skipped: number }> {
  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { supabase, companyId } = auth

  // Deduplicate within the input array by invoice_number to avoid sending
  // conflicting rows in the same batch (ON CONFLICT DO NOTHING handles DB-level dups)
  const seen = new Set<string>()
  const deduped: typeof rows = []
  for (const row of rows) {
    const key = `TALLY-${row.tally_voucher_no ?? Date.now()}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(row)
    }
  }

  const inserts = deduped.map((row) => ({
    company_id: companyId,
    doc_type: 'sale',
    status: 'sent',
    invoice_date: parseTallyDate(row.invoice_date),
    taxable_amount: row.taxable_amount ?? 0,
    cgst_amount: row.cgst_amount ?? 0,
    sgst_amount: row.sgst_amount ?? 0,
    igst_amount: row.igst_amount ?? 0,
    total_amount: row.total_amount,
    payment_status: 'unpaid',
    invoice_type: row.customer_gstin ? 'B2B' : 'B2CS',
    notes: `Tally import: ${row.tally_voucher_no ?? ''}`,
    customer_id: null,
    invoice_number: `TALLY-${row.tally_voucher_no ?? Date.now()}`,
  }))

  const { data: upsertData, error: upsertError } = await supabase
    .from('invoices')
    .upsert(inserts, { onConflict: 'invoice_number', ignoreDuplicates: true })
    .select('id')

  if (upsertError) return { error: upsertError.message }

  const inserted = upsertData?.length ?? 0
  const skipped = rows.length - inserted

  return { imported: inserted, skipped }
}
