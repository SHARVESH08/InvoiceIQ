import { createClient } from '@/lib/supabase/server'
import { CustomersTable } from './_components/customers-table'

interface Props {
  searchParams: Promise<{ page?: string; q?: string }>
}

export default async function CustomersPage(props: Props) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const q = searchParams.q ?? ''
  const pageSize = 25
  const offset = (page - 1) * pageSize

  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (q) query = query.ilike('name', `%${q}%`)

  const { data: customers, count } = await query

  // Outstanding balance — single IN() query (non-N+1 per PATTERNS.md, Pitfall 2)
  // Uses payment_status column NOT status (Pitfall 7, RESEARCH.md)
  // In Phase 3: no invoices exist — returns empty, balanceMap is all zeros
  const balanceMap: Record<string, number> = {}

  if (customers && customers.length > 0) {
    const customerIds = customers.map((c: { id: string }) => c.id)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('customer_id, total_amount')
      .in('customer_id', customerIds)
      .neq('payment_status', 'paid')

    if (invoices) {
      for (const inv of invoices) {
        balanceMap[inv.customer_id] =
          (balanceMap[inv.customer_id] ?? 0) + Number(inv.total_amount)
      }
    }
  }

  return (
    <CustomersTable
      customers={customers ?? []}
      total={count ?? 0}
      page={page}
      balanceMap={balanceMap}
    />
  )
}
