import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatRupees } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CustomerInvoiceTable } from './_components/customer-invoice-table'
import { CustomerChartPanel } from './_components/customer-chart-panel'

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function MyInvoicesPage(props: Props) {
  const searchParams = await props.searchParams;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/customer/login')

  const pageSize = 20
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const offset = (page - 1) * pageSize

  const [{ data: invoices, count }, { data: kpis }, { data: spendTrend }, { data: spendByMerchant }] = await Promise.all([
    supabase
      .from('invoices')
      .select(
        'id, public_id, invoice_date, invoice_number, total_amount, payment_status, payment_link_url, companies(name)',
        { count: 'exact' }
      )
      .order('invoice_date', { ascending: false })
      .range(offset, offset + pageSize - 1),
    supabase.rpc('get_customer_kpis'),
    supabase.rpc('get_customer_spend_trend', { p_months: 12 }),
    supabase.rpc('get_customer_spend_by_merchant'),
  ])

  const kpiData = kpis as {
    mtd: number
    ytd: number
    all_time: number
    merchant_count: number
  } | null

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">My Invoices</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Spend This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatRupees(kpiData?.mtd ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Spend This Year
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatRupees(kpiData?.ytd ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatRupees(kpiData?.all_time ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Businesses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {kpiData?.merchant_count ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <CustomerInvoiceTable
        invoices={invoices ?? []}
        total={count ?? 0}
        page={page}
      />

      <Suspense fallback={<div className="h-80 animate-pulse bg-muted rounded-lg" />}>
        <CustomerChartPanel
          spendTrend={spendTrend ?? []}
          spendByMerchant={spendByMerchant ?? []}
        />
      </Suspense>
    </div>
  )
}
