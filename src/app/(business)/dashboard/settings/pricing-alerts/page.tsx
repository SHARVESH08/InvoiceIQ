import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMonitoredProductIds } from '@/lib/actions/pricing-monitor'
import { ProductAlertManager } from './_components/product-alert-manager'
import type { ProductRow } from '@/lib/pricing/category-state'

// Pricing Alert Settings — RSC shell. Per-product market-price monitoring.
export default async function PricingAlertsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) redirect('/login')

  const { data: productRows } = await supabase
    .from('products')
    .select('id, name, category, selling_price')
    .eq('company_id', companyId)
    .not('category', 'is', null)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  const products: ProductRow[] = (productRows ?? [])
    .map((p) => ({
      id: p.id as string,
      name: (p.name as string | null) ?? 'Unnamed product',
      category: ((p.category as string | null) ?? '').trim(),
      selling_price: (p.selling_price as number | null) ?? 0,
    }))
    .filter((p) => p.category.length > 0)

  const monitoredIds = await getMonitoredProductIds()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold leading-tight">Pricing Alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor market prices per product. Toggle a whole category, or pick individual products.
          We email you weekly when a monitored product drifts more than 10% from the market.
        </p>
      </div>
      <ProductAlertManager products={products} initialMonitoredIds={monitoredIds} />
    </div>
  )
}
