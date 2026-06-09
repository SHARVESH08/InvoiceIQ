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
