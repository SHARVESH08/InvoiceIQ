'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { SetStockLevelSchema } from '@/lib/schemas/inventory'
import { revalidateLowStockTag } from '@/lib/cache/low-stock'
import { requirePermission } from '@/lib/auth/require-permission'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type InventoryStatus = 'ok' | 'low_stock' | 'out_of_stock'

export interface AggregatedInventoryRow {
  product_id: string
  product_name: string
  unit: string
  total_qty: number
  total_reserved: number
  total_available: number
  reorder_level: number
  godown_count: number
  status: InventoryStatus
}

export interface GodownInventoryRow {
  godown_id: string
  godown_name: string
  is_default: boolean
  qty: number
  reserved: number
  available: number
  reorder_level: number
  status: InventoryStatus
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeStatus(available: number, reorderLevel: number): InventoryStatus {
  if (available === 0) return 'out_of_stock'
  if (reorderLevel > 0 && available <= reorderLevel) return 'low_stock'
  return 'ok'
}

// ─────────────────────────────────────────────────────────────────────────────
// getInventoryAggregated
// Returns per-product aggregate rows across all active godowns.
// filter='low_stock' returns only low_stock + out_of_stock products.
// T-06-15: company_id resolved via get_company_id() RPC; RLS is secondary.
// Low-stock filter applied in TypeScript — PostgREST cannot compare two columns.
// ─────────────────────────────────────────────────────────────────────────────
export async function getInventoryAggregated(
  filter?: string
): Promise<{ data: AggregatedInventoryRow[] } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: 'Company membership not found' }
  }

  const { data: rows, error: fetchError } = await supabase
    .from('inventory')
    .select(
      `
      product_id,
      quantity,
      reserved_qty,
      reorder_level,
      godown_id,
      products!inner(name, unit),
      godowns!inner(is_active)
    `
    )
    .eq('company_id', companyId)
    .eq('godowns.is_active', true)

  if (fetchError) {
    return { error: fetchError.message }
  }

  // Group by product_id
  const productMap = new Map<
    string,
    {
      product_name: string
      unit: string
      total_qty: number
      total_reserved: number
      reorder_levels: number[]
      godown_count: number
    }
  >()

  for (const row of rows ?? []) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products
    if (!product) continue

    const existing = productMap.get(row.product_id)
    if (existing) {
      existing.total_qty += row.quantity
      existing.total_reserved += row.reserved_qty
      existing.reorder_levels.push(row.reorder_level)
      existing.godown_count += 1
    } else {
      productMap.set(row.product_id, {
        product_name: product.name,
        unit: product.unit,
        total_qty: row.quantity,
        total_reserved: row.reserved_qty,
        reorder_levels: [row.reorder_level],
        godown_count: 1,
      })
    }
  }

  // Build result rows — status computed on available_qty (not raw qty)
  let result: AggregatedInventoryRow[] = []
  for (const [product_id, agg] of Array.from(productMap.entries())) {
    const total_available = agg.total_qty - agg.total_reserved
    // Use max reorder level across godowns as the aggregate trigger threshold
    const reorder_level = Math.max(...agg.reorder_levels, 0)
    const status = computeStatus(total_available, reorder_level)

    result.push({
      product_id,
      product_name: agg.product_name,
      unit: agg.unit,
      total_qty: agg.total_qty,
      total_reserved: agg.total_reserved,
      total_available,
      reorder_level,
      godown_count: agg.godown_count,
      status,
    })
  }

  // Apply low_stock filter in TypeScript (PostgREST cannot compare two columns)
  if (filter === 'low_stock' || filter === 'out_of_stock') {
    result = result.filter((r) => r.status !== 'ok')
  }

  // Sort by product name
  result.sort((a, b) => a.product_name.localeCompare(b.product_name))

  return { data: result }
}

// ─────────────────────────────────────────────────────────────────────────────
// getInventoryByProduct
// Returns per-godown breakdown for a single product.
// reserved comes directly from inventory.reserved_qty (Plan 01 ghost stock fix).
// T-06-17: single-table query, company_id scoped.
// ─────────────────────────────────────────────────────────────────────────────
export async function getInventoryByProduct(
  productId: string
): Promise<{ data: GodownInventoryRow[] } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: 'Company membership not found' }
  }

  const { data: rows, error: fetchError } = await supabase
    .from('inventory')
    .select(
      `
      godown_id,
      quantity,
      reserved_qty,
      reorder_level,
      godowns!inner(name, is_default, is_active)
    `
    )
    .eq('company_id', companyId)
    .eq('product_id', productId)
    .eq('godowns.is_active', true)

  if (fetchError) {
    return { error: fetchError.message }
  }

  const result: GodownInventoryRow[] = (rows ?? []).map((row) => {
    const godown = Array.isArray(row.godowns) ? row.godowns[0] : row.godowns
    const available = row.quantity - row.reserved_qty
    return {
      godown_id: row.godown_id,
      godown_name: godown?.name ?? 'Unknown',
      is_default: godown?.is_default ?? false,
      qty: row.quantity,
      reserved: row.reserved_qty,
      available,
      reorder_level: row.reorder_level,
      status: computeStatus(available, row.reorder_level),
    }
  })

  // Default godown first, then alphabetical
  result.sort((a, b) => {
    if (a.is_default && !b.is_default) return -1
    if (!a.is_default && b.is_default) return 1
    return a.godown_name.localeCompare(b.godown_name)
  })

  return { data: result }
}

// ─────────────────────────────────────────────────────────────────────────────
// setStockLevel
// Upserts an inventory row for product_id+godown_id.
// Does NOT overwrite reserved_qty — preserves existing reservations.
// company_id resolved server-side (T-06-14: user cannot supply their own).
// ─────────────────────────────────────────────────────────────────────────────
export async function setStockLevel(
  input: z.infer<typeof SetStockLevelSchema>
): Promise<{ success: boolean } | { error: string }> {
  const denied = await requirePermission('inventory:write')
  if (denied) return denied

  const parsed = SetStockLevelSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: 'Company membership not found' }
  }

  // Upsert: ON CONFLICT (product_id, godown_id) DO UPDATE quantity + reorder_level only.
  // reserved_qty is NOT included in the upsert — preserves existing transfer reservations.
  const { error: upsertError } = await supabase.from('inventory').upsert(
    {
      company_id: companyId,
      product_id: parsed.data.product_id,
      godown_id: parsed.data.godown_id,
      quantity: parsed.data.quantity,
      reorder_level: parsed.data.reorder_level,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'product_id,godown_id',
      ignoreDuplicates: false,
    }
  )

  if (upsertError) {
    return { error: upsertError.message }
  }

  // Invalidate cached low-stock badge count + inventory page cache (T-06-19)
  revalidateLowStockTag(companyId)
  revalidatePath('/inventory')

  return { success: true }
}
