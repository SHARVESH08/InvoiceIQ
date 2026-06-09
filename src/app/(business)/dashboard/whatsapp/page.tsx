import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BotSetupCard } from './_components/bot-setup-card'
import { WhatsAppRealtimeLog } from './_components/whatsapp-realtime-log'

// company_type enum values (exact case from schema)
type CompanyType = 'OEM' | 'Distributor' | 'Retailer'

interface CompanyContext {
  company_id: string
  company_type: CompanyType
  user_role: string
}

interface CompanyRow {
  bot_code: string | null
  phone: string | null
  name: string
}

interface SessionRow {
  id: string
  customer_phone: string
  state: string
  cart: unknown
  expires_at: string | null
  created_at: string
  company_id: string
}

export default async function WhatsAppPage() {
  const supabase = await createClient()

  // ─── Stage 1: company context ─────────────────────────────────────────────
  // get_company_context() is SECURITY DEFINER — returns data scoped to auth.uid()
  const { data: ctx } = await supabase.rpc('get_company_context')
  if (!ctx) redirect('/login')

  const { company_id, company_type } = ctx as CompanyContext

  // T-9-04: Retailer-only page — non-Retailer roles redirected server-side
  if (company_type !== 'Retailer') redirect('/dashboard')

  // ─── Stage 2: parallel data fetch ─────────────────────────────────────────
  const [companyResult, sessionsResult] = await Promise.all([
    supabase
      .from('companies')
      .select('bot_code, phone, name')
      .eq('id', company_id)
      .single<CompanyRow>(),
    supabase
      .from('whatsapp_sessions')
      .select('id, customer_phone, state, cart, expires_at, created_at, company_id')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  // WR-01: log query failures in development so they aren't silently masked
  if (process.env.NODE_ENV === 'development') {
    if (companyResult.error) console.error('[whatsapp] companies query failed:', companyResult.error)
    if (sessionsResult.error) console.error('[whatsapp] whatsapp_sessions query failed:', sessionsResult.error)
  }

  // Safe defaults on query error
  const botCode = companyResult.data?.bot_code ?? null
  const phoneNumber = companyResult.data?.phone ?? null
  const companyName = companyResult.data?.name ?? ''
  const sessions = (sessionsResult.data ?? []) as SessionRow[]

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold leading-tight">WhatsApp Bot Setup</h1>
      <BotSetupCard
        botCode={botCode}
        phoneNumber={phoneNumber}
        companyName={companyName}
      />
      <WhatsAppRealtimeLog
        companyId={company_id}
        initialRows={sessions}
      />
    </div>
  )
}
