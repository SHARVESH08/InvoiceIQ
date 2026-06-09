'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

// ──────────────────────────────────────────────────────────────────────────
// Register schema: email REQUIRED (Phase 2 constraint — login is email+password
// only; phone-only accounts cannot log in). Phone is optional — stored in
// customer_profiles for Phase 4+ Model B RLS matching.
// Note: the deployed customer_profiles table has no full_name column.
// We store fullName in user_metadata only.
// ──────────────────────────────────────────────────────────────────────────
const RegisterSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9 \-()]{6,20}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type RegisterCustomerInput = z.infer<typeof RegisterSchema>

export async function registerCustomer(
  input: RegisterCustomerInput
): Promise<{ error: string } | never> {
  const parsed = RegisterSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const data = parsed.data

  const phone = data.phone?.trim() || null
  const email = data.email.trim()

  const supabase = await createClient()

  // Supabase Auth signUp with email+password.
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: data.password,
    options: {
      data: {
        user_type: 'customer',
        full_name: data.fullName,
      },
    },
  })

  if (signUpError) return { error: signUpError.message }
  const userId = authData.user?.id
  if (!userId) return { error: 'Registration failed (no user id returned)' }

  // When email confirmation is disabled, signUp with an existing email returns
  // the existing user with identities: [] (empty array). Must use Array.isArray
  // guard — Supabase may return identities: null for new users, which the
  // nullish-coalescing ?? [] fallback would incorrectly treat as "already exists".
  if (Array.isArray(authData.user?.identities) && authData.user.identities.length === 0) {
    const existingType = (authData.user.user_metadata as Record<string, unknown> | undefined)?.user_type
    if (existingType === 'business') {
      return { error: 'This email is registered as a business account. Use the business login page.' }
    }
    return { error: 'An account with this email already exists. Please sign in.' }
  }

  // Admin client bypasses permission/RLS checks for the profile bootstrap INSERT.
  // authenticated role has no explicit GRANT on customer_profiles.
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const adminClient = createAdminClient()

  const { error: profileError } = await adminClient
    .from('customer_profiles')
    .insert({
      user_id: userId,
      phone,
      email,
    })

  if (profileError) return { error: profileError.message }

  // D-06: customer → /my
  redirect('/my')
}

// ──────────────────────────────────────────────────────────────────────────
// Login: email+password (Phase 2).
// ──────────────────────────────────────────────────────────────────────────
const LoginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginCustomerInput = z.infer<typeof LoginSchema>

export async function loginCustomer(
  input: LoginCustomerInput
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

  // Reject business users attempting to log in via the customer portal.
  const userType =
    (data.user?.app_metadata as Record<string, unknown> | undefined)?.user_type ??
    (data.user?.user_metadata as Record<string, unknown> | undefined)?.user_type
  if (userType === 'business') {
    await supabase.auth.signOut()
    return { error: 'Use the business login page instead' }
  }

  redirect('/my')
}
