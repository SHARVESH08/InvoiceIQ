'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { CustomerSchema, gstinForCustomerType } from '@/lib/schemas/customer'
import { requirePermission } from '@/lib/auth/require-permission'

// ─────────────────────────────────────────────────────────────────────────────
// createCustomer
// Validates input, auto-links customer_profile_id on phone/email match,
// assembles billing_address jsonb, resolves company_id server-side via
// company_users join, inserts the customer row, and redirects.
// company_id is NEVER accepted from the client — explicit join enforces it.
// ─────────────────────────────────────────────────────────────────────────────
export async function createCustomer(
  input: z.infer<typeof CustomerSchema>
): Promise<{ error: string } | never> {
  const denied = await requirePermission('customers:write')
  if (denied) return denied

  const parsed = CustomerSchema.safeParse(input)
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

  // Auto-link customer_profile_id if phone or email matches a customer_profile row
  // Only run lookup when at least one identifier is present (CUSTOMERS-02)
  let customerProfileId: string | null = null
  const phone = parsed.data.phone || ''
  const email = parsed.data.email || ''

  if (phone || email) {
    const orFilter = [
      phone ? `phone.eq.${phone}` : null,
      email ? `email.eq.${email}` : null,
    ]
      .filter(Boolean)
      .join(',')

    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('id')
      .or(orFilter)
      .limit(1)
      .maybeSingle()

    customerProfileId = profile?.id ?? null
  }

  // Assemble billing_address jsonb from flat form fields (Pitfall 8)
  const billingAddress = {
    street: parsed.data.billing_street ?? '',
    city: parsed.data.billing_city ?? '',
    pincode: parsed.data.billing_pincode ?? '',
  }

  const { error: insertError } = await supabase.from('customers').insert({
    name: parsed.data.name,
    customer_type: parsed.data.customer_type,
    gstin: gstinForCustomerType(parsed.data.customer_type, parsed.data.gstin),
    phone: phone || null,
    email: email || null,
    state_code: parsed.data.state_code || null,
    credit_limit: parsed.data.credit_limit,
    billing_address: billingAddress,
    customer_profile_id: customerProfileId,
    company_id: companyId,
  })

  if (insertError) return { error: insertError.message }

  redirect('/customers?created=1')
}

// ─────────────────────────────────────────────────────────────────────────────
// quickCreateCustomer
// Same insert logic as createCustomer but RETURNS the created row instead of
// redirecting — used by the inline "Add customer" dialog inside the invoice form,
// so the in-progress invoice is not lost. Returns the fields the invoice form
// needs (id, name, gstin, state_code) for live tax-type computation.
// ─────────────────────────────────────────────────────────────────────────────
export async function quickCreateCustomer(
  input: z.infer<typeof CustomerSchema>
): Promise<
  | { error: string }
  | { customer: { id: string; name: string; gstin: string | null; state_code: string | null } }
> {
  const denied = await requirePermission('customers:write')
  if (denied) return denied

  const parsed = CustomerSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated' }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) return { error: 'Company membership not found' }

  // Auto-link customer_profile_id on phone/email match (CUSTOMERS-02)
  let customerProfileId: string | null = null
  const phone = parsed.data.phone || ''
  const email = parsed.data.email || ''
  if (phone || email) {
    const orFilter = [
      phone ? `phone.eq.${phone}` : null,
      email ? `email.eq.${email}` : null,
    ]
      .filter(Boolean)
      .join(',')
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('id')
      .or(orFilter)
      .limit(1)
      .maybeSingle()
    customerProfileId = profile?.id ?? null
  }

  const billingAddress = {
    street: parsed.data.billing_street ?? '',
    city: parsed.data.billing_city ?? '',
    pincode: parsed.data.billing_pincode ?? '',
  }

  const { data: inserted, error: insertError } = await supabase
    .from('customers')
    .insert({
      name: parsed.data.name,
      customer_type: parsed.data.customer_type,
      gstin: gstinForCustomerType(parsed.data.customer_type, parsed.data.gstin),
      phone: phone || null,
      email: email || null,
      state_code: parsed.data.state_code || null,
      credit_limit: parsed.data.credit_limit,
      billing_address: billingAddress,
      customer_profile_id: customerProfileId,
      company_id: companyId,
    })
    .select('id, name, gstin, state_code')
    .single()

  if (insertError || !inserted) {
    return { error: insertError?.message ?? 'Failed to create customer' }
  }

  // Refresh the customers list page so the new customer shows there too
  revalidatePath('/customers')

  return {
    customer: inserted as {
      id: string
      name: string
      gstin: string | null
      state_code: string | null
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateCustomer
// Re-runs customer_profile lookup (phone/email may have changed).
// Re-assembles billing_address jsonb from flat fields.
// RLS scopes the update to the current company's rows automatically.
// ─────────────────────────────────────────────────────────────────────────────
export async function updateCustomer(
  id: string,
  input: z.infer<typeof CustomerSchema>
): Promise<{ error: string } | never> {
  const denied = await requirePermission('customers:write')
  if (denied) return denied

  const parsed = CustomerSchema.safeParse(input)
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

  // Re-run customer_profile lookup — phone/email may have changed
  let customerProfileId: string | null = null
  const phone = parsed.data.phone || ''
  const email = parsed.data.email || ''

  if (phone || email) {
    const orFilter = [
      phone ? `phone.eq.${phone}` : null,
      email ? `email.eq.${email}` : null,
    ]
      .filter(Boolean)
      .join(',')

    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('id')
      .or(orFilter)
      .limit(1)
      .maybeSingle()

    customerProfileId = profile?.id ?? null
  }

  // Re-assemble billing_address jsonb from flat form fields
  const billingAddress = {
    street: parsed.data.billing_street ?? '',
    city: parsed.data.billing_city ?? '',
    pincode: parsed.data.billing_pincode ?? '',
  }

  const { error: updateError } = await supabase
    .from('customers')
    .update({
      name: parsed.data.name,
      customer_type: parsed.data.customer_type,
      gstin: gstinForCustomerType(parsed.data.customer_type, parsed.data.gstin),
      phone: phone || null,
      email: email || null,
      state_code: parsed.data.state_code || null,
      credit_limit: parsed.data.credit_limit,
      billing_address: billingAddress,
      customer_profile_id: customerProfileId,
    })
    .eq('id', id)

  if (updateError) return { error: updateError.message }

  redirect('/customers?updated=1')
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteCustomer
// RLS DELETE policy scopes delete to current company — cross-company delete
// silently no-ops (Supabase returns 0 rows affected, no error).
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteCustomer(
  id: string
): Promise<{ error: string } | void> {
  const denied = await requirePermission('customers:write')
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
    .from('customers')
    .delete()
    .eq('id', id)

  if (deleteError) return { error: deleteError.message }

  redirect('/customers?deleted=1')
}
