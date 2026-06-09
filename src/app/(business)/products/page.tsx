import { createClient } from '@/lib/supabase/server'
import { ProductsTable } from './_components/products-table'

interface Props {
  searchParams: { page?: string; q?: string; category?: string }
}

export default async function ProductsPage({ searchParams }: Props) {
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const q = searchParams.q ?? ''
  const category = searchParams.category ?? ''
  const pageSize = 25
  const offset = (page - 1) * pageSize

  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (q) query = query.ilike('name', `%${q}%`)
  if (category) query = query.eq('category', category)

  const { data: products, count } = await query

  // Fetch distinct categories for the filter dropdown (D-02)
  const { data: cats } = await supabase
    .from('products')
    .select('category')
    .not('category', 'is', null)
    .order('category')

  const categories: string[] = Array.from(
    new Set(
      (cats ?? []).map((r: { category: string | null }) => r.category).filter((c): c is string => Boolean(c))
    )
  )

  return (
    <ProductsTable
      products={products ?? []}
      total={count ?? 0}
      page={page}
      categories={categories}
    />
  )
}
