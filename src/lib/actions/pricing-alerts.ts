'use server'

import { createClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────────────────
// getPricingCategories
// Returns monitored pricing categories for the authenticated user's company.
// ─────────────────────────────────────────────────────────────────────────────
export async function getPricingCategories(): Promise<
  { id: string; category: string; created_at: string }[]
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) return []

  const { data, error } = await supabase
    .from('pricing_monitor_categories')
    .select('id, category, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pricing-alerts] getPricingCategories failed:', error)
    }
    return []
  }

  return (data ?? []) as { id: string; category: string; created_at: string }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// addPricingCategory
// Validates and upserts a new monitored category for the company.
// Idempotent — silently succeeds if the category already exists.
// T-11-23: validates non-empty + max 100 chars; parameterized query prevents SQL injection
// ─────────────────────────────────────────────────────────────────────────────
export async function addPricingCategory(
  category: string
): Promise<{ error: string } | { success: true; category: { id: string; category: string; created_at: string } }> {
  const trimmed = category?.trim() ?? ''

  if (!trimmed) {
    return { error: 'Category name cannot be empty' }
  }
  if (trimmed.length > 100) {
    return { error: 'Category name must be 100 characters or fewer' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) return { error: 'No company found' }

  const { data, error } = await supabase
    .from('pricing_monitor_categories')
    .upsert(
      { company_id: companyId, category: trimmed },
      { onConflict: 'company_id,category', ignoreDuplicates: false }
    )
    .select('id, category, created_at')
    .single()

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pricing-alerts] addPricingCategory failed:', error)
    }
    return { error: 'Failed to add category' }
  }

  return { success: true, category: data as { id: string; category: string; created_at: string } }
}

// ─────────────────────────────────────────────────────────────────────────────
// toggleAllProductCategories
// One-switch enable/disable of pricing alerts for ALL of the company's product
// categories. The cron matches monitored categories to products via
// products.category ILIKE, so "all products" == every distinct product category.
//   enabled=true  → upsert every distinct product category
//   enabled=false → remove the monitored rows that correspond to product categories
// Returns the full, updated monitored-category list.
// ─────────────────────────────────────────────────────────────────────────────
export async function toggleAllProductCategories(
  enabled: boolean
): Promise<
  | { error: string }
  | { success: true; categories: { id: string; category: string; created_at: string }[] }
> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) return { error: 'No company found' }

  // Distinct, non-empty product categories for this company
  const { data: productRows, error: prodErr } = await supabase
    .from('products')
    .select('category')
    .eq('company_id', companyId)
    .not('category', 'is', null)

  if (prodErr) return { error: 'Failed to read your products' }

  const productCategories = Array.from(
    new Set(
      (productRows ?? [])
        .map((p) => ((p.category as string | null) ?? '').trim())
        .filter((c) => c.length > 0 && c.length <= 100)
    )
  )

  if (productCategories.length === 0) {
    return { error: 'No product categories found. Add a category to your products first.' }
  }

  if (enabled) {
    const { error } = await supabase.from('pricing_monitor_categories').upsert(
      productCategories.map((category) => ({ company_id: companyId, category })),
      { onConflict: 'company_id,category', ignoreDuplicates: true }
    )
    if (error) return { error: 'Failed to enable alerts for all products' }
  } else {
    const { error } = await supabase
      .from('pricing_monitor_categories')
      .delete()
      .eq('company_id', companyId)
      .in('category', productCategories)
    if (error) return { error: 'Failed to disable alerts' }
  }

  const { data: updated } = await supabase
    .from('pricing_monitor_categories')
    .select('id, category, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return {
    success: true,
    categories: (updated ?? []) as { id: string; category: string; created_at: string }[],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// removePricingCategory
// Deletes a monitored category by ID.
// T-11-24: explicit company_id check prevents cross-tenant deletion (defense in depth + RLS)
// ─────────────────────────────────────────────────────────────────────────────
export async function removePricingCategory(
  categoryId: string
): Promise<{ error: string } | { success: true }> {
  if (!categoryId) return { error: 'Category ID is required' }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) return { error: 'No company found' }

  const { error } = await supabase
    .from('pricing_monitor_categories')
    .delete()
    .eq('id', categoryId)
    .eq('company_id', companyId) // T-11-24: explicit tenant guard

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pricing-alerts] removePricingCategory failed:', error)
    }
    return { error: 'Failed to remove category' }
  }

  return { success: true }
}
