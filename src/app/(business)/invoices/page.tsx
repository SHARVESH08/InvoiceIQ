import { createClient } from '@/lib/supabase/server'
import { InvoicesTable } from './_components/invoices-table'

interface InvoiceSearchParams {
  page?: string
  q?: string
  status?: string
  from_date?: string
  to_date?: string
}

interface Props {
  searchParams: InvoiceSearchParams
}

export default async function InvoicesPage({ searchParams }: Props) {
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const pageSize = 25
  const offset = (page - 1) * pageSize

  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('get_company_id')

  let query = supabase
    .from('invoices')
    .select(
      'id, invoice_number, invoice_date, due_date, doc_type, status, total_amount, paid_amount, customer_id, supplier_id, customers(name), suppliers(name)',
      { count: 'exact' }
    )
    .eq('company_id', companyId ?? '')
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  const q = searchParams.q ?? ''
  if (q) query = query.ilike('invoice_number', `%${q}%`)

  if (searchParams.status) query = query.eq('status', searchParams.status)

  if (searchParams.from_date)
    query = query.gte('invoice_date', searchParams.from_date)

  if (searchParams.to_date)
    query = query.lte('invoice_date', searchParams.to_date)

  const { data: invoices, count } = await query

  return (
    <InvoicesTable
      invoices={invoices ?? []}
      total={count ?? 0}
      page={page}
      searchParams={searchParams}
    />
  )
}
