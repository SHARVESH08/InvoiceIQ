import { createClient } from '@/lib/supabase/server'
import { getInventoryAggregated } from '@/lib/actions/inventory'
import { InventoryTable } from './_components/inventory-table'

interface Props {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>
}

export default async function InventoryPage(props: Props) {
  const searchParams = await props.searchParams;
  const filter = searchParams.filter ?? ''
  const result = await getInventoryAggregated(filter)

  const supabase = await createClient()

  // Fetch active godowns and all products for the Set Stock Level dialog
  const { data: godowns } = await supabase
    .from('godowns')
    .select('id, name, is_default')
    .eq('is_active', true)
    .order('name')

  const { data: products } = await supabase
    .from('products')
    .select('id, name, unit')
    .order('name')

  const rows = 'error' in result ? [] : result.data

  return (
    <InventoryTable
      rows={rows}
      godowns={godowns ?? []}
      products={products ?? []}
      searchParams={searchParams}
    />
  )
}
