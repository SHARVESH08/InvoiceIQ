import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupplierEditForm } from './_supplier-edit-form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditSupplierPage(props: Props) {
  const params = await props.params;
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
