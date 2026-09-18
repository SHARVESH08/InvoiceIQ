import 'server-only'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { can, isRole, type Permission, type Role } from './permissions'

// ─────────────────────────────────────────────────────────────────────────────
// Server-side permission enforcement.
//
// getCurrentRole() reads the role from the DATABASE (get_company_role RPC),
// not from the JWT. The JWT's company_role claim only refreshes when the token
// does, so a demoted user would keep their old powers for the rest of the token
// lifetime. The RPC costs one round-trip and is correct immediately.
//
// Deliberately NOT wrapped in React's cache(): a request performs at most a
// couple of these (one per action, one for the layout), so memoisation buys
// almost nothing — and cache() has no defined behaviour outside a request
// scope, which would make this untestable and order-dependent.
// ─────────────────────────────────────────────────────────────────────────────

export async function getCurrentRole(): Promise<Role | null> {
  const supabase = await createClient()

  // Defensive reads throughout: this is the gate every mutation sits behind, so
  // an unexpected shape must resolve to "no role" (denied) rather than throw an
  // exception that callers would surface as an opaque server error.
  const auth = await supabase.auth.getUser()
  if (!auth?.data?.user) return null

  const result = await supabase.rpc('get_company_role')
  if (!result || result.error) return null

  return isRole(result.data) ? result.data : null
}

/** Non-throwing check, for branching inside an action. */
export async function hasPermission(permission: Permission): Promise<boolean> {
  return can(await getCurrentRole(), permission)
}

export type PermissionDenied = { error: string }

/**
 * Guard for the top of a server action.
 *
 *   const denied = await requirePermission('invoices:write')
 *   if (denied) return denied
 *
 * Returns an error object on failure (matching the { error } shape every action
 * already returns) and null when the caller is allowed. It does NOT throw:
 * these actions are called from forms that render the returned message.
 */
export async function requirePermission(
  permission: Permission
): Promise<PermissionDenied | null> {
  const role = await getCurrentRole()

  if (role === null) {
    return { error: 'Not authenticated' }
  }
  if (!can(role, permission)) {
    return {
      error: `Your role does not allow this action. Ask an admin for access.`,
    }
  }
  return null
}

/**
 * Guard for a route segment's layout, so a hidden nav entry can't simply be
 * typed into the address bar. Redirects rather than rendering a 403: the user
 * has a valid session, there's just nothing for them at this URL.
 *
 * Call from a server layout.tsx — it covers every nested route in the segment.
 */
export async function requirePagePermission(permission: Permission): Promise<void> {
  const role = await getCurrentRole()

  // '/auth/business/login', not '/login' — the latter is not a route in this
  // app and redirecting there produces a 404 for logged-out visitors.
  if (role === null) redirect('/auth/business/login')
  if (!can(role, permission)) redirect('/dashboard')
}
