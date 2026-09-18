'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/require-permission'

const PAGE = '/dashboard/settings/pricing-alerts'

type Result = { success: true } | { error: string }

// Explicit union — without it TS widens each return's object literal with
// optional-undefined props from the other branches, breaking `'error' in c`
// narrowing at the call sites.
type Ctx =
  | { error: string }
  | { supabase: Awaited<ReturnType<typeof createClient>>; companyId: string }

async function ctx(): Promise<Ctx> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) return { error: 'No company found' as const }
  return { supabase, companyId: companyId as string }
}

/** All product_ids monitored for the authenticated user's company. */
export async function getMonitoredProductIds(): Promise<string[]> {
  const c = await ctx()
  if ('error' in c) return []
  const { data } = await c.supabase
    .from('pricing_monitor_products')
    .select('product_id')
    .eq('company_id', c.companyId)
  return (data ?? []).map((r) => r.product_id as string)
}

/** Enable/disable price monitoring for a single product. */
export async function toggleProductAlert(productId: string, enabled: boolean): Promise<Result> {
  const denied = await requirePermission('inventory:write')
  if (denied) return denied

  if (!productId) return { error: 'Product is required' }
  const c = await ctx()
  if ('error' in c) return c

  if (enabled) {
    const { error } = await c.supabase
      .from('pricing_monitor_products')
      .upsert(
        { company_id: c.companyId, product_id: productId },
        { onConflict: 'company_id,product_id', ignoreDuplicates: true },
      )
    if (error) {
      console.error('[pricing-monitor] enable product failed:', error)
      return { error: 'Failed to enable alert' }
    }
  } else {
    const { error } = await c.supabase
      .from('pricing_monitor_products')
      .delete()
      .eq('company_id', c.companyId)
      .eq('product_id', productId)
    if (error) {
      console.error('[pricing-monitor] disable product failed:', error)
      return { error: 'Failed to disable alert' }
    }
  }
  revalidatePath(PAGE)
  return { success: true }
}

/** Enable/disable monitoring for every categorized product in the company. */
export async function toggleAllAlerts(enabled: boolean): Promise<Result> {
  const denied = await requirePermission('inventory:write')
  if (denied) return denied

  const c = await ctx()
  if ('error' in c) return c

  if (enabled) {
    const { data: prodRows, error: prodErr } = await c.supabase
      .from('products')
      .select('id')
      .eq('company_id', c.companyId)
      .not('category', 'is', null)
    if (prodErr) {
      console.error('[pricing-monitor] enable all: read products failed:', prodErr)
      return { error: 'Failed to read products' }
    }
    const ids = (prodRows ?? []).map((r) => r.id as string)
    if (ids.length === 0) return { success: true }

    const { error } = await c.supabase
      .from('pricing_monitor_products')
      .upsert(
        ids.map((product_id) => ({ company_id: c.companyId, product_id })),
        { onConflict: 'company_id,product_id', ignoreDuplicates: true },
      )
    if (error) {
      console.error('[pricing-monitor] enable all failed:', error)
      return { error: 'Failed to enable all alerts' }
    }
  } else {
    const { error } = await c.supabase
      .from('pricing_monitor_products')
      .delete()
      .eq('company_id', c.companyId)
    if (error) {
      console.error('[pricing-monitor] disable all failed:', error)
      return { error: 'Failed to disable all alerts' }
    }
  }
  revalidatePath(PAGE)
  return { success: true }
}

/** Enable/disable monitoring for every product in a category (the master toggle). */
export async function toggleCategoryAlert(category: string, enabled: boolean): Promise<Result> {
  const denied = await requirePermission('inventory:write')
  if (denied) return denied

  const trimmed = category?.trim() ?? ''
  if (!trimmed) return { error: 'Category is required' }
  const c = await ctx()
  if ('error' in c) return c

  const { data: prodRows, error: prodErr } = await c.supabase
    .from('products')
    .select('id')
    .eq('company_id', c.companyId)
    .eq('category', trimmed)
  if (prodErr) return { error: 'Failed to read products' }

  const ids = (prodRows ?? []).map((r) => r.id as string)
  if (ids.length === 0) return { error: 'No products in this category' }

  if (enabled) {
    const { error } = await c.supabase
      .from('pricing_monitor_products')
      .upsert(
        ids.map((product_id) => ({ company_id: c.companyId, product_id })),
        { onConflict: 'company_id,product_id', ignoreDuplicates: true },
      )
    if (error) {
      console.error('[pricing-monitor] enable category failed:', error)
      return { error: 'Failed to enable category' }
    }
  } else {
    const { error } = await c.supabase
      .from('pricing_monitor_products')
      .delete()
      .eq('company_id', c.companyId)
      .in('product_id', ids)
    if (error) {
      console.error('[pricing-monitor] disable category failed:', error)
      return { error: 'Failed to disable category' }
    }
  }
  revalidatePath(PAGE)
  return { success: true }
}
