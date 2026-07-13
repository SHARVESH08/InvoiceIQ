'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  InvoiceSchema,
  PaymentSchema,
  type InvoiceInput,
  type PaymentInput,
} from '@/lib/schemas/invoice'
import {
  determineTaxType,
  computeLineItemTax,
  computeInvoiceTotals,
  type TaxType,
  type LineItemTaxResult,
} from '@/lib/tax/gst'
import { generateInvoicePdf, type InvoiceForPdf } from '@/lib/pdf/invoice-pdf'
import { uploadPdfToStorage } from '@/lib/pdf/storage'
import { createPaymentLink } from '@/lib/payments/razorpay'
import { sendInvoiceEmail } from '@/lib/email/resend'

// ─────────────────────────────────────────────────────────────────────────────
// Helper: derive GST invoice classification (B2B / B2CS / B2CL)
// ─────────────────────────────────────────────────────────────────────────────
function deriveInvoiceType(
  customer: { gstin?: string | null },
  totalAmount: number
): 'B2B' | 'B2CS' | 'B2CL' {
  if (customer.gstin) return 'B2B'
  if (totalAmount > 250000) return 'B2CL'
  return 'B2CS'
}

// ─────────────────────────────────────────────────────────────────────────────
// createInvoice
//
// Business rules enforced:
//  - Tax amounts are ALWAYS re-computed server-side; client values are discarded (T-04-08)
//  - company_id resolved via get_company_id() RPC; never accepted from client (T-04-09)
//  - customer_phone / customer_email denormalized at insert time (INVOICE-04)
//  - Draft invoices use invoice_number='DRAFT' sentinel; trigger skips assignment (INVOICE-03)
//  - Multi-table insert uses compensating delete on invoice_items failure (Pitfall 8)
// ─────────────────────────────────────────────────────────────────────────────
export async function createInvoice(
  input: InvoiceInput
): Promise<
  | { error: string }
  | { sent: true; invoiceId: string; emailFailed: boolean }
  | never
