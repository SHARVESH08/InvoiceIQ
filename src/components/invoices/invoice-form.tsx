'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, useWatch, type Resolver } from 'react-hook-form'
import { toast } from 'sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, Loader2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { InvoiceSchema, type InvoiceInput } from '@/lib/schemas/invoice'
import { createInvoice, updateInvoice } from '@/lib/actions/invoices'
import {
  determineTaxType,
  computeLineItemTax,
  computeInvoiceTotals,
  type LineItemTaxResult,
} from '@/lib/tax/gst'

import { LineItemsTable } from './line-items-table'
import { TaxTypeBadge, type TaxType } from './tax-badge'
import { InvoiceTotalsFooter } from './invoice-totals'
import { AddCustomerDialog } from './add-customer-dialog'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  selling_price: number
  tax_rate: number
  hsn_code: string | null
  unit: string | null
}

interface Customer {
  id: string
  name: string
  gstin: string | null
  state_code: string | null
}

interface Supplier {
  id: string
  name: string
}

interface InvoiceFormProps {
  products: Product[]
  customers: Customer[]
  suppliers: Supplier[]
  sellerStateCode: string
  defaultValues?: Partial<InvoiceInput>
  mode?: 'create' | 'edit'
  invoiceId?: string
  readOnlyDocType?: boolean
}

// ─── Empty line item default ───────────────────────────────────────────────

const emptyLineItem = {
  product_id: '',
  description: '',
  hsn_code: '',
  qty: 1,
  rate: 0,
  discount_percent: 0,
  tax_rate: 0,
}

// ─── Zero totals for initial state ────────────────────────────────────────

const zeroTotals = {
  subtotal: 0,
  discount_amount: 0,
  taxable_amount: 0,
  cgst_amount: 0,
  sgst_amount: 0,
  igst_amount: 0,
  total_amount: 0,
}

// ─── InvoiceForm ──────────────────────────────────────────────────────────

