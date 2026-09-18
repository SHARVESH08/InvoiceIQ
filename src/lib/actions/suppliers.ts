'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { SupplierSchema } from '@/lib/schemas/supplier'
import { requirePermission } from '@/lib/auth/require-permission'

// ─────────────────────────────────────────────────────────────────────────────
// createSupplier
// Validates input, assembles address jsonb from flat form fields,
// resolves company_id server-side via company_users join, inserts the
// supplier row, and redirects.
// company_id is NEVER accepted from the client — explicit join enforces it.
// T-03-13 mitigated: company_id resolved via company_users join.
// T-03-15 mitigated: address jsonb assembled from Zod-validated flat fields.
// ─────────────────────────────────────────────────────────────────────────────
export async function createSupplier(
  input: z.infer<typeof SupplierSchema>
): Promise<{ error: string } | never> {
  const denied = await requirePermission('suppliers:write')
  if (denied) return denied

  const parsed = SupplierSchema.safeParse(input)
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

  // Assemble address jsonb from flat form fields (Pitfall 8 — address is jsonb column)
  const address = {
    street: parsed.data.street ?? '',
    city: parsed.data.city ?? '',
    pincode: parsed.data.pincode ?? '',
  }

  const { error: insertError } = await supabase.from('suppliers').insert({
    name: parsed.data.name,
    gstin: parsed.data.gstin || null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    state_code: parsed.data.state_code || null,
    address,
    company_id: companyId,
  })

  if (insertError) return { error: insertError.message }

  redirect('/suppliers?created=1')
}

// ─────────────────────────────────────────────────────────────────────────────
// updateSupplier
// Re-assembles address jsonb from flat fields.
// RLS scopes the update to the current company's rows automatically.
// ─────────────────────────────────────────────────────────────────────────────
export async function updateSupplier(
  id: string,
  input: z.infer<typeof SupplierSchema>
): Promise<{ error: string } | never> {
  const denied = await requirePermission('suppliers:write')
  if (denied) return denied

  const parsed = SupplierSchema.safeParse(input)
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

  // Re-assemble address jsonb from flat form fields
  const address = {
    street: parsed.data.street ?? '',
    city: parsed.data.city ?? '',
    pincode: parsed.data.pincode ?? '',
  }

  const { error: updateError } = await supabase
    .from('suppliers')
    .update({
      name: parsed.data.name,
      gstin: parsed.data.gstin || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      state_code: parsed.data.state_code || null,
      address,
    })
    .eq('id', id)

  if (updateError) return { error: updateError.message }

  redirect('/suppliers?updated=1')
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteSupplier
// RLS DELETE policy scopes delete to current company — cross-company delete
// silently no-ops (T-03-16 mitigated).
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteSupplier(
  id: string
): Promise<{ error: string } | { success: true }> {
  const denied = await requirePermission('suppliers:write')
  if (denied) return denied

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { error: deleteError } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id)

  if (deleteError) return { error: deleteError.message }

  return { success: true }
}
