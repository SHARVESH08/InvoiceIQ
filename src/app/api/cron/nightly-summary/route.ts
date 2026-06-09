import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateNightlySummary } from '@/lib/ai/nightly-summary'
import type { DaySnapshot } from '@/lib/ai/groq'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // T-11-12: CRON_SECRET check — 500 if undefined (misconfiguration), 401 if mismatch
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // T-11-13: Service role key — server-only, bypasses RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    // T-11-15: Cap at 500 companies to stay within Groq RPD budget — LIMIT 500
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('is_active', true)
      .order('created_at')
      .limit(500) // LIMIT 500 — Groq 1,000 RPD free tier cap

    if (companiesError) {
      console.error('[nightly-summary] fetch companies error:', companiesError)
      return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
    }

    const companyList = companies ?? []

    if (companyList.length >= 500) {
      console.warn('[nightly-summary] Groq RPD budget: 500-company cap reached — consider upgrading Groq plan')
    }

    let processed = 0

    // Sequential processing — NOT parallel — to avoid Groq RPD burst (T-11-15)
    for (const company of companyList) {
      try {
        // Revenue and invoice count for yesterday
        const { data: invoiceAgg } = await supabase
          .from('invoices')
          .select('total_amount')
          .eq('company_id', company.id)
          .gte('created_at', `${yesterday}T00:00:00Z`)
          .lt('created_at', `${today}T00:00:00Z`)

        const invoiceRows = invoiceAgg ?? []
        const invoiceCount = invoiceRows.length
        const revenue = invoiceRows.reduce((sum, r) => sum + (r.total_amount ?? 0), 0)

        // Top product by quantity sold yesterday
        const { data: topProductRows } = await supabase
          .from('invoice_items')
          .select('product_name, quantity, invoices!inner(company_id, created_at)')
          .eq('invoices.company_id', company.id)
          .gte('invoices.created_at', `${yesterday}T00:00:00Z`)
          .lt('invoices.created_at', `${today}T00:00:00Z`)

        let topProduct = 'N/A'
        if (topProductRows && topProductRows.length > 0) {
          const productTotals: Record<string, number> = {}
          for (const item of topProductRows) {
            const name = item.product_name ?? 'Unknown'
            productTotals[name] = (productTotals[name] ?? 0) + (item.quantity ?? 0)
          }
          topProduct = Object.entries(productTotals)
            .sort((a, b) => b[1] - a[1])
            .at(0)?.[0] ?? 'N/A'
        }

        // Pending invoices
        const { data: pendingRows } = await supabase
          .from('invoices')
          .select('total_amount')
          .eq('company_id', company.id)
          .in('payment_status', ['unpaid', 'overdue'])

        const pendingInvoices = pendingRows ?? []
        const pendingCount = pendingInvoices.length
        const pendingValue = pendingInvoices.reduce((sum, r) => sum + (r.total_amount ?? 0), 0)

        const snapshot: DaySnapshot = {
          date: yesterday,
          revenue,
          invoice_count: invoiceCount,
          top_product: topProduct,
          pending_count: pendingCount,
          pending_value: pendingValue,
        }

        const summaryText = await generateNightlySummary(snapshot)
        if (summaryText === 'Summary unavailable.') {
          console.warn(`[nightly-summary] Groq failed for company ${company.id} — skipping upsert`)
          continue
        }

        // Upsert nightly_summaries (idempotent on re-run)
        const { error: upsertError } = await supabase
          .from('nightly_summaries')
          .upsert(
            {
              company_id: company.id,
              summary_date: yesterday,
              summary_text: summaryText,
              data_snapshot: {
                revenue,
                invoice_count: invoiceCount,
                top_product: topProduct,
                pending_count: pendingCount,
                pending_value: pendingValue,
              },
            },
            { onConflict: 'company_id,summary_date' }
          )

        if (upsertError) {
          console.error(`[nightly-summary] upsert error for company ${company.id}:`, upsertError)
        } else {
          console.log(`[nightly-summary] company=${company.name} date=${yesterday} revenue=${revenue} invoices=${invoiceCount}`)
          processed++
        }
      } catch (companyErr) {
        console.error(`[nightly-summary] error processing company ${company.id}:`, companyErr)
      }
    }

    return NextResponse.json({ processed, date: yesterday }, { status: 200 })
  } catch (err) {
    console.error('[nightly-summary] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