> {
  const parsed = InvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: 'Company membership not found' }
  }

  // Fetch seller state_code for server-side tax re-validation (D-05)
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('state_code')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return { error: 'Company record not found' }
  }

  // Fetch customer/supplier for denormalization and tax-type determination
  let customerPhone: string | null = null
  let customerEmail: string | null = null
  let buyerGstin: string | null = null
  let buyerStateCode: string | null = null
  let invoiceTypeGuest: { gstin?: string | null } = {}

  if (
    ['sale', 'credit_note', 'debit_note'].includes(parsed.data.doc_type) &&
    parsed.data.customer_id
  ) {
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('phone,email,gstin,state_code')
      .eq('id', parsed.data.customer_id)
      .single()

    if (custError || !customer) {
      return { error: 'Customer not found' }
    }

    customerPhone = customer.phone ?? null
    customerEmail = customer.email ?? null
    buyerGstin = customer.gstin ?? null
    buyerStateCode = customer.state_code ?? null
    invoiceTypeGuest = { gstin: customer.gstin }
  } else if (parsed.data.doc_type === 'purchase' && parsed.data.supplier_id) {
    const { data: supplier, error: suppError } = await supabase
      .from('suppliers')
      .select('name')
      .eq('id', parsed.data.supplier_id)
      .single()

    if (suppError || !supplier) {
      return { error: 'Supplier not found' }
    }
    // Purchase invoices are always inter-state IGST (no customer GSTIN)
    invoiceTypeGuest = {}
  }

  // Server-side eligibility check for CN/DN (T-04-24, T-04-25)
  // reference_invoice_id must belong to same company AND be in 'sent' or 'paid' status
  if (
    (parsed.data.doc_type === 'credit_note' ||
      parsed.data.doc_type === 'debit_note') &&
    parsed.data.reference_invoice_id
  ) {
    const { data: refInvoice, error: refError } = await supabase
      .from('invoices')
      .select('id, status, company_id')
      .eq('id', parsed.data.reference_invoice_id)
      .eq('company_id', companyId)
      .single()

    if (refError || !refInvoice) {
      return { error: 'Reference invoice not found or belongs to another company' }
    }

    if (refInvoice.status !== 'sent' && refInvoice.status !== 'paid') {
      return { error: 'Credit/debit notes can only be issued against sent or paid invoices' }
    }
  }

  // Re-compute all line item taxes server-side (T-04-08 — never trust client amounts)
  const taxType: TaxType = determineTaxType(
    company.state_code,
    buyerGstin,
    buyerStateCode
  )

  const recomputedItems: LineItemTaxResult[] = parsed.data.line_items.map(
    (item) => {
      const ratePaise = Math.round(item.rate * 100)
      const qtyMilli = Math.round(item.qty * 1000)
      const discountBps = Math.round(item.discount_percent * 100)
      const taxBps = Math.round(item.tax_rate * 100)

      const { taxableAmountPaise, cgstPaise, sgstPaise, igstPaise } =
        computeLineItemTax(ratePaise, qtyMilli, discountBps, taxBps, taxType)

      const grossPaise = (ratePaise * qtyMilli) / 1000
      const discountPaise = (grossPaise * discountBps) / 10000

      return {
        grossPaise,
        discountPaise,
        taxableAmountPaise,
        cgstPaise,
        sgstPaise,
        igstPaise,
      }
    }
  )

  const totals = computeInvoiceTotals(recomputedItems)

  const invoiceType = deriveInvoiceType(invoiceTypeGuest, totals.total_amount)

  // When a sale/credit/debit invoice is submitted as 'sent' directly from the form,
  // create it as draft first then run markAsSent so the full PDF+payment pipeline executes.
  const wantsToSend = parsed.data.status === 'sent' && !!parsed.data.customer_id

  // Drafts use 'DRAFT' sentinel so the BEFORE INSERT trigger skips sequence assignment (INVOICE-03).
  // Also use 'DRAFT' when wantsToSend — markAsSent will assign the real invoice number via RPC.
  const invoiceNumber =
    parsed.data.status === 'draft' || wantsToSend ? 'DRAFT' : null

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      company_id: companyId,
      customer_id: parsed.data.customer_id || null,
      supplier_id: parsed.data.supplier_id || null,
      doc_type: parsed.data.doc_type,
      invoice_type: invoiceType,
      invoice_date: parsed.data.invoice_date,
      due_date: parsed.data.due_date || null,
      status: wantsToSend ? 'draft' : parsed.data.status,
      invoice_number: invoiceNumber,
      customer_phone: customerPhone,   // INVOICE-04 denormalization
      customer_email: customerEmail,   // INVOICE-04 denormalization
      notes: parsed.data.notes || null,
      reference_invoice_id: parsed.data.reference_invoice_id || null,
      subtotal: totals.subtotal,
      discount_amount: totals.discount_amount,
      taxable_amount: totals.taxable_amount,
      cgst_amount: totals.cgst_amount,
      sgst_amount: totals.sgst_amount,
      igst_amount: totals.igst_amount,
      total_amount: totals.total_amount,
      paid_amount: 0,
      payment_status: 'unpaid',
    })
    .select('id')
    .single()

  if (invoiceError) return { error: invoiceError.message }

  // Build line item rows — include company_id (required by RLS, Pitfall 6)
  const itemRows = recomputedItems.map((item, i) => {
    const li = parsed.data.line_items[i]
    const ratePaise = Math.round(li.rate * 100)
    const qtyMilli = Math.round(li.qty * 1000)
    const discountBps = Math.round(li.discount_percent * 100)
    const grossPaise = (ratePaise * qtyMilli) / 1000
    const discountPaise = (grossPaise * discountBps) / 10000
    const taxableAmountPaise = grossPaise - discountPaise
    const taxRateHalf = li.tax_rate / 2

    const cgstRate = item.cgstPaise > 0 ? taxRateHalf : 0
    const sgstRate = item.sgstPaise > 0 ? taxRateHalf : 0
    const igstRate = item.igstPaise > 0 ? li.tax_rate : 0

    return {
      invoice_id: invoice.id,
      company_id: companyId,
      product_id: li.product_id || null,
      description: li.description,
      hsn_code: li.hsn_code || null,
      quantity: li.qty,
      unit_price: li.rate,
      discount_percent: li.discount_percent,
      tax_rate: li.tax_rate,
      cgst_rate: cgstRate,
      sgst_rate: sgstRate,
      igst_rate: igstRate,
      cgst_amount: item.cgstPaise / 100,
      sgst_amount: item.sgstPaise / 100,
      igst_amount: item.igstPaise / 100,
      taxable_amount: taxableAmountPaise / 100,
      total_amount: (taxableAmountPaise + item.cgstPaise + item.sgstPaise + item.igstPaise) / 100,
    }
  })

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(itemRows)

  if (itemsError) {
    // Compensating delete — orphaned invoice row must not persist (Pitfall 8)
    await supabase.from('invoices').delete().eq('id', invoice.id)
    return { error: itemsError.message }
  }

  if (wantsToSend) {
    const sendResult = await markAsSent(invoice.id)
    if ('error' in sendResult) {
      // Draft is preserved — user can open it and retry Send Invoice from the detail page
      return { error: `Invoice saved as draft. Send failed: ${sendResult.error}` }
    }
    return { sent: true, invoiceId: invoice.id, emailFailed: sendResult.emailFailed }
  }

  redirect('/invoices?created=1')
}

