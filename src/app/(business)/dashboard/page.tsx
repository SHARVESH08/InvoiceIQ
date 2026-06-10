import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import dynamic from 'next/dynamic'
import { RealtimeDashboard } from '@/components/realtime-dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const OemDashboard = dynamic(() =>
  import('@/components/dashboard/oem-dashboard').then(m => m.OemDashboard)
)
const DistributorDashboard = dynamic(() =>
  import('@/components/dashboard/distributor-dashboard').then(m => m.DistributorDashboard)
)
const RetailerDashboard = dynamic(() =>
  import('@/components/dashboard/retailer-dashboard').then(m => m.RetailerDashboard)
)

// company_type enum values (exact case from schema)
type CompanyType = 'OEM' | 'Distributor' | 'Retailer'

interface CompanyContext {
  company_id: string
  company_type: CompanyType
  user_role: string
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // ─── Stage 1: company context ─────────────────────────────────────────────
  // get_company_context() is SECURITY DEFINER — returns data scoped to auth.uid()
  // T-07-07: company_type cannot be spoofed — comes from auth-scoped RPC only
  const { data: ctx } = await supabase.rpc('get_company_context')
  if (!ctx) redirect('/login')

  const { company_id, company_type, user_role } = ctx as CompanyContext

  // T-07-06: isAdmin is strictly user_role === 'admin'
  // accountant, salesperson, and ca are ALL treated as non-admin (D-04)
  const isAdmin = user_role === 'admin'

