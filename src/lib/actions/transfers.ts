'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { CreateTransferSchema } from '@/lib/schemas/transfer'
import { revalidateLowStockTag } from '@/lib/cache/low-stock'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TransferRow {
  id: string
  product_id: string
  product_name: string
  product_unit: string
  from_godown_id: string
  from_godown_name: string
  to_godown_id: string
  to_godown_name: string
  qty: number
  status: string
  requested_by: string
  requester_display: string
  approved_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
  can_approve?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// getTransfers
// Returns all transfers for the company with joined product + godown names.
// currentUserId optionally passed to compute can_approve per row.
// ─────────────────────────────────────────────────────────────────────────────
export async function getTransfers(
  status?: string
): Promise<{ data: TransferRow[] } | { error: string }> {
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

  let query = supabase
    .from('stock_transfers')
    .select(
      `
      id,
      product_id,
      from_godown_id,
      to_godown_id,
      qty,
      status,
      requested_by,
      approved_by,
      notes,
      created_at,
      updated_at,
      products!stock_transfers_product_id_fkey(name, unit),
      from_godown:godowns!stock_transfers_from_godown_id_fkey(name),
      to_godown:godowns!stock_transfers_to_godown_id_fkey(name)
    `
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data: rows, error: fetchError } = await query

  if (fetchError) {
    return { error: fetchError.message }
  }

  // Collect unique requester user IDs for display name lookup
  const requesterIds = Array.from(new Set((rows ?? []).map((r) => r.requested_by)))

  // Build a map of userId → display string (email or short UUID fallback)
  // Uses server-side auth admin only available in Server Actions
  const nameMap = new Map<string, string>()
  for (const uid of requesterIds) {
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(uid)
      const email = userData?.user?.email
      const meta = userData?.user?.user_metadata
      const displayName =
        meta?.full_name ??
        meta?.name ??
        (email ? email.split('@')[0] : uid.slice(0, 8))
      nameMap.set(uid, displayName)
    } catch {
      nameMap.set(uid, uid.slice(0, 8))
    }
  }

  const result: TransferRow[] = (rows ?? []).map((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products
    const fromGodown = Array.isArray(row.from_godown)
      ? row.from_godown[0]
      : row.from_godown
    const toGodown = Array.isArray(row.to_godown) ? row.to_godown[0] : row.to_godown

    return {
      id: row.id,
      product_id: row.product_id,
      product_name: product?.name ?? 'Unknown',
      product_unit: product?.unit ?? '',
      from_godown_id: row.from_godown_id,
      from_godown_name: fromGodown?.name ?? 'Unknown',
      to_godown_id: row.to_godown_id,
      to_godown_name: toGodown?.name ?? 'Unknown',
      qty: row.qty,
      status: row.status,
      requested_by: row.requested_by,
      requester_display: nameMap.get(row.requested_by) ?? row.requested_by.slice(0, 8),
      approved_by: row.approved_by,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  })

  return { data: result }
}

// ─────────────────────────────────────────────────────────────────────────────
// createTransfer
// Inserts a pending stock_transfers row, then calls reserve_transfer_qty RPC
// to atomically increment inventory.reserved_qty.
// On RPC failure: compensating delete removes the inserted row before returning error.
// T-06-25: ghost stock prevention; T-06-29: race via FOR UPDATE in RPC.
// T-06-30: qty > 0 enforced by schema; from !== to by DB constraint.
// ─────────────────────────────────────────────────────────────────────────────
export async function createTransfer(
  input: z.infer<typeof CreateTransferSchema>
): Promise<{ error: string } | never> {
  const parsed = CreateTransferSchema.safeParse(input)
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

  // Step 1: Insert transfer row with status='pending'
  const { data: newTransfer, error: insertError } = await supabase
    .from('stock_transfers')
    .insert({
      company_id: companyId,
      product_id: parsed.data.product_id,
      from_godown_id: parsed.data.from_godown_id,
      to_godown_id: parsed.data.to_godown_id,
      qty: parsed.data.qty,
      status: 'pending',
      requested_by: user.id,
      notes: parsed.data.notes ?? null,
    })
    .select('id')
    .single()

  if (insertError || !newTransfer) {
    return { error: insertError?.message ?? 'Failed to create transfer' }
  }

  // Step 2: Atomically reserve stock via SECURITY DEFINER RPC
  // RPC takes FOR UPDATE lock on inventory row — prevents race (T-06-29)
  const { error: rpcError } = await supabase.rpc('reserve_transfer_qty', {
    p_transfer_id: newTransfer.id,
    p_company_id: companyId,
    p_product_id: parsed.data.product_id,
    p_from_godown_id: parsed.data.from_godown_id,
    p_qty: parsed.data.qty,
  })

  if (rpcError) {
    // Compensating delete — remove the just-inserted transfer row
    await supabase.from('stock_transfers').delete().eq('id', newTransfer.id)

    // Map known RPC error messages to user-friendly strings
    const msg = rpcError.message ?? ''
    if (msg.includes('Insufficient available stock')) {
      return {
        error:
          'Not enough available stock in source godown. (Other pending transfers may have reserved it.)',
      }
    }
    if (msg.includes('No inventory record found')) {
      return { error: 'No stock record found for this product in the selected godown.' }
    }
    if (msg.includes('Company mismatch')) {
      return { error: 'This transfer belongs to another company.' }
    }
    return { error: `Reservation failed: ${msg}` }
  }

  // Success: bust low-stock nav badge cache
  revalidateLowStockTag(companyId)
  revalidatePath('/inventory')

  redirect('/inventory/transfers?tab=pending&created=1')
}

// ─────────────────────────────────────────────────────────────────────────────
// approveTransfer
// Thin wrapper around approve_transfer() SECURITY DEFINER RPC.
// ALL atomic logic (FOR UPDATE lock, self-approval check, company check,
// godown active check, stock re-check) is inside the RPC — not here.
// T-06-26: self-approval; T-06-27: race; T-06-28: stale stock; T-06-32: inactive godown.
// T-06-33: cross-company.
// ─────────────────────────────────────────────────────────────────────────────
export async function approveTransfer(
  transferId: string
): Promise<{ success: true } | { error: string }> {
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

  // Delegate entirely to RPC — do NOT implement any logic here
  const { error } = await supabase.rpc('approve_transfer', {
    p_transfer_id: transferId,
    p_company_id: companyId,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('Cannot approve your own')) {
      return { error: 'You cannot approve your own transfer request.' }
    }
    if (msg.includes('Insufficient') || msg.includes('Reserved qty')) {
      return { error: 'Insufficient stock in source godown. Transfer rejected.' }
    }
    if (msg.includes('Company mismatch')) {
      return { error: 'This transfer belongs to another company.' }
    }
    if (msg.includes('Source godown is inactive')) {
      return { error: 'Source godown is no longer active. Reactivate or reject this transfer.' }
    }
    if (msg.includes('Destination godown is inactive')) {
      return {
        error: 'Destination godown is no longer active. Reactivate or reject this transfer.',
      }
    }
    if (msg.includes('Transfer not found') || msg.includes('not in pending status')) {
      return { error: 'Transfer is no longer pending. Refresh to see the latest status.' }
    }
    return { error: msg }
  }

  revalidateLowStockTag(companyId)
  revalidatePath('/inventory/transfers')
  revalidatePath('/inventory')

  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// rejectTransfer
// Thin wrapper around reject_transfer() SECURITY DEFINER RPC.
// RPC releases reserved_qty atomically.
// ─────────────────────────────────────────────────────────────────────────────
export async function rejectTransfer(
  transferId: string
): Promise<{ success: true } | { error: string }> {
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

  const { error } = await supabase.rpc('reject_transfer', {
    p_transfer_id: transferId,
    p_company_id: companyId,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('Company mismatch')) {
      return { error: 'This transfer belongs to another company.' }
    }
    if (msg.includes('Transfer not found') || msg.includes('not in pending status')) {
      return { error: 'Transfer is no longer pending. Refresh to see the latest status.' }
    }
    return { error: msg }
  }

  revalidateLowStockTag(companyId)
  revalidatePath('/inventory/transfers')
  revalidatePath('/inventory')

  return { success: true }
}
