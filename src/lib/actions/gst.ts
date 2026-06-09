'use server'

import { createClient } from '@/lib/supabase/server'
import { groupInvoicesIntoGstr1 } from '@/lib/gst/gstr1'
import type { InvoiceRow, InvoiceItemRow } from '@/lib/gst/gstr1'
import { computeGstr3b } from '@/lib/gst/gstr3b'
import { aggregateMonthlyForGstr9 } from '@/lib/gst/gstr9'

type ActionResult<T = unknown> = { error: string } | { success: true; data?: T }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function periodToDateRange(fy: string, period: string): { from: string; to: string } {
  const startYear = parseInt(fy.split('-')[0], 10)
  const month = parseInt(period, 10)
  const year = month >= 4 ? startYear : startYear + 1
  const from = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const to = new Date(year, month, 0).toISOString().split('T')[0]
  return { from, to }
}

async function getAuthContext() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated' as const }
  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) return { error: 'Company membership not found' as const }
  return { supabase, companyId: companyId as string }
}

async function checkFiledStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  periodType: string,
  fy: string,
  period: string
): Promise<string | null> {
  const { data } = await supabase
    .from('gst_period_data')
    .select('status')
    .eq('company_id', companyId)
    .eq('period_type', periodType)
    .eq('fy', fy)
    .eq('period', period)
    .maybeSingle()
  return (data as { status: string } | null)?.status ?? null
}

// ─── Server Actions ───────────────────────────────────────────────────────────

export async function computeGstr1(fy: string, period: string): Promise<ActionResult> {
  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { supabase, companyId } = auth

  const status = await checkFiledStatus(supabase, companyId, 'GSTR-1', fy, period)
  if (status === 'filed') return { error: 'Period is filed and cannot be modified.' }

  const { from, to } = periodToDateRange(fy, period)

  const { data: rawRows, error: fetchError } = await supabase
    .from('invoices')
    .select('*, customers(gstin, state_code), invoice_items(*)')
    .eq('company_id', companyId)
    .gte('invoice_date', from)
    .lte('invoice_date', to)

  if (fetchError) return { error: fetchError.message }

  const rows = (rawRows ?? []) as any[]

  // Flatten customer gstin onto each row for groupInvoicesIntoGstr1 (Pitfall 5)
  const invoices: InvoiceRow[] = rows.map((inv) => {
    const cust = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers
    const gstin = cust?.gstin ?? null
    const total =
      Number(inv.taxable_amount) +
      Number(inv.cgst_amount) +
      Number(inv.sgst_amount) +
      Number(inv.igst_amount)
    const gstType: 'B2B' | 'B2CS' | 'B2CL' = gstin
      ? 'B2B'
      : total > 250000
        ? 'B2CL'
        : 'B2CS'
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      invoice_type: gstType,
      taxable_amount: Number(inv.taxable_amount),
      cgst_amount: Number(inv.cgst_amount),
      sgst_amount: Number(inv.sgst_amount),
      igst_amount: Number(inv.igst_amount),
      state_code: inv.state_code ?? cust?.state_code ?? '',
      customer_gstin: gstin,
    }
  })

  const items: InvoiceItemRow[] = rows.flatMap((inv) => {
    const invItems = Array.isArray(inv.invoice_items)
      ? inv.invoice_items
      : inv.invoice_items
        ? [inv.invoice_items]
        : []
    return invItems.map((item: any) => ({
      invoice_id: inv.id,
      hsn_code: item.hsn_code ?? '',
      tax_rate: Number(item.tax_rate ?? 0),
      taxable_amount: Number(item.taxable_amount ?? 0),
      cgst_amount: Number(item.cgst_amount ?? 0),
      sgst_amount: Number(item.sgst_amount ?? 0),
      igst_amount: Number(item.igst_amount ?? 0),
    }))
  })

  const sections = groupInvoicesIntoGstr1(invoices, items)
  const newStatus = status === 'ready' ? 'ready' : 'draft'

  const { error: upsertError } = await supabase.from('gst_period_data').upsert(
    { company_id: companyId, period_type: 'GSTR-1', fy, period, status: newStatus, data: sections },
    { onConflict: 'company_id,period_type,fy,period' }
  )

  if (upsertError) return { error: upsertError.message }
  return { success: true, data: sections }
}

export async function saveGstr3b(
  fy: string,
  period: string,
  manualItc: { igst: number; cgst: number; sgst: number }
): Promise<ActionResult> {
  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { supabase, companyId } = auth

  const status = await checkFiledStatus(supabase, companyId, 'GSTR-3B', fy, period)
  if (status === 'filed') return { error: 'Period is filed and cannot be modified.' }

  // Read stored GSTR-1 sections for this period
  const { data: gstr1Row, error: readError } = await supabase
    .from('gst_period_data')
    .select('data')
    .eq('company_id', companyId)
    .eq('period_type', 'GSTR-1')
    .eq('fy', fy)
    .eq('period', period)
    .maybeSingle()

  if (readError) return { error: readError.message }

  const sections = (gstr1Row as any)?.data ?? { b2b: [], b2cs: [], b2cl: [], cdnr: [], hsn: [] }
  const result = computeGstr3b(sections, manualItc)

  const { error: upsertError } = await supabase.from('gst_period_data').upsert(
    { company_id: companyId, period_type: 'GSTR-3B', fy, period, status: 'draft', data: result },
    { onConflict: 'company_id,period_type,fy,period' }
  )

  if (upsertError) return { error: upsertError.message }
  return { success: true, data: result }
}

export async function computeGstr9(fy: string): Promise<ActionResult> {
  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { supabase, companyId } = auth

  const { data: rows, error: fetchError } = await supabase
    .from('gst_period_data')
    .select('period_type, period, data')
    .eq('company_id', companyId)
    .eq('fy', fy)
    .in('period_type', ['GSTR-1', 'GSTR-3B'])

  if (fetchError) return { error: fetchError.message }

  const result = aggregateMonthlyForGstr9((rows ?? []) as any[])

  const { error: upsertError } = await supabase.from('gst_period_data').upsert(
    { company_id: companyId, period_type: 'GSTR-9', fy, period: 'annual', status: 'draft', data: result },
    { onConflict: 'company_id,period_type,fy,period' }
  )

  if (upsertError) return { error: upsertError.message }
  return { success: true, data: result }
}

export async function updatePeriodStatus(
  periodType: 'GSTR-1' | 'GSTR-3B' | 'GSTR-9',
  fy: string,
  period: string,
  status: 'draft' | 'ready' | 'filed'
): Promise<ActionResult> {
  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { supabase, companyId } = auth

  const currentStatus = await checkFiledStatus(supabase, companyId, periodType, fy, period)
  if (currentStatus === 'filed') return { error: 'Period is filed and cannot be modified.' }

  const updatePayload: Record<string, unknown> = {
    company_id: companyId,
    period_type: periodType,
    fy,
    period,
    status,
  }
  if (status === 'filed') updatePayload.filed_at = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('gst_period_data')
    .upsert(updatePayload, { onConflict: 'company_id,period_type,fy,period' })

  if (updateError) return { error: updateError.message }
  return { success: true }
}
