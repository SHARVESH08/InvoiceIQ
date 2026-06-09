import { createClient } from '@/lib/supabase/server'
import { SuppliersTable } from './_components/suppliers-table'

interface Props {
  searchParams: { page?: string; q?: string }
}

export default async function SuppliersPage({ searchParams }: Props) {
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const q = searchParams.q ?? ''
  const pageSize = 25
  const offset = (page - 1) * pageSize

  const supabase = await createClient()

  let query = supabase
    .from('suppliers')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (q) query = query.ilike('name', `%${q}%`)

  const { data: suppliers, count } = await query

  return (
    <SuppliersTable
      suppliers={suppliers ?? []}
      total={count ?? 0}
      page={page}
    />
  )
}
