import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPricingCategories } from '@/lib/actions/pricing-alerts'
import { PricingAlertSettings } from './_components/pricing-alert-settings'

// ─────────────────────────────────────────────────────────────────────────────
// Pricing Alert Settings page — RSC shell
// PRICING-01: allows users to manage monitored product categories for market-
// price alerts. Auth + data fetch happen here; PricingAlertSettings is a client
// component that handles add/remove interactivity.
// ─────────────────────────────────────────────────────────────────────────────
export default async function PricingAlertsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) redirect('/login')

  const categories = await getPricingCategories()

  // Distinct, non-empty product categories for the all-products toggle + dropdown
  const { data: productRows } = await supabase
    .from('products')
    .select('category')
    .eq('company_id', companyId)
    .not('category', 'is', null)

  const productCategories = Array.from(
    new Set(
      (productRows ?? [])
        .map((p) => ((p.category as string | null) ?? '').trim())
        .filter((c) => c.length > 0)
    )
  ).sort()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold leading-tight">Pricing Alert Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor market prices for your product categories. Alerts are sent weekly when market
          prices differ significantly from your current prices.
        </p>
      </div>
      <PricingAlertSettings categories={categories} productCategories={productCategories} />
    </div>
  )
}
