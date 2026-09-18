'use server'

import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/require-permission'
import { INVITABLE_ROLES } from '@/lib/auth/permissions'

const InviteSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  // Shares one list with the invite form, so the dropdown and the server can't
  // drift. 'admin' is excluded by construction — see INVITABLE_ROLES.
  role: z.enum(INVITABLE_ROLES),
})

export type InviteSubUserInput = z.infer<typeof InviteSchema>

export async function inviteSubUser(
  input: InviteSubUserInput
): Promise<{ error?: string }> {
  const denied = await requirePermission('team:manage')
  if (denied) return denied

  const parsed = InviteSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { email, role } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Derive company_id from DB — NOT from JWT claims or form input (Fix 3).
  const { data: membership, error: membershipError } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single()

  if (membershipError || !membership) return { error: 'Not an admin of any company' }
  const companyId = membership.company_id

  // Check for existing active invitation — prevent duplicates (Fix 4).
  const adminClient = createAdminClient()
  const { data: existingInvite } = await adminClient
    .from('invitations')
    .select('id')
    .eq('company_id', companyId)
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (existingInvite) {
    return { error: 'An active invitation already exists for this email' }
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error: invErr } = await supabase
    .from('invitations')
    .insert({
      email: email.toLowerCase(),
      company_id: companyId,
      role,
      invited_by: user.id,
      expires_at: expiresAt,
    })

  if (invErr) return { error: invErr.message }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: { user_type: 'business' },
      redirectTo: `${siteUrl}/auth/callback`,
    }
  )

  if (inviteErr) return { error: inviteErr.message }

  return {}
}