// ─────────────────────────────────────────────────────────────────────────────
// updateInvoice
//
// Only draft invoices may be edited.
// Paid and cancelled invoices are immutable (T-04-10, Pitfall 7).
// Tax amounts are re-computed server-side on every update.
// Existing line items are deleted and re-inserted (simplest correct approach).
// ─────────────────────────────────────────────────────────────────────────────
export async function updateInvoice(
  id: string,
  input: InvoiceInput
): Promise<{ error: string } | never> {
  const parsed = InvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: 'Company membership not found' }
  }

  // Immutability check — paid and cancelled invoices cannot be modified (T-04-10)
  const { data: existing, error: fetchError } = await supabase
    .from('invoices')
    .select('id,status,company_id')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !existing) {
    return { error: 'Invoice not found' }
  }

  if (existing.status === 'paid' || existing.status === 'cancelled') {
    return { error: 'This invoice cannot be edited' }
  }

  if (existing.status !== 'draft') {
    return { error: 'Only draft invoices can be edited' }
  }

  // Fetch company state_code
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('state_code')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return { error: 'Company record not found' }
  }

  // Fetch customer/supplier for denormalization
  let customerPhone: string | null = null
  let customerEmail: string | null = null
  let buyerGstin: string | null = null
  let buyerStateCode: string | null = null
  let invoiceTypeGuest: { gstin?: string | null } = {}

  if (
    ['sale', 'credit_note', 'debit_note'].includes(parsed.data.doc_type) &&
    parsed.data.customer_id
  ) {
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('phone,email,gstin,state_code')
      .eq('id', parsed.data.customer_id)
      .single()

    if (custError || !customer) {
      return { error: 'Customer not found' }
    }

    customerPhone = customer.phone ?? null
    customerEmail = customer.email ?? null
    buyerGstin = customer.gstin ?? null
    buyerStateCode = customer.state_code ?? null
    invoiceTypeGuest = { gstin: customer.gstin }
  }

  // Re-compute taxes server-side
  const taxType: TaxType = determineTaxType(
    company.state_code,
    buyerGstin,
    buyerStateCode
  )

  const recomputedItems: LineItemTaxResult[] = parsed.data.line_items.map(
    (item) => {
      const ratePaise = Math.round(item.rate * 100)
      const qtyMilli = Math.round(item.qty * 1000)
      const discountBps = Math.round(item.discount_percent * 100)
      const taxBps = Math.round(item.tax_rate * 100)

      const { taxableAmountPaise, cgstPaise, sgstPaise, igstPaise } =
        computeLineItemTax(ratePaise, qtyMilli, discountBps, taxBps, taxType)

      const grossPaise = (ratePaise * qtyMilli) / 1000
      const discountPaise = (grossPaise * discountBps) / 10000

      return {
        grossPaise,
        discountPaise,
        taxableAmountPaise,
        cgstPaise,
        sgstPaise,
        igstPaise,
      }
    }
  )

  const totals = computeInvoiceTotals(recomputedItems)
  const invoiceType = deriveInvoiceType(invoiceTypeGuest, totals.total_amount)

  // Delete existing line items; re-insert fresh set
  const { error: deleteItemsError } = await supabase
    .from('invoice_items')
    .delete()
    .eq('invoice_id', id)

  if (deleteItemsError) {
    return { error: deleteItemsError.message }
  }

  const itemRows = recomputedItems.map((item, i) => {
    const li = parsed.data.line_items[i]
    const ratePaise = Math.round(li.rate * 100)
    const qtyMilli = Math.round(li.qty * 1000)
    const discountBps = Math.round(li.discount_percent * 100)
    const grossPaise = (ratePaise * qtyMilli) / 1000
    const discountPaise = (grossPaise * discountBps) / 10000
    const taxableAmountPaise = grossPaise - discountPaise
    const taxRateHalf = li.tax_rate / 2

    const cgstRate = item.cgstPaise > 0 ? taxRateHalf : 0
    const sgstRate = item.sgstPaise > 0 ? taxRateHalf : 0
    const igstRate = item.igstPaise > 0 ? li.tax_rate : 0

    return {
      invoice_id: id,
      company_id: companyId,
      product_id: li.product_id || null,
      description: li.description,
      hsn_code: li.hsn_code || null,
      quantity: li.qty,
      unit_price: li.rate,
      discount_percent: li.discount_percent,
      tax_rate: li.tax_rate,
      cgst_rate: cgstRate,
      sgst_rate: sgstRate,
      igst_rate: igstRate,
      cgst_amount: item.cgstPaise / 100,
      sgst_amount: item.sgstPaise / 100,
      igst_amount: item.igstPaise / 100,
      taxable_amount: taxableAmountPaise / 100,
      total_amount: (taxableAmountPaise + item.cgstPaise + item.sgstPaise + item.igstPaise) / 100,
    }
  })

  const { error: insertItemsError } = await supabase
    .from('invoice_items')
    .insert(itemRows)

  if (insertItemsError) {
    return { error: insertItemsError.message }
  }

  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      customer_id: parsed.data.customer_id || null,
      supplier_id: parsed.data.supplier_id || null,
      doc_type: parsed.data.doc_type,
      invoice_type: invoiceType,
      invoice_date: parsed.data.invoice_date,
      due_date: parsed.data.due_date || null,
      notes: parsed.data.notes || null,
      reference_invoice_id: parsed.data.reference_invoice_id || null,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      subtotal: totals.subtotal,
      discount_amount: totals.discount_amount,
      taxable_amount: totals.taxable_amount,
      cgst_amount: totals.cgst_amount,
      sgst_amount: totals.sgst_amount,
      igst_amount: totals.igst_amount,
      total_amount: totals.total_amount,
    })
    .eq('id', id)
    .eq('company_id', companyId)

  if (updateError) return { error: updateError.message }

  redirect(`/invoices/${id}?updated=1`)
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteInvoice
//
// Only draft invoices may be deleted.
// CASCADE FK on invoice_items ensures line items are deleted with the invoice.
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteInvoice(
  id: string
): Promise<{ error: string } | void> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: 'Company membership not found' }
  }

  const { data: existing, error: fetchError } = await supabase
    .from('invoices')
    .select('id,status')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !existing) {
    return { error: 'Invoice not found' }
  }

  if (existing.status !== 'draft') {
    return { error: 'Only draft invoices can be deleted' }
  }

  const { error: deleteError } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (deleteError) return { error: deleteError.message }

  redirect('/invoices?deleted=1')
}