export function InvoiceForm({
  products,
  customers,
  suppliers,
  sellerStateCode,
  defaultValues,
  mode = 'create',
  invoiceId,
  readOnlyDocType = false,
}: InvoiceFormProps) {
  const today = new Date().toISOString().split('T')[0]

  const router = useRouter()
  const [activeSubmit, setActiveSubmit] = useState<'sent' | 'draft' | null>(null)
  // Local copy so an inline-created customer appears immediately + can be selected
  const [customerList, setCustomerList] = useState<Customer[]>(customers)

  const form = useForm<InvoiceInput>({
    resolver: zodResolver(InvoiceSchema) as Resolver<InvoiceInput>,
    defaultValues: {
      doc_type: 'sale',
      invoice_date: today,
      status: 'draft',
      line_items: [emptyLineItem],
      customer_id: '',
      supplier_id: '',
      due_date: '',
      notes: '',
      ...defaultValues,
    },
    mode: 'onBlur',
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'line_items',
  })

  // ── Watch customer + doc type for live tax badge ──────────────────────────
  const customerId = useWatch({ control: form.control, name: 'customer_id' })
  const docType = useWatch({ control: form.control, name: 'doc_type' })

  const selectedCustomer = customerList.find((c) => c.id === customerId)

  const taxType: TaxType = selectedCustomer
    ? (determineTaxType(
        sellerStateCode,
        selectedCustomer.gstin ?? null,
        selectedCustomer.state_code ?? null
      ) as TaxType)
    : 'unknown'

  // ── Watch line items for live totals ─────────────────────────────────────
  const lineItemsWatched = useWatch({ control: form.control, name: 'line_items' })

  const computedTotals = useMemo(() => {
    if (!lineItemsWatched || lineItemsWatched.length === 0) return zeroTotals

    // If taxType is unknown, treat as inter for computation purposes (IGST)
    const effectiveTaxType: 'intra' | 'inter' = taxType === 'intra' ? 'intra' : 'inter'

    const lineItemResults: LineItemTaxResult[] = lineItemsWatched.map((item) => {
      const qty = Number(item?.qty) || 0
      const rate = Number(item?.rate) || 0
      const discount = Number(item?.discount_percent) || 0
      const taxRate = Number(item?.tax_rate) || 0

      // Convert to integer paise / milli / bps for gst.ts
      const ratePaise = Math.round(rate * 100)
      const qtyMilli = Math.round(qty * 1000)
      const discountBps = Math.round(discount * 100)
      const taxBps = Math.round(taxRate * 100)

      const taxResult = computeLineItemTax(
        ratePaise,
        qtyMilli,
        discountBps,
        taxBps,
        effectiveTaxType
      )

      // Reconstruct full LineItemTaxResult (grossPaise + discountPaise needed by computeInvoiceTotals)
      const grossPaise = (ratePaise * qtyMilli) / 1000
      const discountPaise = (grossPaise * discountBps) / 10000

      return {
        grossPaise,
        discountPaise,
        taxableAmountPaise: taxResult.taxableAmountPaise,
        cgstPaise: taxResult.cgstPaise,
        sgstPaise: taxResult.sgstPaise,
        igstPaise: taxResult.igstPaise,
      }
    })

    return computeInvoiceTotals(lineItemResults)
  }, [lineItemsWatched, taxType])

  // ── Product auto-fill ─────────────────────────────────────────────────────
  function handleProductSelect(index: number, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    form.setValue(`line_items.${index}.description`, product.name, {
      shouldDirty: true,
      shouldValidate: false,
    })
    form.setValue(`line_items.${index}.hsn_code`, product.hsn_code ?? '', {
      shouldDirty: true,
      shouldValidate: false,
    })
    form.setValue(`line_items.${index}.rate`, product.selling_price, {
      shouldDirty: true,
      shouldValidate: false,
    })
    form.setValue(`line_items.${index}.tax_rate`, product.tax_rate, {
      shouldDirty: true,
      shouldValidate: false,
    })
  }

  // ── Submit handler ────────────────────────────────────────────────────────
  async function onSubmit(values: InvoiceInput) {
    const result =
      mode === 'edit' && invoiceId
        ? await updateInvoice(invoiceId, values)
        : await createInvoice(values)

    if (!result) return // redirect() was called server-side

    if ('error' in result) {
      form.setError('root', { message: result.error })
      return
    }

    if ('sent' in result) {
      if (result.emailFailed) {
        toast.warning('Invoice sent. Email delivery failed — share the invoice link manually.')
      } else {
        toast.success('Invoice sent. Payment link emailed to the customer.')
      }
      router.push(`/invoices/${result.invoiceId}`)
    }
  }

  // ── Derived page title ────────────────────────────────────────────────────
  const pageTitle = (() => {
    if (mode === 'edit') return 'Edit Invoice'
    if (docType === 'purchase') return 'Create Purchase Invoice'
    if (docType === 'credit_note') return 'Create Credit Note'
    if (docType === 'debit_note') return 'Create Debit Note'
    return 'Create Invoice'
  })()

  const primaryButtonLabel = (() => {
    if (mode === 'edit') return 'Update Invoice'
    if (docType === 'credit_note') return 'Create Credit Note'
    if (docType === 'debit_note') return 'Create Debit Note'
    return 'Create Invoice'
  })()

  const showCustomer = ['sale', 'credit_note', 'debit_note'].includes(docType)
  const showSupplier = docType === 'purchase'

  return (
    <main className="flex-1 p-6 max-w-5xl mx-auto">
      {/* Back link + page title */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/invoices">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Invoices
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>

          {/* Section 1: Invoice Details */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base font-bold">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">

                {/* Document Type */}
                <FormField
                  control={form.control}
                  name="doc_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={readOnlyDocType}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sale">Sale Invoice</SelectItem>
                          <SelectItem value="purchase">Purchase Invoice</SelectItem>
                          <SelectItem value="credit_note">Credit Note</SelectItem>
                          <SelectItem value="debit_note">Debit Note</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Customer — shown for sale / credit_note / debit_note */}
                {showCustomer && (
                  <FormField
                    control={form.control}
                    name="customer_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer</FormLabel>
                        <div className="flex items-center gap-2">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select customer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {customerList.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <AddCustomerDialog
                            onCreated={(c) => {
                              setCustomerList((prev) => [c, ...prev])
                              form.setValue('customer_id', c.id, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }}
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Supplier — shown for purchase */}
                {showSupplier && (
                  <FormField
                    control={form.control}
                    name="supplier_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select supplier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Invoice Date */}
                <FormField
                  control={form.control}
                  name="invoice_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Due Date */}
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notes — full row */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="col-span-2 md:col-span-3">
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ''}
                          placeholder="Any additional notes for this invoice"
                          rows={2}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Line Items */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base font-bold">Line Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <LineItemsTable
                form={form}
                fields={fields}
                append={append}
                remove={remove}
                products={products}
                onProductSelect={handleProductSelect}
              />
              <div className="p-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append(emptyLineItem)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Tax Badge + Totals */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="mb-4">
                <TaxTypeBadge taxType={taxType} />
              </div>
              <InvoiceTotalsFooter totals={computedTotals} taxType={taxType} />
            </CardContent>
          </Card>

          {/* Root error */}
          {form.formState.errors.root && (
            <p className="text-sm text-destructive mb-4">
              {form.formState.errors.root.message}
            </p>
          )}

          {/* Dual submit buttons */}
          <div className="flex items-center gap-3">
            {/* Primary: Create / Update Invoice (status = sent) */}
            <Button
              type="button"
              disabled={form.formState.isSubmitting}
              onClick={() => {
                form.setValue('status', 'sent')
                setActiveSubmit('sent')
                form.handleSubmit(onSubmit)()
              }}
            >
              {form.formState.isSubmitting && activeSubmit === 'sent' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {primaryButtonLabel}
            </Button>

            {/* Secondary: Save as Draft (status = draft) */}
            <Button
              type="button"
              variant="outline"
              disabled={form.formState.isSubmitting}
              onClick={() => {
                form.setValue('status', 'draft')
                setActiveSubmit('draft')
                form.handleSubmit(onSubmit)()
              }}
            >
              {form.formState.isSubmitting && activeSubmit === 'draft' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save as Draft
            </Button>

            {/* Ghost: Cancel */}
            <Button variant="ghost" type="button" asChild>
              <Link href="/invoices">Cancel</Link>
            </Button>
          </div>

        </form>
      </Form>
    </main>
  )
}
