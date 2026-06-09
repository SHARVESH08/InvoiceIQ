import { createClient } from '@/lib/supabase/server'
import { InvoiceForm } from '@/components/invoices/invoice-form'

export default async function NewInvoicePage() {
  const supabase = await createClient()

  const { data: companyId } = await supabase.rpc('get_company_id')

  const [productsResult, customersResult, suppliersResult, companyResult] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, name, selling_price, tax_rate, hsn_code, unit')
        .order('name'),
      supabase
        .from('customers')
        .select('id, name, gstin, state_code')
        .order('name'),
      supabase
        .from('suppliers')
        .select('id, name')
        .order('name'),
      supabase
        .from('companies')
        .select('state_code')
        .eq('id', companyId ?? '')
        .single(),
    ])

  const products = productsResult.data ?? []
  const customers = customersResult.data ?? []
  const suppliers = suppliersResult.data ?? []
  const sellerStateCode = companyResult.data?.state_code ?? ''

  return (
    <InvoiceForm
      products={products}
      customers={customers}
      suppliers={suppliers}
      sellerStateCode={sellerStateCode}
    />
  )
}
