import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(
      new URL('/auth/business/login?error=missing_code', request.url)
    )
  }

  // Exchange the auth code for a session (user-scoped so cookies are written).
  const supabase = await createClient()
  const { data: exchange, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !exchange?.user) {
    return NextResponse.redirect(
      new URL('/auth/business/login?error=auth_failed', request.url)
    )
  }

  const user = exchange.user

  // Read pending invitations via ADMIN client (Risk 5).
  // User is not yet in company_users — user-scoped SELECT returns 0 rows.
  const adminClient = createAdminClient()

  const { data: invitation } = await adminClient
    .from('invitations')
    .select('id, company_id, role, invited_by, expires_at, accepted_at, email')
    .eq('email', (user.email ?? '').toLowerCase())
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (invitation) {
    // Case-insensitive email match (Fix 2 — suspenders on top of eq filter).
    if (invitation.email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
      return NextResponse.redirect(
        new URL('/auth/callback/error?reason=invalid_invitation', request.url)
      )
    }

    // Insert membership row via admin client (user has no company_users row yet).
    const { error: insertError } = await adminClient
      .from('company_users')
      .insert({
        company_id: invitation.company_id,
        user_id: user.id,
        role: invitation.role,
        invited_by: invitation.invited_by,
      })

    if (insertError) {
      return NextResponse.redirect(
        new URL('/auth/callback/error?reason=invalid_invitation', request.url)
      )
    }

    // Stamp accepted_at to prevent replay (Fix 2).
    await adminClient
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // No invitation — direct signup. Route by user_type.
  const appMetaType = (user.app_metadata as Record<string, unknown> | undefined)?.user_type
  const userMetaType = (user.user_metadata as Record<string, unknown> | undefined)?.user_type
  const userType = (appMetaType ?? userMetaType) as 'business' | 'customer' | undefined

  if (userType === 'customer') {
    return NextResponse.redirect(new URL('/my', request.url))
  }
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