// ─────────────────────────────────────────────────────────────────────────────
// markAsSent
//
// Promotes a draft invoice to sent status via the full Send pipeline:
//   auth → company_id → draft guard → generate_invoice_number RPC →
//   fetch customer + company → generateInvoicePdf → uploadPdfToStorage →
//   createPaymentLink → UPDATE invoices (status, invoice_number, pdf_url,
//   payment_link_url) → sendInvoiceEmail (non-blocking)
//
// Returns { success: true, emailFailed: boolean } on success.
// Returns { error: string } on blocking pipeline failure — invoice row stays 'draft' (D-07).
// Never calls redirect() (RESEARCH.md Pitfall 4).
// Cross-company access prevented by .eq('company_id', companyId) + RLS (T-05-17).
// Partial-write prevention: DB UPDATE only runs after all three blocking steps succeed (T-05-16).
// Non-customer invoices (purchase) rejected before pipeline (T-05-23).
// (T-04-12, INVOICE-03, T-05-16, T-05-17, T-05-18, T-05-23)
// ─────────────────────────────────────────────────────────────────────────────
export async function markAsSent(
  id: string
): Promise<{ error: string } | { success: true; emailFailed: boolean }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: 'Company membership not found' }
  }

  const { data: existing, error: fetchError } = await supabase
    .from('invoices')
    .select(
      'id, status, invoice_date, due_date, doc_type, subtotal, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount, customer_phone, customer_email, customer_id, supplier_id, company_id, invoice_items(description, hsn_code, quantity, unit_price, discount_percent, tax_rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount)'
    )
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !existing) {
    return { error: 'Invoice not found' }
  }

  // Immutability check — paid invoices cannot be re-sent (T-04-10, T-05-18)
  if (existing.status === 'paid') {
    return { error: 'Paid invoices cannot be modified' }
  }

  if (existing.status !== 'draft') {
    return { error: 'Only draft invoices can be marked as sent' }
  }

  // Phase 5 scope: only sale/credit_note/debit_note invoices can be sent via this flow (T-05-23)
  if (!existing.customer_id) {
    return { error: 'Only sale/credit-note/debit-note invoices can be sent via this flow.' }
  }

  // Explicitly call generate_invoice_number — trigger only fires on INSERT, not UPDATE
  const { data: invNum, error: numError } = await supabase.rpc(
    'generate_invoice_number',
    {
      p_company_id: companyId,
      p_date: existing.invoice_date,
    }
  )

  if (numError) return { error: numError.message }

  // Fetch customer for PDF and payment link
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('name, gstin, billing_address, state_code')
    .eq('id', existing.customer_id)
    .single()

  if (customerError || !customer) {
    return { error: 'Customer record not found' }
  }

  // Fetch company for PDF header
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('name, gstin, address')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return { error: 'Company record not found' }
  }

  // Convert billing_address jsonb {street, city, pincode} to a display string
  const customerAddressStr = customer.billing_address
    ? [
        (customer.billing_address as { street?: string; city?: string; pincode?: string }).street,
        (customer.billing_address as { street?: string; city?: string; pincode?: string }).city,
        (customer.billing_address as { street?: string; city?: string; pincode?: string }).pincode,
      ]
        .filter(Boolean)
        .join(', ')
    : null

  // Build InvoiceForPdf object (Plan 02 contract)
  const invoiceForPdf: InvoiceForPdf = {
    id: existing.id,
    invoice_number: invNum,
    invoice_date: existing.invoice_date,
    due_date: existing.due_date,
    doc_type: existing.doc_type,
    subtotal: Number(existing.subtotal),
    discount_amount: Number(existing.discount_amount),
    taxable_amount: Number(existing.taxable_amount),
    cgst_amount: Number(existing.cgst_amount),
    sgst_amount: Number(existing.sgst_amount),
    igst_amount: Number(existing.igst_amount),
    total_amount: Number(existing.total_amount),
    customer_name: customer.name,
    customer_gstin: customer.gstin,
    customer_address: customerAddressStr,
    customer_state_code: customer.state_code,
    company: { name: company.name, gstin: company.gstin, address: company.address as string | null },
    invoice_items: existing.invoice_items,
  }

  // Blocking pipeline — any step failure returns { error } and leaves invoice as 'draft' (D-07, T-05-16)
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generateInvoicePdf(invoiceForPdf)
  } catch (err) {
    console.error('[markAsSent] generateInvoicePdf failed:', err)
    return { error: 'Failed to generate PDF. Invoice not sent.' }
  }

  let pdfUrl: string
  try {
    const adminClient = createAdminClient()
    pdfUrl = await uploadPdfToStorage(adminClient, pdfBuffer, existing.id)
  } catch (err) {
    console.error('[markAsSent] uploadPdfToStorage failed:', err)
    return { error: 'Failed to upload PDF. Invoice not sent.' }
  }

  let paymentLinkUrl: string
  try {
    paymentLinkUrl = await createPaymentLink({
      id: existing.id,
      invoice_number: invNum,
      total_amount: Number(existing.total_amount),
      customer_name: customer.name,
      customer_email: existing.customer_email,
      customer_phone: existing.customer_phone,
    })
  } catch (err) {
    console.error('[markAsSent] createPaymentLink failed:', err)
    return { error: 'Failed to generate payment link. Invoice not sent.' }
  }

  // Single DB UPDATE — runs only after all blocking steps succeed (T-05-16)
  const { error: updateError } = await supabase
    .from('invoices')
    .update({ status: 'sent', invoice_number: invNum, pdf_url: pdfUrl, payment_link_url: paymentLinkUrl })
    .eq('id', id)
    .eq('company_id', companyId)

  if (updateError) return { error: updateError.message }

  // Non-blocking email step (D-08) — failure does NOT prevent invoice from being marked sent
  let emailFailed = false
  if (existing.customer_email) {
    try {
      await sendInvoiceEmail({
        invoiceNumber: invNum,
        companyName: company.name,
        customerEmail: existing.customer_email,
        pdfBuffer,
        paymentLinkUrl,
      })
    } catch {
      emailFailed = true
    }
  } else {
    // No email address — treat as email-failed so UI warns user (D-08)
    emailFailed = true
  }

  return { success: true, emailFailed }
}

