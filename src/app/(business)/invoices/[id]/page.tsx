import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { InvoiceDetail, type InvoiceWithRelations } from './_components/invoice-detail'

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage(props: InvoiceDetailPageProps) {
  const params = await props.params;
  const supabase = await createClient()

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) notFound()

  // Fetch invoice with related data — company_id scoped (T-04-23)
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(
      `
      *,
      customers(id, name, gstin, phone, email, state_code),
      suppliers(id, name),
      invoice_items(*),
      payments(id, amount, payment_method, payment_date, reference_number, paid_at)
    `
    )
    .eq('id', params.id)
    .eq('company_id', companyId)
    .single()

  if (error || !invoice) notFound()

  // Fetch seller state_code for tax type display
  const { data: company } = await supabase
    .from('companies')
    .select('state_code')
    .eq('id', companyId)
    .single()

  const sellerStateCode = company?.state_code ?? ''

  return (
    <InvoiceDetail
      invoice={invoice as InvoiceWithRelations}
      sellerStateCode={sellerStateCode}
    />
  )
}
