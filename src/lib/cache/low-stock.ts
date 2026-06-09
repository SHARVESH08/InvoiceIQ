import 'server-only'
import { unstable_cache, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// Cache tag helpers
// Each company gets its own cache entry — T-06-18: no cross-tenant leak.
// ─────────────────────────────────────────────────────────────────────────────
export const lowStockTag = (companyId: string) => `low-stock-${companyId}`

// ─────────────────────────────────────────────────────────────────────────────
// getCachedLowStockCount
// Counts unique products with an active low_stock alert for this company.
// Wrapped in unstable_cache with a company-scoped tag to avoid a DB round-trip
// on every page load (per review MEDIUM on nav badge caching).
// Safety revalidate: 60s as a last resort even without explicit tag invalidation.
// ─────────────────────────────────────────────────────────────────────────────
export async function getCachedLowStockCount(companyId: string): Promise<number> {
  const fetcher = unstable_cache(
    async (cid: string): Promise<number> => {
      const supabase = await createClient()
      const { count } = await supabase
        .from('pricing_alerts')
        .select('product_id', { count: 'exact', head: true })
        .eq('alert_type', 'low_stock')
        .eq('is_active', true)
        .eq('company_id', cid)
      return count ?? 0
    },
    ['low-stock-count', companyId],
    { tags: [lowStockTag(companyId)], revalidate: 60 }
  )
  return fetcher(companyId)
}

// ─────────────────────────────────────────────────────────────────────────────
// revalidateLowStockTag
// Called by setStockLevel, approveTransfer, rejectTransfer, createTransfer
// to bust the cached count (T-06-19: stale data mitigation).
// ─────────────────────────────────────────────────────────────────────────────
export function revalidateLowStockTag(companyId: string): void {
  revalidateTag(lowStockTag(companyId))
}
