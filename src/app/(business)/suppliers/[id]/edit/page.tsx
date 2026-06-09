import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupplierEditForm } from './_supplier-edit-form'

interface Props {
  params: { id: string }
}

export default async function EditSupplierPage({ params }: Props) {
  const supabase = await createClient()

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!supplier) {
    notFound()
  }

  return <SupplierEditForm supplier={supplier} />
}
