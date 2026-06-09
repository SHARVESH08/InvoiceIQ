import { notFound, redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { InvoiceForm } from '@/components/invoices/invoice-form'
import type { InvoiceInput } from '@/lib/schemas/invoice'

interface EditInvoicePageProps {
  params: { id: string }
}

// Maps the DB invoice row + invoice_items into InvoiceInput shape for form defaultValues
function mapInvoiceToFormValues(
  invoice: Record<string, unknown>
): Partial<InvoiceInput> {
  const items = (invoice.invoice_items as Array<Record<string, unknown>>) ?? []

  return {
    doc_type: invoice.doc_type as InvoiceInput['doc_type'],
    customer_id: (invoice.customer_id as string | null) ?? undefined,
    supplier_id: (invoice.supplier_id as string | null) ?? undefined,
    invoice_date: invoice.invoice_date as string,
    due_date: (invoice.due_date as string | null) ?? undefined,
    status: 'draft', // edit page always submits as draft or promoted to sent via buttons
    notes: (invoice.notes as string | null) ?? undefined,
    reference_invoice_id:
      (invoice.reference_invoice_id as string | null) ?? undefined,
    line_items: items.map((item) => ({
      product_id: (item.product_id as string | null) ?? '',
      description: item.description as string,
      hsn_code: (item.hsn_code as string | null) ?? '',
      qty: Number(item.quantity),          // DB column: quantity → form field: qty
      rate: Number(item.unit_price),       // DB column: unit_price → form field: rate
      discount_percent: Number(item.discount_percent ?? 0),
      tax_rate: Number(item.tax_rate ?? 0),
    })),
  }
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const supabase = await createClient()

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) notFound()

  // Fetch invoice with line items — company_id scoped (T-04-21)
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('id', params.id)
    .eq('company_id', companyId)
    .single()

  if (error || !invoice) notFound()

  // Paid and cancelled invoices are immutable — redirect to detail page (T-04-21)
  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    redirect(`/invoices/${params.id}`)
  }

  // Also block editing non-draft invoices (sent/overdue cannot be edited)
  if (invoice.status !== 'draft') {
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

  const defaultValues = mapInvoiceToFormValues(invoice)

  return (
    <InvoiceForm
      products={products}
      customers={customers}
      suppliers={suppliers}
      sellerStateCode={sellerStateCode}
      defaultValues={defaultValues}
      mode="edit"
      invoiceId={params.id}
    />
  )
}
