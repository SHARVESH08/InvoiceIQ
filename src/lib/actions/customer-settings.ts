'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const Schema = z.object({ email_reminders: z.boolean() })

export async function updateEmailReminders(
  input: z.infer<typeof Schema>
): Promise<{ error: string } | { success: true }> {
  const parsed = Schema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('customer_profiles')
    .update({ email_reminders: parsed.data.email_reminders })
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/my/settings')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateCustomerProfile
// The customer's own details, split across two stores:
//   • full_name → auth user_metadata (customer_profiles has no name column)
//   • phone     → customer_profiles (businesses match customers on it)
//
// Email is deliberately NOT editable here. It is both the auth identity and the
// key every invoice-visibility rule matches on (auth.email()), so changing it
// in place would silently detach the customer from their own invoice history.
// ─────────────────────────────────────────────────────────────────────────────

const ProfileSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9 \-()]{6,20}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
})

export type CustomerProfileInput = z.infer<typeof ProfileSchema>

export async function updateCustomerProfile(
  input: CustomerProfileInput
): Promise<{ error: string } | { success: true }> {
  const parsed = ProfileSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const phone = parsed.data.phone?.trim() || null

  const { error: metaError } = await supabase.auth.updateUser({
    data: { full_name: parsed.data.full_name },
  })
  if (metaError) return { error: metaError.message }

  // RLS (own_profile_only) scopes this to the caller's row; the explicit
  // user_id filter keeps it a no-op rather than a broad update if that changes.
  const { error: profileError } = await supabase
    .from('customer_profiles')
    .update({ phone })
    .eq('user_id', user.id)

  if (profileError) return { error: profileError.message }

  revalidatePath('/my/settings')
  revalidatePath('/my')
  return { success: true }
}
