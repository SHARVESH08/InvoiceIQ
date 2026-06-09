'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import {
  CreatePOSchema,
  type CreatePOInput,
} from '@/lib/schemas/purchase-order'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PurchaseOrderItem {
  id: string
  po_id: string
  product_id: string
  company_id: string
  quantity_ordered: number
  quantity_received: number | null
  unit_price: number
  total_amount: number
}

export interface PurchaseOrder {
  id: string
  company_id: string
  distributor_company_id: string | null
  supplier_id: string | null
  po_number: string
  status: string
  total_amount: number
  expected_delivery: string | null
  created_at: string
  updated_at: string
  notes: string | null
  purchase_order_items?: PurchaseOrderItem[]
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  purchase_order_items: Array<
    PurchaseOrderItem & {
      products: { name: string; hsn_code: string | null } | null
    }
  >
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: auth context (mirrors pattern in src/lib/actions/gst.ts)
// ─────────────────────────────────────────────────────────────────────────────

async function getAuthContext(): Promise<
  | { error: string }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>
      companyId: string
    }
> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return { error: 'Not authenticated' }

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) return { error: 'Company membership not found' }

  return { supabase, companyId: companyId as string }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. lookupDistributorByGstin
//
// Uses service-role admin client to cross tenant boundary (T-12-04 / D-02).
// Returns only { id, name } — never exposes company_type or other fields.
// ─────────────────────────────────────────────────────────────────────────────

export async function lookupDistributorByGstin(
  gstin: string
): Promise<{ error: string } | { company: { id: string; name: string } }> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('companies')
    .select('id, name, company_type')
    .eq('gstin', gstin.trim().toUpperCase())
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) {
    return {
      error: 'No distributor found with this GSTIN. Verify the GSTIN and try again.',
    }
  }

  if (data.company_type !== 'Distributor') {
    return {
      error: `This GSTIN belongs to a ${data.company_type} company, not a Distributor.`,
    }
  }

  return { company: { id: data.id, name: data.name } }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. createPurchaseOrder
//
// Security invariants:
//  - company_id resolved from JWT via get_company_id() RPC — never from client (T-12-02)
//  - distributor_company_id re-validated server-side via admin client after Zod parse (T-12-02)
//  - Cross-tenant pricing_alerts insert uses admin client (T-12-04)
// ─────────────────────────────────────────────────────────────────────────────

