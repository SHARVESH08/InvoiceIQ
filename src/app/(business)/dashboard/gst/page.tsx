import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GstPeriodSelector } from './_components/gst-period-selector'

interface CompanyContext {
  company_id: string
  company_type: string
  user_role: string
}

interface CompanyRow {
  gstin: string | null
  name: string
  state_code: string | null
}

interface PeriodRow {
  id: string
  period_type: string
  fy: string
  period: string
  status: string
}

export default async function GstPage() {
  const supabase = await createClient()

  const { data: ctx } = await supabase.rpc('get_company_context')
  if (!ctx) redirect('/login')

  const { company_id } = ctx as CompanyContext

  const [companyResult, periodsResult] = await Promise.all([
    supabase
      .from('companies')
      .select('gstin, name, state_code')
      .eq('id', company_id)
      .single<CompanyRow>(),
    supabase
      .from('gst_period_data')
      .select('id, period_type, fy, period, status')
      .eq('company_id', company_id)
      .order('fy', { ascending: false }),
  ])

  if (process.env.NODE_ENV === 'development') {
    if (companyResult.error) console.error('[gst] companies query failed:', companyResult.error)
    if (periodsResult.error) console.error('[gst] gst_period_data query failed:', periodsResult.error)
  }

  const company = companyResult.data ?? null
  const periods = (periodsResult.data ?? []) as PeriodRow[]

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold leading-tight">GST Assistant</h1>
      <GstPeriodSelector companyId={company_id} periods={periods} company={company} />
    </div>
  )
}
