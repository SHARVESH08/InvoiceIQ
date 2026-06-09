import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@6'

Deno.serve(async (req: Request) => {
  const startTime = Date.now()

  // ── Auth guard (T-06-34) ──────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Clients ───────────────────────────────────────────────────────────────
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, {
    auth: { persistSession: false },
  })
  const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@invoiceiq.app'

  // ── Query low_stock_summary view ──────────────────────────────────────────
  const { data: rows, error: rowsError } = await supabase
    .from('low_stock_summary')
    .select('company_id, product_name, unit, quantity, reorder_level, godown_name')

  if (rowsError) {
    console.error(JSON.stringify({ event: 'query_error', error: rowsError.message }))
    return new Response(
      JSON.stringify({ error: rowsError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── Empty result fast-path ────────────────────────────────────────────────
  if (!rows || rows.length === 0) {
    const emptyLog = {
      event: 'low_stock_digest_run',
      ts: new Date().toISOString(),
      companies_total: 0,
      companies_with_admin: 0,
      companies_skipped_no_admin: 0,
      emails_sent: 0,
      emails_failed: 0,
      failed_companies: [],
      duration_ms: Date.now() - startTime,
    }
    console.log(JSON.stringify(emptyLog))
    return new Response(
      JSON.stringify({ ok: true, message: 'No low stock items', companies_total: 0, emails_sent: 0, emails_failed: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── Group by company_id (T-06-35 cross-company isolation) ─────────────────
  const byCompany = new Map<string, typeof rows>()
  for (const row of rows) {
    const arr = byCompany.get(row.company_id) ?? []
    arr.push(row)
    byCompany.set(row.company_id, arr)
  }

  // ── Counters ──────────────────────────────────────────────────────────────
  const companies_total = byCompany.size
  let companies_with_admin = 0
  let companies_skipped_no_admin = 0
  let emails_sent = 0
  let emails_failed = 0
  const failed_companies: string[] = []

  // ── Per-company loop ──────────────────────────────────────────────────────
  for (const [companyId, companyRows] of byCompany) {
    // Fetch ALL admin user_ids (no .limit(1) — per review MEDIUM multi-admin)
    const { data: adminUsers, error: adminError } = await supabase
      .from('company_users')
      .select('user_id')
      .eq('company_id', companyId)
      .eq('role', 'admin')

    if (adminError || !adminUsers || adminUsers.length === 0) {
      console.warn(JSON.stringify({ event: 'no_admin_for_company', company_id: companyId }))
      companies_skipped_no_admin++
      continue
    }
    companies_with_admin++

    // Build plain-text body once per company (shared across all admins of this company)
    const productLines = companyRows
      .map((p) =>
        `${p.product_name} | ${p.quantity} ${p.unit ?? ''} (reorder: ${p.reorder_level}) — ${p.godown_name}`
      )
      .join('\n')
    const body =
      `Low Stock Report\n\nThe following products are at or below their reorder level:\n\n${productLines}\n\nPlease restock these items soon.`
    const subject = `Low Stock Alert — ${companyRows.length} products need attention`

    // Send to each admin (T-06-39 per-admin error isolation)
    for (const { user_id: adminUserId } of adminUsers) {
      // Fetch email via auth.admin (company_users has no email column — T-06-36 pattern)
      const { data: adminData, error: userError } = await supabase.auth.admin.getUserById(adminUserId)
      const adminEmail = adminData?.user?.email

      if (userError || !adminEmail) {
        console.warn(
          JSON.stringify({
            event: 'admin_email_unresolvable',
            company_id: companyId,
            user_id: adminUserId,
            error: userError?.message,
          }),
        )
        continue
      }

      // Send email — failure must NOT abort other companies or admins
      try {
        await resend.emails.send({ from, to: adminEmail, subject, text: body })
        emails_sent++
      } catch (sendError: unknown) {
        console.error(
          JSON.stringify({
            event: 'resend_send_failed',
            company_id: companyId,
            user_id: adminUserId,
            error: sendError instanceof Error ? sendError.message : String(sendError),
          }),
        )
        emails_failed++
        failed_companies.push(companyId)
        // Continue — do NOT abort other companies or admins
      }
    }
  }

  // ── Structured run log (T-06-38 observability) ────────────────────────────
  console.log(
    JSON.stringify({
      event: 'low_stock_digest_run',
      ts: new Date().toISOString(),
      companies_total,
      companies_with_admin,
      companies_skipped_no_admin,
      emails_sent,
      emails_failed,
      failed_companies,
      duration_ms: Date.now() - startTime,
    }),
  )

  return new Response(
    JSON.stringify({ ok: true, companies_total, emails_sent, emails_failed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
