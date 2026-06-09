import { createClient } from '@/lib/supabase/server'
import { TransferForm } from './_components/transfer-form'

export default async function NewTransferPage() {
  const supabase = await createClient()

  const [productsRes, godownsRes, inventoryRes] = await Promise.all([
    supabase.from('products').select('id, name, unit').order('name'),
    supabase.from('godowns').select('id, name').eq('is_active', true).order('name'),
    supabase
      .from('inventory')
      .select('id, product_id, godown_id, quantity, reserved_qty'),
  ])

  return (
    <TransferForm
      products={productsRes.data ?? []}
      godowns={godownsRes.data ?? []}
      inventoryRows={inventoryRes.data ?? []}
    />
  )
}
