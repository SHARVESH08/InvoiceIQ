import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProductEditForm } from './_product-edit-form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditProductPage(props: Props) {
  const params = await props.params;
  const supabase = await createClient()

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!product) {
    notFound()
  }

  return <ProductEditForm product={product} />
}
