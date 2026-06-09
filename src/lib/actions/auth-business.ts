'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import {
  GSTIN_REGEX,
  validateGstin,
  validateGstinChecksum,
} from '@/lib/gstin'

// ──────────────────────────────────────────────────────────────────────────
// Server-side schema (re-validates the same logic as the client — D-02).
// ──────────────────────────────────────────────────────────────────────────
const RegisterSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  gstin: z
    .string()
    .regex(GSTIN_REGEX, 'Invalid GSTIN format')
    .refine(validateGstinChecksum, 'GSTIN checksum is invalid'),
  companyType: z.enum(['OEM', 'Distributor', 'Retailer']),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type RegisterBusinessInput = z.infer<typeof RegisterSchema>

export async function registerBusiness(
  input: RegisterBusinessInput
): Promise<{ error: string } | never> {
  // D-02: server-side schema check (cannot be bypassed by tampered client)
  const parsed = RegisterSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const data = parsed.data

  // D-02 + D-04: re-validate GSTIN AND extract state code from prefix
  const gstinResult = validateGstin(data.gstin)
  if (!gstinResult.valid || !gstinResult.state_code) {
    return { error: 'Invalid GSTIN' }
  }

  const supabase = await createClient()

  // ── GSTIN uniqueness pre-flight ──────────────────────────────────────────
  // Check BEFORE auth.signUp so we don't waste an Auth user slot on a
  // duplicate GSTIN that will fail the DB unique constraint anyway.
  const { data: existingCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('gstin', data.gstin.toUpperCase())
    .maybeSingle()

  if (existingCompany) {
    return { error: 'A company with this GSTIN is already registered' }
  }
  // ────────────────────────────────────────────────────────────────────────

  // 1. Auth signUp — store user_type in user_metadata for middleware fallback
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: { user_type: 'business' },
    },
  })

  if (signUpError) return { error: signUpError.message }
  const userId = authData.user?.id
  if (!userId) return { error: 'Registration failed (no user id returned)' }

  // Admin client bypasses RLS for the bootstrap inserts. At registration time,
  // get_company_id() returns NULL (no company_users row yet) so the user-client
  // would be blocked by the companies/company_users RLS WITH CHECK policies.
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const adminClient = createAdminClient()

  // 2. Insert company. Risk 8: column is `state_code` NOT `billing_state`.
  const { data: company, error: companyError } = await adminClient
    .from('companies')
    .insert({
      name: data.companyName,
      gstin: data.gstin.toUpperCase(),
      company_type: data.companyType,
      state_code: gstinResult.state_code, // D-04
    })
    .select('id')
    .single()

  // ── Orphaned-user cleanup ────────────────────────────────────────────────
  if (companyError) {
    await adminClient.auth.admin.deleteUser(userId)
    return { error: companyError.message }
  }

  // 3. Insert into company_users as admin. Risk 7: role must be lowercase.
  const { error: memberError } = await adminClient
    .from('company_users')
    .insert({
      company_id: company.id,
      user_id: userId,
      role: 'admin',
    })

  if (memberError) {
    await adminClient.auth.admin.deleteUser(userId)
    return { error: memberError.message }
  }

  // D-06: business → /dashboard. redirect() throws internally; place at end.
  redirect('/dashboard')
}

// ──────────────────────────────────────────────────────────────────────────
// Login
// ──────────────────────────────────────────────────────────────────────────
const LoginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginBusinessInput = z.infer<typeof LoginSchema>

export async function loginBusiness(
  input: LoginBusinessInput
): Promise<{ error: string } | never> {
  const parsed = LoginSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) return { error: 'Incorrect email or password' }

  // Reject customer accounts attempting to log in via the business portal.
  const userType =
    (data.user?.app_metadata as Record<string, unknown> | undefined)?.user_type ??
    (data.user?.user_metadata as Record<string, unknown> | undefined)?.user_type
  if (userType === 'customer') {
    await supabase.auth.signOut()
    return { error: 'Use the customer login page instead' }
  }

  redirect('/dashboard')
}
