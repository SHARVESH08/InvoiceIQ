import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CustomerEditForm } from './_customer-edit-form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditCustomerPage(props: Props) {
  const params = await props.params;
  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!customer) {
    notFound()
  }

  return <CustomerEditForm customer={customer} />
}
