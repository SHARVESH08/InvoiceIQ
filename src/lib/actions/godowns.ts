'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { GodownSchema } from '@/lib/schemas/godown'

// ─────────────────────────────────────────────────────────────────────────────
// createGodown
// Inserts a new godown for the current company.
// is_default is always set to false — only the DB trigger creates the default
// godown. Client cannot inject is_default (not in GodownSchema) — T-06-23.
// ─────────────────────────────────────────────────────────────────────────────
export async function createGodown(
  input: z.infer<typeof GodownSchema>
): Promise<{ error: string } | never> {
  const parsed = GodownSchema.safeParse(input)
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

  const { error: insertError } = await supabase.from('godowns').insert({
    name: parsed.data.name,
    address: parsed.data.address ?? null,
    company_id: companyId,
    is_default: false, // hardcoded — never accept from client (T-06-23)
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: 'A godown with this name already exists.' }
    }
    return { error: insertError.message }
  }

  redirect('/settings/godowns?created=1')
}

// ─────────────────────────────────────────────────────────────────────────────
// updateGodown
// Updates name and address only. Never touches is_default — prevents privilege
// escalation via rename.
// ─────────────────────────────────────────────────────────────────────────────
export async function updateGodown(
  id: string,
  input: z.infer<typeof GodownSchema>
): Promise<{ error: string } | never> {
  const parsed = GodownSchema.safeParse(input)
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

  const { error: updateError } = await supabase
    .from('godowns')
    .update({
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      // is_default is intentionally NOT updated here
    })
    .eq('id', id)

  if (updateError) {
    if (updateError.code === '23505') {
      return { error: 'A godown with this name already exists.' }
    }
    return { error: updateError.message }
  }

  redirect('/settings/godowns?updated=1')
}

// ─────────────────────────────────────────────────────────────────────────────
// deactivateGodown
// Soft-deletes a godown (sets is_active = false). Enforces 4 guards in order:
//
//   Guard 1 — Default godown: cannot deactivate is_default=true (T-06-20).
//             UI omits the button but server enforces it independently.
//   Guard 2 — Stock quantity: sum of quantity + reserved_qty must be 0 (T-06-21).
//             reserved_qty > 0 means a pending transfer-out is in progress —
//             stock is still "in" this godown from a balance perspective.
//   Guard 3 — Pending transfers: no pending stock_transfers referencing this
//             godown as source or destination (T-06-22). Approving a transfer
//             post-deactivation would create orphaned stock movement.
//   Guard 4 (final): UPDATE godowns SET is_active = false.
// ─────────────────────────────────────────────────────────────────────────────
export async function deactivateGodown(
  id: string
): Promise<{ error: string } | never> {
  if (!id || typeof id !== 'string') {
    return { error: 'Invalid godown id' }
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

  // Guard 1: default godown check (T-06-20)
  const { data: godown, error: fetchError } = await supabase
    .from('godowns')
    .select('id, is_default, is_active')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !godown) {
    return { error: 'Godown not found.' }
  }

  if (godown.is_default) {
    return { error: 'The default godown cannot be deactivated.' }
  }

  // Guard 2: stock quantity + reserved_qty check (T-06-21)
  const { data: inventoryRows, error: inventoryError } = await supabase
    .from('inventory')
    .select('quantity, reserved_qty')
    .eq('godown_id', id)

  if (inventoryError) {
    return { error: inventoryError.message }
  }

  const rows = inventoryRows ?? []
  const totalQty = rows.reduce(
    (sum: number, row: { quantity: number; reserved_qty: number }) =>
      sum + (row.quantity ?? 0),
    0
  )
  const totalReserved = rows.reduce(
    (sum: number, row: { quantity: number; reserved_qty: number }) =>
      sum + (row.reserved_qty ?? 0),
    0
  )

  if (totalQty > 0 || totalReserved > 0) {
    const totalStock = totalQty + totalReserved
    return {
      error: `Transfer all stock out of this godown before deactivating. (${totalStock} units remaining)`,
    }
  }

  // Guard 3: pending transfers check (T-06-22, per review note Codex Plan 03)
  const { count: pendingCount, error: transferError } = await supabase
    .from('stock_transfers')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .or(`from_godown_id.eq.${id},to_godown_id.eq.${id}`)

  if (transferError) {
    return { error: transferError.message }
  }

  if ((pendingCount ?? 0) > 0) {
    return {
      error: `Resolve all pending transfers involving this godown before deactivating. (${pendingCount} pending)`,
    }
  }

  // All guards passed — soft delete
  const { error: updateError } = await supabase
    .from('godowns')
    .update({ is_active: false })
    .eq('id', id)
    .eq('company_id', companyId)

  if (updateError) {
    return { error: updateError.message }
  }

  redirect('/settings/godowns?deactivated=1')
}
