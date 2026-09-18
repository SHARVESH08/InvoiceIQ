'use server'

import { createClient } from '@/lib/supabase/server'
import type { ExportCustomerInvoiceRow } from '@/lib/export'

// ─────────────────────────────────────────────────────────────────────────────
// getAllMyInvoicesForExport
// Every invoice the signed-in customer can see, unpaginated — the /my table
// shows 20 at a time, but "download all" has to mean all.
//
// No email filter here on purpose: the customer_read_own_invoices RLS policy
// already scopes rows to auth.email(). Re-filtering in the query would just be
// a second, weaker copy of that rule.
// ─────────────────────────────────────────────────────────────────────────────

/** Matches the page size cap in the invoices RLS reads; keeps one export bounded. */
const MAX_EXPORT_ROWS = 5000

export async function getAllMyInvoicesForExport(): Promise<
  { error: string } | { invoices: ExportCustomerInvoiceRow[]; truncated: boolean }
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('invoices')
    .select(
      'invoice_number, invoice_date, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount, paid_amount, status, payment_status, due_date, companies(name)'
    )
    // Customers never see the business's unsent drafts — mirrors /my.
    .neq('status', 'draft')
    .order('invoice_date', { ascending: false })
    .limit(MAX_EXPORT_ROWS)

  if (error) return { error: error.message }

  const rows = data ?? []

  const invoices: ExportCustomerInvoiceRow[] = rows.map((inv) => {
    const company = inv.companies as unknown as { name: string } | { name: string }[] | null
    const businessName = Array.isArray(company)
      ? company[0]?.name ?? 'Unknown'
      : company?.name ?? 'Unknown'

    // A cancelled invoice is void — report that, not the stale payment_status
    // it keeps after cancellation. Same rule the on-screen table applies.
    const status = inv.status === 'cancelled' ? 'cancelled' : inv.payment_status

    return {
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      business_name: businessName,
      taxable_amount: inv.taxable_amount,
      cgst_amount: inv.cgst_amount,
      sgst_amount: inv.sgst_amount,
      igst_amount: inv.igst_amount,
      total_amount: inv.total_amount,
      paid_amount: inv.paid_amount,
      status,
      due_date: inv.due_date,
    }
  })

  return { invoices, truncated: rows.length === MAX_EXPORT_ROWS }
}