  // ─── Stage 2: parallel widget data ───────────────────────────────────────
  // Fire shared chart RPCs + low-stock count + nightly summary + role-specific queries in parallel
  const [
    { data: revenueTrend, error: trendError },
    { data: topProducts, error: productsError },
    { data: paymentSplit, error: splitError },
    lowStockCount,
    whatsappOrderCount,
    nightlySummaryResult,
    roleData,
  ] = await Promise.all([
    supabase.rpc('get_revenue_trend', { p_months: 12 }),
    supabase.rpc('get_top_products', { p_limit: 5 }),
    supabase.rpc('get_payment_mode_split'),
    supabase
      .from('inventory')
      .select('quantity, products!inner(reorder_level)')
      .eq('company_id', company_id)
      .then(({ data }) => {
        if (!data) return 0
        return (data as unknown as { quantity: number; products: { reorder_level: number } }[]).filter(
          (r) => r.quantity <= r.products.reorder_level
        ).length
      }),
    // WhatsApp invoice-sent session count — Retailer dashboard widget (WA-08)
    supabase
      .from('whatsapp_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company_id)
      .eq('state', 'invoice_sent')
      .then(({ count }) => count ?? 0),
    // Nightly summary — most recent summary for this company (AI-03)
    // T-11-26: RLS-scoped read; company_id in WHERE clause for defense in depth
    supabase
      .from('nightly_summaries')
      .select('summary_text, summary_date')
      .eq('company_id', company_id)
      .order('summary_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchRoleData(supabase, company_type, company_id),
  ])

  // WR-01: log RPC failures in development so they aren't silently masked
  if (process.env.NODE_ENV === 'development') {
    if (trendError) console.error('[dashboard] get_revenue_trend failed:', trendError)
    if (productsError) console.error('[dashboard] get_top_products failed:', productsError)
    if (splitError) console.error('[dashboard] get_payment_mode_split failed:', splitError)
  }

  // Safe defaults on RPC error
  const trendData = revenueTrend ?? []
  const productsData = topProducts ?? []
  const splitData = paymentSplit ?? []

  // Nightly summary — safe default when no row exists yet
  const nightlySummary = nightlySummaryResult.data ?? null

  return (
    <RealtimeDashboard companyId={company_id}>
      {/* Nightly Summary Card — AI-03; shown to all roles */}
      <NightlySummaryCard summary={nightlySummary} />
      {company_type === 'OEM' && (
        <OemDashboard
          isAdmin={isAdmin}
          revenueMtd={(roleData as OemData).revenueMtd ?? 0}
          topDistributors={(roleData as OemData).topDistributors ?? []}
          revenueTrend={trendData}
          topProducts={productsData}
          paymentSplit={splitData}
        />
      )}
      {company_type === 'Distributor' && (
        <DistributorDashboard
          isAdmin={isAdmin}
          godownStock={(roleData as DistributorData).godownStock ?? []}
          retailerOutstanding={(roleData as DistributorData).retailerOutstanding ?? []}
          pendingTransferCount={(roleData as DistributorData).pendingTransferCount ?? 0}
          revenueTrend={trendData}
          topProducts={productsData}
          paymentSplit={splitData}
        />
      )}
      {company_type === 'Retailer' && (
        <RetailerDashboard
          isAdmin={isAdmin}
          todaySales={(roleData as RetailerData).todaySales ?? 0}
          lowStockCount={lowStockCount}
          whatsappOrderCount={whatsappOrderCount}
          revenueTrend={trendData}
          topProducts={productsData}
          paymentSplit={splitData}
        />
      )}
    </RealtimeDashboard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Role-specific data types
// ─────────────────────────────────────────────────────────────────────────────

interface OemData {
  revenueMtd: number
  topDistributors: { name: string; revenue: number }[]
}

interface DistributorData {
  godownStock: { godownName: string; totalQty: number }[]
  retailerOutstanding: { customerName: string; outstanding: number }[]
  pendingTransferCount: number
}

interface RetailerData {
  todaySales: number
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchRoleData — role-branched additional queries
// All queries scoped to company_id (T-07-05: RLS provides second boundary)
// ─────────────────────────────────────────────────────────────────────────────
// WR-02: derive current date/month boundaries in IST (UTC+5:30) rather than server UTC.
// en-CA locale produces YYYY-MM-DD format, which matches invoice_date column format.
function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function mtdStartIST(): string {
  // First day of the current month in IST
  const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const year = istNow.getFullYear()
  const month = String(istNow.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

// WR-04: typed Supabase client — avoids suppressing type-checks on every DB call
async function fetchRoleData(
  supabase: SupabaseClient,
  companyType: CompanyType,
  companyId: string,
): Promise<OemData | DistributorData | RetailerData> {
  if (companyType === 'OEM') {
    const [revenueMtdResult, topDistributorsResult] = await Promise.all([
      // Revenue MTD: SUM(total_amount) for current month, paid/partial only
      supabase
        .from('invoices')
        .select('total_amount')
        .eq('company_id', companyId)
        .in('payment_status', ['partial', 'paid'])
        .gte('invoice_date', mtdStartIST()),
      // Top distributors: group by customer_name, sum revenue DESC LIMIT 5
      // Approximation for Phase 7 — actual distributor link in Phase 12
      supabase
        .from('invoices')
        .select('customer_name, total_amount')
        .eq('company_id', companyId)
        .in('payment_status', ['partial', 'paid'])
        .order('total_amount', { ascending: false })
        .limit(50), // fetch more, aggregate client-side
    ])

    const revenueMtd = (revenueMtdResult.data ?? []).reduce(
      (sum: number, row: { total_amount: number }) => sum + Number(row.total_amount),
      0,
    )

    // Aggregate top distributors by customer_name
    // CR-01: only iterate topDistributorsResult — revenueMtdResult loop was wrong (double-count)
    const distMap = new Map<string, number>()
    for (const row of topDistributorsResult.data ?? []) {
      distMap.set(row.customer_name, (distMap.get(row.customer_name) ?? 0) + Number(row.total_amount))
    }
    const topDistributors = Array.from(distMap.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    return { revenueMtd, topDistributors }
  }

  if (companyType === 'Distributor') {
    const [godownStockResult, outstandingResult, pendingResult] = await Promise.all([
      // Godown stock: inventory JOIN godowns — sum qty per godown
      supabase
        .from('inventory')
        .select('quantity_on_hand, godowns(name)')
        .eq('company_id', companyId),
      // Retailer outstanding: invoices WHERE payment_status != 'paid'
      supabase
        .from('invoices')
        .select('customer_name, total_amount')
        .eq('company_id', companyId)
        .neq('payment_status', 'paid'),
      // Pending transfers count
      supabase
        .from('stock_transfers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'pending'),
    ])

    // Aggregate godown stock by godown name
    const godownMap = new Map<string, number>()
    for (const row of godownStockResult.data ?? []) {
      const godownName =
        Array.isArray(row.godowns)
          ? row.godowns[0]?.name ?? 'Unknown'
          : (row.godowns as { name?: string } | null)?.name ?? 'Unknown'
      godownMap.set(godownName, (godownMap.get(godownName) ?? 0) + Number(row.quantity_on_hand))
    }
    const godownStock = Array.from(godownMap.entries()).map(([godownName, totalQty]) => ({
      godownName,
      totalQty,
    }))

    // Aggregate outstanding by customer
    const outMap = new Map<string, number>()
    for (const row of outstandingResult.data ?? []) {
      outMap.set(row.customer_name, (outMap.get(row.customer_name) ?? 0) + Number(row.total_amount))
    }
    const retailerOutstanding = Array.from(outMap.entries())
      .map(([customerName, outstanding]) => ({ customerName, outstanding }))
      .sort((a, b) => b.outstanding - a.outstanding)

    const pendingTransferCount = pendingResult.count ?? 0

    return { godownStock, retailerOutstanding, pendingTransferCount }
  }

  // Retailer
  const todaySalesResult = await supabase
    .from('invoices')
    .select('total_amount')
    .eq('company_id', companyId)
    .in('payment_status', ['partial', 'paid'])
    .eq('invoice_date', todayIST())

  const todaySales = (todaySalesResult.data ?? []).reduce(
    (sum: number, row: { total_amount: number }) => sum + Number(row.total_amount),
    0,
  )

  return { todaySales }
}

// ─────────────────────────────────────────────────────────────────────────────
// NightlySummaryCard — server component (no interactivity needed)
// AI-03: shows the latest nightly_summaries row for the company.
// T-11-26: data scoped by RLS + explicit company_id in parent query.
// ─────────────────────────────────────────────────────────────────────────────
function NightlySummaryCard({
  summary,
}: {
  summary: { summary_text: string; summary_date: string } | null
}) {
  const JUNK_PHRASES = ['summary unavailable', 'no summary yet', 'check back', 'is this the']
  const isValidSummary =
    summary &&
    summary.summary_text.length >= 30 &&
    !JUNK_PHRASES.some((p) => summary.summary_text.toLowerCase().includes(p))

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Today&apos;s Business Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {isValidSummary ? (
          <>
            <p className="text-sm text-foreground whitespace-pre-line">{summary!.summary_text}</p>
            {summary!.summary_date && (
              <p className="mt-2 text-xs text-muted-foreground">
                Generated for {summary!.summary_date}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No summary yet — check back after tonight&apos;s nightly run.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
