import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getCachedLowStockCount } from '@/lib/cache/low-stock'
import { getFranchiseGroupId, getMyMemberships, type Membership } from '@/lib/actions/franchise'
import { MobileHeader } from '@/components/mobile-header'
import { ResumeBanner } from '@/components/resume-banner'
import { Sidebar } from '@/components/sidebar'
import { PageTransition } from '@/components/motion/page-transition'
import { AssistantBubble } from '@/components/chat/assistant-bubble'
import { getCurrentRole } from '@/lib/auth/require-permission'
import type { Role } from '@/lib/auth/permissions'
import { getUnreadNotificationCount } from '@/lib/actions/notifications'

// ─────────────────────────────────────────────────────────────────────────────
// BusinessLayout
// Fetches the low-stock badge count once per page load (server-side, cached).
// The count is wrapped in unstable_cache (in getCachedLowStockCount) so it does
// NOT make a DB round-trip on every page — it is cached until:
//   (a) 60 seconds elapse, OR
//   (b) revalidateLowStockTag(companyId) is called by a mutation
//       (setStockLevel / approveTransfer / rejectTransfer / createTransfer).
// T-06-18: tag is company-scoped (low-stock-${companyId}) — no cross-tenant leak.
//
// poPendingCount: count of incoming POs with status='sent' for Distributor badge.
// Only fetched when companyType === 'Distributor' to avoid unnecessary queries.
// ─────────────────────────────────────────────────────────────────────────────

export default async function BusinessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Resolve company_id for the cached low-stock count + companyType for nav guard (WA-08)
  let lowStockCount = 0
  let companyType: string | null = null
  let poPendingCount = 0
  let onboardingStep = 0
  let onboardingCompleted = true // default true = no banner shown on error
  let isFranchiseOwner = false
  let memberships: Membership[] = []
  // null (not undefined) on failure: undefined tells getNavItems "don't filter",
  // which would hand a broken lookup the full nav. null hides permissioned items.
  let role: Role | null = null
  let unreadNotifications = 0
  try {
    role = await getCurrentRole()
  } catch {
    role = null
  }
  try {
    // Server-rendered per navigation, like the low-stock badge. A failure here
    // must never break the shell — the bell just shows no count.
    unreadNotifications = await getUnreadNotificationCount()
  } catch {
    unreadNotifications = 0
  }
  try {
    // Franchise context: HQ nav gate + company switcher. Failure never breaks the shell.
    const [groupId, membershipRows] = await Promise.all([
      getFranchiseGroupId().catch(() => null),
      getMyMemberships().catch(() => [] as Membership[]),
    ])
    isFranchiseOwner = groupId !== null
    memberships = membershipRows
  } catch {
    isFranchiseOwner = false
    memberships = []
  }
  try {
    const [{ data: companyId }, { data: companyCtx }] = await Promise.all([
      supabase.rpc('get_company_id'),
      supabase.rpc('get_company_context'),
    ])
    // Set companyType first — must not be wiped by later fallible operations
    if (companyCtx) {
      companyType = (companyCtx as { company_type?: string }).company_type ?? null
    }
    if (companyId) {
      // getCachedLowStockCount uses unstable_cache which may throw on cold cache
      // (cookies() unavailable in cache context) — isolate so companyType is unaffected
      try {
        lowStockCount = await getCachedLowStockCount(companyId)
      } catch {
        lowStockCount = 0
      }
    }
    // Fetch poPendingCount for Distributor badge (incoming POs with status='sent')
    if (companyType === 'Distributor' && companyId) {
      try {
        const { count } = await supabase
          .from('purchase_orders')
          .select('id', { count: 'exact', head: true })
          .eq('distributor_company_id', companyId)
          .eq('status', 'sent')
        poPendingCount = count ?? 0
      } catch {
        poPendingCount = 0
      }
    }
    // Fetch onboarding state (T-13-06: wrapped in try/catch — failure never breaks page)
    if (companyId) {
      try {
        const { data: ob } = await supabase
          .from('companies')
          .select('onboarding_step, onboarding_completed')
          .eq('id', companyId)
          .single()
        if (ob) {
          onboardingStep = ob.onboarding_step ?? 0
          onboardingCompleted = ob.onboarding_completed ?? false
        }
      } catch {
        onboardingCompleted = true // fail-safe: don't show banner on error
      }
    }
  } catch {
    // If RPCs fail (user not in company_users), default to 0/null — do not throw
    lowStockCount = 0
    companyType = null
    poPendingCount = 0
  }

  const cookieStore = await cookies()
  const defaultCollapsed = cookieStore.get('sidebar_collapsed')?.value === '1'

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userEmail={user?.email ?? ''}
        companyType={companyType}
        lowStockCount={lowStockCount}
        poPendingCount={poPendingCount}
        isFranchiseOwner={isFranchiseOwner}
        memberships={memberships}
        defaultCollapsed={defaultCollapsed}
        role={role}
        unreadNotifications={unreadNotifications}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader
          lowStockCount={lowStockCount}
          companyType={companyType}
          poPendingCount={poPendingCount}
          isFranchiseOwner={isFranchiseOwner}
          role={role}
          unreadNotifications={unreadNotifications}
        />
        <main className="flex-1 p-6">
          {!onboardingCompleted && <ResumeBanner step={onboardingStep} />}
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      {/* Reachable from every business page; hides itself on /dashboard/chat. */}
      <AssistantBubble />
    </div>
  )
}
