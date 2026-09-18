'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { GSTIN_REGEX } from '@/lib/gstin'
import { requirePermission } from '@/lib/auth/require-permission'

type Result = { success: true } | { error: string }

// ─────────────────────────────────────────────────────────────────────────────
// Types returned by the franchise RPCs (migration 035)
// ─────────────────────────────────────────────────────────────────────────────

export interface FranchiseOverview {
  group_id: string
  group_name: string
  member_count: number
  revenue_mtd: number
  outstanding: number
  invoice_count_mtd: number
  low_stock_count: number
}

export interface ShowroomComparisonRow {
  company_id: string
  name: string
  revenue_mtd: number
  revenue_prev_month: number
  outstanding: number
  invoice_count_mtd: number
  low_stock_count: number
}

export interface FranchiseTrendPoint {
  month: string
  revenue: number
}

export interface FranchiseTopProduct {
  name: string
  revenue: number
}

export interface Membership {
  company_id: string
  company_name: string
  role: string
  is_active: boolean
}

export interface CompanyInvite {
  id: string
  group_name: string
  created_at: string
  expires_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/** Group id when the caller owns a franchise group, else null. */
export async function getFranchiseGroupId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_franchise_group_id')
  return (data as string | null) ?? null
}

export async function getFranchiseOverview(): Promise<FranchiseOverview | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_franchise_overview')
  if (error || !data) return null
  return data as FranchiseOverview
}

export async function getShowroomComparison(): Promise<ShowroomComparisonRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_franchise_showroom_comparison')
  if (error) return []
  return (data ?? []) as ShowroomComparisonRow[]
}

export async function getFranchiseRevenueTrend(months = 6): Promise<FranchiseTrendPoint[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_franchise_revenue_trend', {
    p_months: months,
  })
  if (error) return []
  return (data ?? []) as FranchiseTrendPoint[]
}

export async function getFranchiseTopProducts(limit = 5): Promise<FranchiseTopProduct[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_franchise_top_products', {
    p_limit: limit,
  })
  if (error) return []
  return (data ?? []) as FranchiseTopProduct[]
}

/**
 * All companies the current user belongs to, for the sidebar switcher.
 * Uses the admin client because companies RLS only exposes the ACTIVE company;
 * membership itself is validated against company_users by user id.
 */
export async function getMyMemberships(): Promise<Membership[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: activeCompanyId } = await supabase.rpc('get_company_id')

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('company_users')
    .select('company_id, role, companies(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
  if (error || !data) return []

  return data.map((row) => {
    const company = row.companies as unknown as { name: string } | null
    return {
      company_id: row.company_id as string,
      company_name: company?.name ?? 'Unknown company',
      role: row.role as string,
      is_active: row.company_id === activeCompanyId,
    }
  })
}

/** Pending franchise invites addressed to the caller's company (admin-only view via RLS). */
export async function getCompanyInvites(): Promise<CompanyInvite[]> {
  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) return []

  const { data, error } = await supabase
    .from('franchise_invites')
    .select('id, created_at, expires_at, franchise_groups(name)')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
  if (error || !data) return []

  return data.map((row) => {
    const group = row.franchise_groups as unknown as { name: string } | null
    return {
      id: row.id as string,
      group_name: group?.name ?? 'Franchise group',
      created_at: row.created_at as string,
      expires_at: row.expires_at as string,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

const GroupNameSchema = z.string().trim().min(2, 'Name too short').max(80, 'Name too long')

export async function createFranchiseGroup(name: string): Promise<Result> {
  const denied = await requirePermission('franchise:manage')
  if (denied) return denied

  const parsed = GroupNameSchema.safeParse(name)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid name' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_franchise_group', { p_name: parsed.data })
  if (error) return { error: error.message }
  revalidatePath('/hq')
  revalidatePath('/hq/showrooms')
  return { success: true }
}

export async function findCompanyByGstin(
  gstin: string
): Promise<{ company_id: string; name: string; already_in_group: boolean } | { error: string }> {
  const normalized = gstin.trim().toUpperCase()
  if (!GSTIN_REGEX.test(normalized)) return { error: 'Invalid GSTIN format' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('find_company_for_franchise', {
    p_gstin: normalized,
  })
  if (error) return { error: error.message }
  const row = (data as { company_id: string; name: string; already_in_group: boolean }[])?.[0]
  if (!row) return { error: 'No company registered with this GSTIN' }
  return row
}

export async function inviteCompanyToFranchise(
  groupId: string,
  companyId: string
): Promise<Result> {
  const denied = await requirePermission('franchise:manage')
  if (denied) return denied

  const supabase = await createClient()
  const { error } = await supabase.rpc('invite_company_to_franchise', {
    p_group_id: groupId,
    p_company_id: companyId,
  })
  if (error) return { error: error.message }
  revalidatePath('/hq/showrooms')
  return { success: true }
}

export async function respondToFranchiseInvite(
  inviteId: string,
  accept: boolean
): Promise<Result> {
  const denied = await requirePermission('franchise:manage')
  if (denied) return denied

  const supabase = await createClient()
  const { error } = await supabase.rpc('respond_franchise_invite', {
    p_invite_id: inviteId,
    p_accept: accept,
  })
  if (error) return { error: error.message }
  revalidatePath('/settings/franchise')
  return { success: true }
}

/**
 * Company switcher. Validates the caller's membership, then persists the
 * preference to app_metadata; the auth hook re-validates it on the next token
 * refresh (defense in depth) before pinning company_id into the JWT.
 * The client must call supabase.auth.refreshSession() afterwards.
 */
export async function switchActiveCompany(companyId: string): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('company_users')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!membership) return { error: 'You are not a member of that company' }

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { active_company_id: companyId },
  })
  if (error) return { error: 'Failed to switch company' }
  return { success: true }
}