export async function createPurchaseOrder(
  input: CreatePOInput
): Promise<{ error: string } | { poId: string }> {
  // 1. Zod validation
  const parsed = CreatePOSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  // 2. Auth context — company_id from JWT, never from client
  const ctx = await getAuthContext()
  if ('error' in ctx) return ctx
  const { supabase, companyId } = ctx

  // 3. Server-side re-validation: distributor_company_id must belong to a Distributor (T-12-02)
  const supabaseAdmin = createAdminClient()
  const { data: distCo, error: distError } = await supabaseAdmin
    .from('companies')
    .select('company_type, name')
    .eq('id', parsed.data.distributor_company_id)
    .single()

  if (distError || !distCo) {
    return { error: 'Distributor company not found.' }
  }
  if (distCo.company_type !== 'Distributor') {
    return {
      error: 'Invalid distributor: the specified company is not a Distributor.',
    }
  }

  // 4. Fetch OEM company name for notifications
  const { data: oemCompany } = await supabase
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .single()
  const companyName = oemCompany?.name ?? 'Your supplier'

  // 5. Compute total_amount (sum of quantity * unit_price for all items)
  const totalAmount = parsed.data.items.reduce((sum, item) => {
    return sum + item.quantity_ordered * item.unit_price
  }, 0)

  // 6. Insert purchase_orders row
  const poNumber = 'PO-' + Date.now()
  const { data: poRow, error: poError } = await supabase
    .from('purchase_orders')
    .insert({
      company_id: companyId,
      distributor_company_id: parsed.data.distributor_company_id,
      supplier_id: null,
      status: 'sent',
      total_amount: totalAmount,
      expected_delivery: parsed.data.expected_delivery ?? null,
      notes: parsed.data.notes ?? null,
      po_number: poNumber,
    })
    .select('id')
    .single()

  if (poError) return { error: poError.message }

  // 7. Insert purchase_order_items
  const itemRows = parsed.data.items.map((item) => ({
    po_id: poRow.id,
    product_id: item.product_id,
    company_id: companyId,
    quantity_ordered: item.quantity_ordered,
    quantity_received: 0,
    unit_price: item.unit_price,
    total_amount: item.quantity_ordered * item.unit_price,
  }))

  const { error: itemsError } = await supabase
    .from('purchase_order_items')
    .insert(itemRows)

  if (itemsError) {
    // Compensating delete — orphaned PO row must not persist
    await supabase.from('purchase_orders').delete().eq('id', poRow.id)
    return { error: itemsError.message }
  }

  // 8. Insert pricing_alerts notification row (cross-tenant — use admin client per T-12-04)
  await supabaseAdmin.from('pricing_alerts').insert({
    company_id: parsed.data.distributor_company_id,
    alert_type: 'price_change',
    message: `New purchase order from ${companyName} requires your confirmation.`,
    is_read: false,
  })

  // 9. Send Resend email to Distributor admin (non-blocking — failure does not abort PO creation)
  try {
    // Fetch Distributor admin email via admin client (cross-tenant)
    const { data: adminUser } = await supabaseAdmin
      .from('company_users')
      .select('user_id, role')
      .eq('company_id', parsed.data.distributor_company_id)
      .eq('role', 'admin')
      .limit(1)
      .single()

    if (adminUser?.user_id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
        adminUser.user_id
      )
      const adminEmail = authUser?.user?.email

      if (adminEmail) {
        const resend = new Resend(process.env.RESEND_API_KEY!)
        const from =
          process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

        await resend.emails.send({
          from,
          to: [adminEmail],
          subject: `New Purchase Order from ${companyName}`,
          html: `<p>A new purchase order has been sent to your company. Log in to InvoiceIQ to confirm or reject.</p>`,
        })
      }
    }
  } catch {
    // Non-blocking — email failure does not prevent PO creation
  }

  return { poId: poRow.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. listPurchaseOrders
//
// Role-aware: OEM sees outgoing (company_id = their company),
// Distributor sees incoming (distributor_company_id = their company).
// RLS enforces isolation; .eq() filters are belt-and-suspenders (D-06).
// ─────────────────────────────────────────────────────────────────────────────

export async function listPurchaseOrders(): Promise<
  { error: string } | { orders: PurchaseOrder[] }
> {
  const ctx = await getAuthContext()
  if ('error' in ctx) return ctx
  const { supabase, companyId } = ctx

  // Fetch company type to determine query scope
  const { data: companyCtx } = await supabase.rpc('get_company_context')
  const companyType = (companyCtx as { company_type?: string } | null)
    ?.company_type

  let query = supabase
    .from('purchase_orders')
    .select('*, purchase_order_items(*)')
    .order('created_at', { ascending: false })

  if (companyType === 'Distributor') {
    query = query.eq('distributor_company_id', companyId)
  } else {
    // OEM and all other types see their outgoing POs
    query = query.eq('company_id', companyId)
  }

  const { data, error } = await query

  if (error) return { error: error.message }

  return { orders: (data as PurchaseOrder[]) ?? [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. getPurchaseOrder
//
// Fetches a single PO with items + product metadata.
// RLS enforces access; .eq('id', poId) scopes to single row.
// ─────────────────────────────────────────────────────────────────────────────

export async function getPurchaseOrder(
  poId: string
): Promise<{ error: string } | { order: PurchaseOrderDetail }> {
  const ctx = await getAuthContext()
  if ('error' in ctx) return ctx
  const { supabase } = ctx

  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, purchase_order_items(*, products(name, hsn_code))')
    .eq('id', poId)
    .single()

  if (error || !data) return { error: 'Purchase order not found' }

  return { order: data as unknown as PurchaseOrderDetail }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. confirmPO
//
// Distributor confirms an incoming PO (status: sent → confirmed).
// Belt-and-suspenders: .eq('distributor_company_id', companyId) guards even if RLS fails.
// ─────────────────────────────────────────────────────────────────────────────

export async function confirmPO(
  poId: string
): Promise<{ error: string } | { success: true }> {
  const ctx = await getAuthContext()
  if ('error' in ctx) return ctx
  const { supabase, companyId } = ctx

  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', poId)
    .eq('distributor_company_id', companyId)

  if (error) return { error: error.message }

  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. rejectPO
//
// Distributor rejects an incoming PO (status: sent → rejected).
// Optional reason stored in notes field.
// ─────────────────────────────────────────────────────────────────────────────

export async function rejectPO(
  poId: string,
  reason?: string
): Promise<{ error: string } | { success: true }> {
  const ctx = await getAuthContext()
  if ('error' in ctx) return ctx
  const { supabase, companyId } = ctx

  const { error } = await supabase
    .from('purchase_orders')
    .update({
      status: 'rejected',
      notes: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', poId)
    .eq('distributor_company_id', companyId)

  if (error) return { error: error.message }

  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. dispatchPO
//
// OEM dispatches a confirmed PO.
// Calls dispatch_po_and_create_invoice RPC (atomic: PO → dispatched + OEM sale invoice).
// FOR UPDATE in RPC prevents concurrent double-dispatch (T-12-03).
// company_id resolved from JWT, never from client.
// ─────────────────────────────────────────────────────────────────────────────

export async function dispatchPO(
  poId: string
): Promise<{ error: string } | { invoiceId: string; invoiceNumber: string }> {
  const ctx = await getAuthContext()
  if ('error' in ctx) return ctx
  const { supabase, companyId } = ctx

  const { data: invoiceId, error: rpcError } = await supabase.rpc(
    'dispatch_po_and_create_invoice',
    { p_po_id: poId, p_company_id: companyId }
  )

  if (rpcError) return { error: rpcError.message }

  // Fetch the invoice_number for the UI toast
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('id', invoiceId as string)
    .single()

  if (fetchError || !invoice) {
    return {
      error: 'PO dispatched but failed to fetch invoice number.',
    }
  }

  return {
    invoiceId: invoiceId as string,
    invoiceNumber: invoice.invoice_number as string,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. receivePO
//
// Distributor receives a dispatched PO.
// Calls receive_po_and_update_inventory RPC (atomic: PO → received + Distributor purchase invoice + inventory).
// Uses provided godownId; falls back to default godown if not specified.
// ─────────────────────────────────────────────────────────────────────────────

export async function receivePO(
  poId: string,
  godownId: string
): Promise<{ error: string } | { invoiceId: string; invoiceNumber: string }> {
  const ctx = await getAuthContext()
  if ('error' in ctx) return ctx
  const { supabase, companyId } = ctx

  // Resolve godown: use provided ID or fall back to company's default godown
  let resolvedGodownId = godownId
  if (!resolvedGodownId) {
    const { data: defaultGodown } = await supabase
      .from('godowns')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_default', true)
      .single()

    if (!defaultGodown) {
      return {
        error: 'No godown specified and no default godown found. Please create a godown first.',
      }
    }
    resolvedGodownId = defaultGodown.id
  }

  const { data: invoiceId, error: rpcError } = await supabase.rpc(
    'receive_po_and_update_inventory',
    {
      p_po_id: poId,
      p_company_id: companyId,
      p_godown_id: resolvedGodownId,
    }
  )

  if (rpcError) return { error: rpcError.message }

  // Fetch the invoice_number for the confirmation
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('id', invoiceId as string)
    .single()

  if (fetchError || !invoice) {
    return {
      error: 'PO received but failed to fetch invoice number.',
    }
  }

  return {
    invoiceId: invoiceId as string,
    invoiceNumber: invoice.invoice_number as string,
  }
}
