import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import type { InvoiceInput } from '@/lib/schemas/invoice'

interface CreditNotePageProps {
  params: Promise<{ id: string }>
}

export default async function CreditNotePage(props: CreditNotePageProps) {
  const params = await props.params;
  const supabase = await createClient()

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) notFound()

  // Fetch original invoice with line items — company_id scoped (T-04-24)
  const { data: originalInvoice, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('id', params.id)
    .eq('company_id', companyId)
    .single()

  if (error || !originalInvoice) notFound()

  // Guard: CN only allowed on sent/paid invoices (T-04-25, D-07)
  if (originalInvoice.status !== 'sent' && originalInvoice.status !== 'paid') {
    redirect(`/invoices/${params.id}`)
  }

  // Fetch dropdown data for the form
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
        .eq('id', companyId)
        .single(),
    ])

  const products = productsResult.data ?? []
  const customers = customersResult.data ?? []
  const suppliers = suppliersResult.data ?? []
  const sellerStateCode = companyResult.data?.state_code ?? ''

  // Map invoice_items to line_items shape for InvoiceForm defaultValues
  const items = (originalInvoice.invoice_items ?? []) as Array<Record<string, unknown>>
  const lineItems: InvoiceInput['line_items'] = items.map((item) => ({
    product_id: (item.product_id as string | null) ?? '',
    description: (item.description as string) ?? '',
    hsn_code: (item.hsn_code as string | null) ?? '',
    qty: Number(item.quantity),           // DB: quantity → form: qty
    rate: Number(item.unit_price),        // DB: unit_price → form: rate
    discount_percent: Number(item.discount_percent ?? 0),
    tax_rate: Number(item.tax_rate ?? 0),
  }))

  const today = new Date().toISOString().split('T')[0]

  const defaultValues: Partial<InvoiceInput> = {
    doc_type: 'credit_note',
    reference_invoice_id: params.id,
    customer_id: (originalInvoice.customer_id as string | null) ?? undefined,
    invoice_date: today,
    line_items: lineItems,
  }

  return (
    <div>
      {/* Origin reference banner */}
      <div className="bg-muted border-b px-6 py-3 text-sm text-muted-foreground">
        Based on Invoice{' '}
        <span className="font-medium text-foreground">
          {originalInvoice.invoice_number}
        </span>
      </div>

      <InvoiceForm
        products={products}
        customers={customers}
        suppliers={suppliers}
        sellerStateCode={sellerStateCode}
        defaultValues={defaultValues}
        readOnlyDocType={true}
      />
    </div>
  )
}