// ─────────────────────────────────────────────────────────────────────────────
// cancelInvoice
//
// Cancels a sent or overdue invoice. Paid invoices are immutable.
// ─────────────────────────────────────────────────────────────────────────────
export async function cancelInvoice(
  id: string
): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: 'Company membership not found' }
  }

  const { data: existing, error: fetchError } = await supabase
    .from('invoices')
    .select('id,status')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !existing) {
    return { error: 'Invoice not found' }
  }

  if (existing.status === 'paid') {
    return { error: 'Paid invoices cannot be cancelled' }
  }

  if (existing.status === 'cancelled') {
    return { error: 'Invoice is already cancelled' }
  }

  const { error: updateError } = await supabase
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('company_id', companyId)

  if (updateError) return { error: updateError.message }

  redirect(`/invoices/${id}?cancelled=1`)
}

// ─────────────────────────────────────────────────────────────────────────────
// recordPayment
//
// Inserts a payment row and updates invoice paid_amount + payment_status.
// Auto-transitions invoice to status='paid' when SUM(payments) >= total_amount.
// (D-11, RESEARCH §"Record Payment + Auto-Status Update")
// ─────────────────────────────────────────────────────────────────────────────
export async function recordPayment(
  invoiceId: string,
  input: PaymentInput
): Promise<{ error: string } | never> {
  const parsed = PaymentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid payment input' }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { error: 'Company membership not found' }
  }

  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('id,status,total_amount,paid_amount,company_id')
    .eq('id', invoiceId)
    .eq('company_id', companyId)
    .single()

  if (fetchError || !invoice) {
    return { error: 'Invoice not found' }
  }

  // Payment can only be recorded on sent or overdue invoices
  if (invoice.status !== 'sent' && invoice.status !== 'overdue') {
    return {
      error: 'Payment can only be recorded for sent or overdue invoices',
    }
  }

  const { error: paymentError } = await supabase.from('payments').insert({
    company_id: companyId,
    invoice_id: invoiceId,
    amount: parsed.data.amount,
    payment_method: parsed.data.payment_mode,
    payment_date: parsed.data.payment_date,
    reference_number: parsed.data.reference_number ?? null,
    paid_at: new Date().toISOString(),
  })

  if (paymentError) return { error: paymentError.message }

  // Sum all payments for this invoice to determine new status
  const { data: payments, error: sumError } = await supabase
    .from('payments')
    .select('amount')
    .eq('invoice_id', invoiceId)

  if (sumError) return { error: sumError.message }

  const totalPaid =
    payments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0

  if (totalPaid >= Number(invoice.total_amount)) {
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        paid_amount: totalPaid,
        status: 'paid',
        payment_status: 'paid',
      })
      .eq('id', invoiceId)
      .eq('company_id', companyId)

    if (updateError) return { error: updateError.message }
  } else {
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        paid_amount: totalPaid,
        payment_status: 'partial',
      })
      .eq('id', invoiceId)
      .eq('company_id', companyId)

    if (updateError) return { error: updateError.message }
  }

  redirect(`/invoices/${invoiceId}?payment=1`)
}

