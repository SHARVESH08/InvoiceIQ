import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { searchBrave, extractPricesFromResults, computeAveragePrice } from '@/lib/brave/search'

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
    const resend = new Resend(process.env.RESEND_API_KEY)

    // Fetch all monitored categories (all active rows in pricing_monitor_categories)
    const { data: categoryRows, error: catError } = await supabase
      .from('pricing_monitor_categories')
      .select('company_id, category')

    if (catError) {
      console.error('[pricing-alerts] fetch categories error:', catError)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }

    const rows = categoryRows ?? []

    // T-11-16: De-duplicate categories across companies to minimize Brave API calls (2,000/month limit)
    const uniqueCategories = [...new Set(rows.map((r) => r.category as string))]

    const MAX_BRAVE_CALLS = 200
    const cappedCategories = uniqueCategories.slice(0, MAX_BRAVE_CALLS)
    if (uniqueCategories.length > MAX_BRAVE_CALLS) {
      console.warn('[pricing-alerts] Brave API call cap reached — some categories skipped')
    }

    // Build map: category → list of company_ids monitoring it
    const categoryToCompanies: Record<string, string[]> = {}
    for (const row of rows) {
      const cat = row.category as string
      if (!categoryToCompanies[cat]) categoryToCompanies[cat] = []
      categoryToCompanies[cat].push(row.company_id as string)
    }

    let categoriesChecked = 0
    let alertsSent = 0

    for (const category of cappedCategories) {
      let marketAvg: number | null = null

      try {
        // T-11-16: One Brave call per unique category
        const results = await searchBrave(`${category} price india wholesale`, 10)
        const prices = extractPricesFromResults(results)
        marketAvg = computeAveragePrice(prices)
      } catch (braveErr) {
        // T-11-16: Return 500 on Brave API error rather than retrying
        console.error(`[pricing-alerts] Brave Search error for category "${category}":`, braveErr)
        continue
      }

      if (marketAvg === null) {
        console.log(`[pricing-alerts] No price data for category "${category}" — skipping`)
        continue
      }

      categoriesChecked++

      const companiesForCategory = categoryToCompanies[category] ?? []

      for (const companyId of companiesForCategory) {
        // Compute company average price for products in this category
        const { data: productRows } = await supabase
          .from('products')
          .select('base_price')
          .eq('company_id', companyId)
          .ilike('category', `%${category}%`)

        const products = productRows ?? []
        if (products.length === 0) continue

        const totalPrice = products.reduce((sum, p) => sum + (p.base_price ?? 0), 0)
        const companyAvg = totalPrice / products.length

        if (companyAvg === 0) continue

        const delta = Math.abs(marketAvg - companyAvg) / companyAvg

        if (delta <= 0.10) continue

        // Delta exceeds 10% threshold — find company admin email
        const { data: adminRows } = await supabase
          .from('company_users')
          .select('user_id, companies(name)')
          .eq('company_id', companyId)
          .eq('role', 'admin')
          .limit(1)

        const adminUser = adminRows?.[0]
        if (!adminUser) {
          console.log(`[pricing-alerts] No admin found for company ${companyId} — skipping alert`)
          continue
        }

        // Get admin email from auth.users via service role
        const { data: authUser } = await supabase.auth.admin.getUserById(adminUser.user_id)
        const adminEmail = authUser?.user?.email

        if (!adminEmail) {
          console.log(`[pricing-alerts] No admin email for company ${companyId} — skipping alert`)
          continue
        }

        const companyName = (adminUser.companies as { name?: string } | null)?.name ?? 'Your company'
        const marketDisplay = marketAvg.toFixed(2)
        const companyDisplay = companyAvg.toFixed(2)
        const suggestedLow = (marketAvg * 0.95).toFixed(2)
        const suggestedHigh = (marketAvg * 1.05).toFixed(2)
        const deltaPercent = (delta * 100).toFixed(1)

        const { error: emailError } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: adminEmail,
          subject: `Pricing alert: ${category} market price changed`,
          text: [
            `Hello ${companyName},`,
            '',
            `Market price for "${category}" has changed significantly:`,
            '',
            `  Market average:   ₹${marketDisplay}`,
            `  Your average:     ₹${companyDisplay}`,
            `  Difference:       ${deltaPercent}%`,
            `  Suggested range:  ₹${suggestedLow} – ₹${suggestedHigh}`,
            '',
            'Update your pricing at:',
            `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://invoiceiq.in'}/dashboard/settings/pricing-alerts`,
            '',
            'This alert was generated by InvoiceIQ\'s automated pricing monitor.',
          ].join('\n'),
        })

        if (emailError) {
          console.error(`[pricing-alerts] Resend error for company ${companyId}:`, emailError)
        } else {
          console.log(`[pricing-alerts] alert sent company=${companyId} category="${category}" delta=${deltaPercent}%`)
          alertsSent++
        }
      }
    }

    return NextResponse.json({ categories_checked: categoriesChecked, alerts_sent: alertsSent }, { status: 200 })
  } catch (err) {
    console.error('[pricing-alerts] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