// ─────────────────────────────────────────────────────────────────────────────
// listInvoices
//
// Server-side data-fetching helper for RSC invoice list pages.
// Applies URL-based filters. 25 rows per page. ORDER BY updated_at DESC (D-09).
// ─────────────────────────────────────────────────────────────────────────────
export async function listInvoices(searchParams: {
  page?: string
  q?: string
  status?: string
  from_date?: string
  to_date?: string
  customer_id?: string
}): Promise<{
  invoices: Array<Record<string, unknown>>
  total: number
  page: number
  error?: string
}> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { invoices: [], total: 0, page: 1, error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { invoices: [], total: 0, page: 1, error: 'Company membership not found' }
  }

  const PAGE_SIZE = 25
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('invoices')
    .select(
      `
      id, invoice_number, invoice_date, due_date, doc_type, status,
      total_amount, paid_amount, payment_status,
      customers(name)
    `,
      { count: 'exact' }
    )
    .eq('company_id', companyId)  // belt-and-suspenders; RLS also scopes (T-04-11)
    .order('updated_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }
  if (searchParams.customer_id) {
    query = query.eq('customer_id', searchParams.customer_id)
  }
  if (searchParams.from_date) {
    query = query.gte('invoice_date', searchParams.from_date)
  }
  if (searchParams.to_date) {
    query = query.lte('invoice_date', searchParams.to_date)
  }
  if (searchParams.q) {
    query = query.ilike('invoice_number', `%${searchParams.q}%`)
  }

  const { data, count, error } = await query

  if (error) {
    return { invoices: [], total: 0, page, error: error.message }
  }

  return {
    invoices: (data as Array<Record<string, unknown>>) ?? [],
    total: count ?? 0,
    page,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getInvoice
//
// Fetches a single invoice with its line items and payments.
// company_id scoped at query level (T-04-11 belt-and-suspenders; RLS also enforces).
// ─────────────────────────────────────────────────────────────────────────────
export async function getInvoice(id: string): Promise<{
  invoice: Record<string, unknown> | null
  error?: string
}> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { invoice: null, error: 'Not authenticated' }
  }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) {
    return { invoice: null, error: 'Company membership not found' }
  }

  const { data, error } = await supabase
    .from('invoices')
    .select(
      `
      *,
      customers(id, name, gstin, phone, email, state_code),
      suppliers(id, name),
      invoice_items(*),
      payments(*)
    `
    )
    .eq('id', id)
    .eq('company_id', companyId)  // T-04-11: belt-and-suspenders cross-company protection
    .single()

  if (error || !data) {
    return { invoice: null, error: 'Invoice not found' }
  }

  return { invoice: data as Record<string, unknown> }
}
