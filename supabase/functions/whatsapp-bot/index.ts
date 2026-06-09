// supabase/functions/whatsapp-bot/index.ts
// Plan 09-04 — Full WhatsApp Bot Edge Function
// Owned by Edge Function per D-02: state machine, invoice creation,
// Razorpay payment link, WhatsApp reply sends.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  STATES,
  reduce,
  parseStart,
  CartItem,
  CatalogEntry,
  SessionSnapshot,
} from './_lib/state-machine.ts'

// =============================================================================
// Types
// =============================================================================

interface WhatsAppMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
}

interface WebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsAppMessage[]
        statuses?: unknown[]
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>
      }
    }>
  }>
}

// =============================================================================
// WhatsApp send helper (D-04)
// T-9-05: Authorization header value is NEVER logged
// =============================================================================

async function sendWhatsAppMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  text: string,
): Promise<void> {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    // T-9-05: Log status code only, never token value
    console.error(JSON.stringify({
      event: 'whatsapp_send_error',
      status: res.status,
      body_preview: err.slice(0, 200),
      to,
    }))
    throw new Error(`WhatsApp send failed: ${res.status}`)
  }
}

// =============================================================================
// Razorpay payment link (raw fetch — NOT npm package; Deno-incompatible)
// §5 of RESEARCH.md
// T-9-05: RAZORPAY_KEY_SECRET is NEVER logged
// =============================================================================

async function createRazorpayPaymentLink(params: {
  invoiceId: string
  invoiceNumber: string
  totalAmount: number
  customerName: string
  customerPhone: string
}): Promise<string> {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID')!
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
  // T-9-05: auth header value derived from secrets — never logged
  const auth = btoa(`${keyId}:${keySecret}`)

  const amountPaise = Math.round(Number(params.totalAmount) * 100)
  const customer: Record<string, string> = { name: params.customerName }
  if (params.customerPhone) customer.contact = params.customerPhone

  const res = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      description: params.invoiceNumber,
      customer,
      notify: { sms: false, email: false },
      reminder_enable: false,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    // T-9-05: log status + capped body only; no key values
    console.error(JSON.stringify({
      event: 'razorpay_error',
      status: res.status,
      body_preview: errText.slice(0, 200),
    }))
    throw new Error(`Razorpay API error: ${res.status}`)
  }

  const data = await res.json()
  return data.short_url as string
}

// =============================================================================
// Main Edge Function
// =============================================================================

Deno.serve(async (req: Request) => {
  const startTime = Date.now()

  // ── Auth guard (T-9-05; mirrors low-stock-digest pattern verbatim) ──────────
  // SUPABASE_SERVICE_ROLE_KEY is auto-injected but not readable via Deno.env in
  // all Supabase Edge Function runtimes — use BOT_SERVICE_KEY as explicit mirror.
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceKey = Deno.env.get('BOT_SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Env vars ───────────────────────────────────────────────────────────────
  const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN') ?? ''
  const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? ''
  const NEXT_PUBLIC_APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? ''

  // ── Supabase service-role client (D-03: bypasses RLS) ─────────────────────
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, {
    auth: { persistSession: false },
  })

  // ── Parse webhook payload ──────────────────────────────────────────────────
  let body: WebhookPayload
  try {
    body = await req.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const value = body?.entry?.[0]?.changes?.[0]?.value
  const messages = value?.messages

  // ── status-only event guard — skip delivery receipts, read receipts, etc. ──
  if (!messages || messages.length === 0) {
    console.log(JSON.stringify({ event: 'whatsapp_bot_status_only', ts: new Date().toISOString() }))
    return new Response('OK', { status: 200 })
  }

  const message: WhatsAppMessage = messages[0]
  const from: string = message.from              // E.164 without '+', e.g. '919876543210'
  const wamid: string = message.id               // wamid.xxx
  const messageText: string = message.text?.body ?? ''
  const messageType: string = message.type

  // ── Entry log (T-9-05: no token values) ──────────────────────────────────
  console.log(JSON.stringify({
    event: 'whatsapp_bot_received',
    wamid,
    from,
    message_type: messageType,
    ts: new Date().toISOString(),
  }))

  // ── Non-text guard (D-defer: ignore audio/image/video) ────────────────────
  if (messageType !== 'text') {
    try {
      await sendWhatsAppMessage(
        WHATSAPP_PHONE_NUMBER_ID,
        WHATSAPP_TOKEN,
        from,
        'Please reply with text only.',
      )
    } catch (err) {
      console.error(JSON.stringify({
        event: 'whatsapp_non_text_reply_failed',
        from,
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }))
    }
    return new Response('OK', { status: 200 })
  }

  // ==========================================================================
  // Task 2: bot_code lookup + session load + reduce() + persist
  // ==========================================================================

  const now_iso = new Date().toISOString()

  // ── 1. Try parseStart to get a bot_code candidate ─────────────────────────
  const botCodeCandidate = parseStart(messageText)

  // ── 2. Resolve company via bot_code (D-03: service role bypasses RLS) ─────
  let companyId: string | null = null
  let companyBotCode: string | null = null
  let botCodeMatch: { company_id: string; bot_code: string } | null = null

  if (botCodeCandidate) {
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, bot_code')
      .eq('bot_code', botCodeCandidate)
      .maybeSingle()

    if (!companyError && company) {
      companyId = company.id
      companyBotCode = company.bot_code
      botCodeMatch = { company_id: company.id, bot_code: company.bot_code }
      console.log(JSON.stringify({
        event: 'bot_code_resolved',
        bot_code: company.bot_code,
        company_id: companyId,
        ts: now_iso,
      }))
    } else {
      // Unknown bot_code — state machine will handle the reply
      botCodeMatch = null
    }
  }

  // ── 3. Load existing session ───────────────────────────────────────────────
  let sessionCompanyId: string | null = companyId

  // If no START and no company from bot_code, check for existing session
  if (!companyId) {
    // Need to find company from existing session — search all sessions for this phone
    // Since service role bypasses RLS, we can query without company_id
    // But we need a company_id to scope the session lookup — use phone-only fallback
    const { data: existingSession } = await supabase
      .from('whatsapp_sessions')
      .select('company_id, state, cart, expires_at, last_processed_wamid')
      .eq('customer_phone', from)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSession) {
      sessionCompanyId = existingSession.company_id
      companyId = existingSession.company_id

      // Re-fetch bot_code for this company for re-prompt messages
      const { data: co } = await supabase
        .from('companies')
        .select('bot_code')
        .eq('id', companyId)
        .maybeSingle()
      if (co?.bot_code) {
        companyBotCode = co.bot_code
        botCodeMatch = { company_id: companyId, bot_code: co.bot_code }
      }
    }
  }

  // ── Orphan guard: no START + no existing session → cannot process ─────────
  if (!sessionCompanyId) {
    console.log(JSON.stringify({
      event: 'orphan_message',
      from,
      wamid,
      ts: now_iso,
    }))
    return new Response('OK', { status: 200 })
  }

  // ── Load session for this (company_id, phone) pair ────────────────────────
  const { data: sessionRow, error: sessionError } = await supabase
    .from('whatsapp_sessions')
    .select('id, state, cart, expires_at, last_processed_wamid')
    .eq('company_id', sessionCompanyId)
    .eq('customer_phone', from)
    .maybeSingle()

  if (sessionError) {
    console.error(JSON.stringify({
      event: 'session_load_error',
      error: sessionError.message,
      company_id: sessionCompanyId,
      from,
      ts: now_iso,
    }))
    return new Response('Internal Server Error', { status: 500 })
  }

  console.log(JSON.stringify({
    event: 'session_loaded',
    session_id: sessionRow?.id ?? null,
    state: sessionRow?.state ?? 'none',
    company_id: sessionCompanyId,
    from,
    ts: now_iso,
  }))

  // Build SessionSnapshot for state machine
  const sessionSnapshot: SessionSnapshot | null = sessionRow
    ? {
        state: sessionRow.state as SessionSnapshot['state'],
        cart: (sessionRow.cart as CartItem[]) ?? [],
        expires_at: sessionRow.expires_at ?? null,
        last_processed_wamid: sessionRow.last_processed_wamid ?? null,
      }
    : null

  // ── 4. Load catalog (products in stock, capped at 20 for message length) ──
  const { data: catalogRows, error: catalogError } = await supabase
    .from('products')
    .select('id, name, selling_price, tax_rate')
    .eq('company_id', sessionCompanyId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(20)

  if (catalogError) {
    console.error(JSON.stringify({
      event: 'catalog_load_error',
      error: catalogError.message,
      company_id: sessionCompanyId,
      ts: now_iso,
    }))
    // Proceed with empty catalog — state machine will still function for IDLE/CART_REVIEW states
  }

  const catalog: CatalogEntry[] = (catalogRows ?? []).map(p => ({
    product_id: p.id,
    name: p.name,
    unit_price: Number(p.selling_price),
    in_stock: true,
  }))

  // ── 5. Call pure state machine reducer ────────────────────────────────────
  const reduceOutput = reduce({
    session: sessionSnapshot,
    message_text: messageText,
    wamid,
    now_iso,
    catalog,
    bot_code_match: botCodeMatch,
  })

  console.log(JSON.stringify({
    event: 'reduce_result',
    reply_kind: reduceOutput.reply.kind,
    next_state: reduceOutput.next_state,
    cart_items: reduceOutput.next_cart.length,
    wamid,
    ts: now_iso,
  }))

  // ── 6. Noop short-circuit (D-09 duplicate wamid) ─────────────────────────
  if (reduceOutput.reply.kind === 'noop') {
    console.log(JSON.stringify({
      event: 'duplicate_wamid_skip',
      wamid,
      from,
      ts: now_iso,
    }))
    return new Response('OK', { status: 200 })
  }

  // ── 7. Persist new session state ──────────────────────────────────────────
  const { error: upsertError } = await supabase
    .from('whatsapp_sessions')
    .upsert(
      {
        company_id: sessionCompanyId,
        customer_phone: from,
        state: reduceOutput.next_state,
        cart: reduceOutput.next_cart,
        expires_at: reduceOutput.next_expires_at,
        last_processed_wamid: reduceOutput.next_last_processed_wamid,
        last_message_at: now_iso,
        status: 'active',
      },
      { onConflict: 'company_id,customer_phone' },
    )

  if (upsertError) {
    console.error(JSON.stringify({
      event: 'session_upsert_error',
      error: upsertError.message,
      company_id: sessionCompanyId,
      from,
      ts: now_iso,
    }))
    return new Response('Internal Server Error', { status: 500 })
  }

  console.log(JSON.stringify({
    event: 'session_persisted',
    next_state: reduceOutput.next_state,
    company_id: sessionCompanyId,
    from,
    ts: now_iso,
  }))

  // ── 8. Handle reply.kind === 'text' ───────────────────────────────────────
  if (reduceOutput.reply.kind === 'text') {
    try {
      await sendWhatsAppMessage(
        WHATSAPP_PHONE_NUMBER_ID,
        WHATSAPP_TOKEN,
        from,
        reduceOutput.reply.text,
      )
      console.log(JSON.stringify({
        event: 'whatsapp_text_sent',
        to: from,
        state: reduceOutput.next_state,
        duration_ms: Date.now() - startTime,
        ts: new Date().toISOString(),
      }))
    } catch (err) {
      console.error(JSON.stringify({
        event: 'whatsapp_send_failed',
        to: from,
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }))
    }
    return new Response('OK', { status: 200 })
  }

  // ==========================================================================
  // Tasks 3a + 3b: invoice_request branch
  // ==========================================================================

  if (reduceOutput.reply.kind === 'invoice_request') {
    // ── Task 3a: Dedup guard (D-10) ─────────────────────────────────────────
    const { data: existingInvoice, error: dedupError } = await supabase
      .from('invoices')
      .select('id, public_id, payment_link_url')
      .eq('source_wamid', wamid)
      .maybeSingle()

    if (dedupError) {
      console.error(JSON.stringify({
        event: 'dedup_check_error',
        error: dedupError.message,
        wamid,
        ts: now_iso,
      }))
    }

    if (existingInvoice) {
      // Already processed — re-send existing payment link
      console.log(JSON.stringify({
        event: 'duplicate_invoice_skip',
        invoice_id: existingInvoice.id,
        wamid,
        ts: now_iso,
      }))
      const existingPaymentUrl = existingInvoice.payment_link_url ?? ''
      if (existingPaymentUrl) {
        try {
          await sendWhatsAppMessage(
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN,
            from,
            `Your invoice is ready. Pay here: ${existingPaymentUrl}`,
          )
          // WA-07 upsell (also on replay)
          await sendWhatsAppMessage(
            WHATSAPP_PHONE_NUMBER_ID,
            WHATSAPP_TOKEN,
            from,
            `Track your orders anytime: ${NEXT_PUBLIC_APP_URL}/my`,
          )
        } catch (err) {
          console.error(JSON.stringify({
            event: 'replay_send_failed',
            error: err instanceof Error ? err.message : String(err),
            ts: new Date().toISOString(),
          }))
        }
      }
      return new Response('OK', { status: 200 })
    }

    // ── Resolve customer (or create minimal row) ───────────────────────────
    let customerId: string
    let customerName: string

    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, name')
      .eq('company_id', sessionCompanyId)
      .eq('phone', from)
      .maybeSingle()

    if (existingCustomer) {
      customerId = existingCustomer.id
      customerName = existingCustomer.name ?? 'WhatsApp Customer'
    } else {
      // Create minimal customer record (WA-06: customer_phone on invoice provides /my link)
      const { data: newCustomer, error: customerInsertError } = await supabase
        .from('customers')
        .insert({
          company_id: sessionCompanyId,
          name: 'WhatsApp Customer',
          phone: from,
          customer_type: 'b2c',
        })
        .select('id, name')
        .single()

      if (customerInsertError || !newCustomer) {
        console.error(JSON.stringify({
          event: 'customer_create_error',
          error: customerInsertError?.message ?? 'no row returned',
          from,
          ts: now_iso,
        }))
        return new Response('Internal Server Error', { status: 500 })
      }
      customerId = newCustomer.id
      customerName = 'WhatsApp Customer'
    }

    // ── Tax computation (per INVOICE-08 + RESEARCH §6) ────────────────────
    // Build catalog map for tax_rate lookup
    const catalogMap = new Map(
      (catalogRows ?? []).map(p => [p.id, Number(p.tax_rate ?? 0)]),
    )

    let subtotal = 0
    let cgst_amount = 0
    let sgst_amount = 0

    const cartForInvoice = reduceOutput.next_cart

    for (const item of cartForInvoice) {
      const taxRate = catalogMap.get(item.product_id) ?? 0
      const itemTotal = item.total
      subtotal += itemTotal
      // CGST = SGST = rate/2 of item total; total tax = rate% of item total
      const itemCgst = Math.round(itemTotal * taxRate / 200 * 100) / 100
      const itemSgst = itemCgst
      cgst_amount += itemCgst
      sgst_amount += itemSgst
    }

    // Round to 2 decimal places
    subtotal = Math.round(subtotal * 100) / 100
    cgst_amount = Math.round(cgst_amount * 100) / 100
    sgst_amount = Math.round(sgst_amount * 100) / 100
    const total_amount = Math.round((subtotal + cgst_amount + sgst_amount) * 100) / 100

    // ── Generate invoice number via RPC ───────────────────────────────────
    const today = new Date().toISOString().split('T')[0]
    const { data: invoiceNumber, error: invNumError } = await supabase.rpc(
      'generate_invoice_number',
      { p_company_id: sessionCompanyId, p_date: today },
    )

    if (invNumError || !invoiceNumber) {
      console.error(JSON.stringify({
        event: 'invoice_number_rpc_error',
        error: invNumError?.message ?? 'no invoice number returned',
        company_id: sessionCompanyId,
        ts: now_iso,
      }))
      return new Response('Internal Server Error', { status: 500 })
    }

    // ── Insert invoice row ────────────────────────────────────────────────
    const { data: insertedInvoice, error: invoiceInsertError } = await supabase
      .from('invoices')
      .insert({
        company_id: sessionCompanyId,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        invoice_date: today,
        subtotal,
        cgst_amount,
        sgst_amount,
        total_amount,
        payment_status: 'unpaid',
        customer_phone: from,
        source_wamid: wamid,
        doc_type: 'sale',
      })
      .select('id, public_id')
      .single()

    if (invoiceInsertError || !insertedInvoice) {
      console.error(JSON.stringify({
        event: 'invoice_insert_error',
        error: invoiceInsertError?.message ?? 'no row returned',
        company_id: sessionCompanyId,
        ts: now_iso,
      }))
      return new Response('Internal Server Error', { status: 500 })
    }

    // ── Bulk-insert invoice_items ─────────────────────────────────────────
    const invoiceItems = cartForInvoice.map(item => {
      const taxRate = catalogMap.get(item.product_id) ?? 0
      const itemCgst = Math.round(item.total * taxRate / 200 * 100) / 100
      const itemSgst = itemCgst
      return {
        invoice_id: insertedInvoice.id,
        company_id: sessionCompanyId,
        product_id: item.product_id,
        description: item.name,
        quantity: item.qty,
        unit_price: item.unit_price,
        total_amount: item.total,
        cgst_amount: itemCgst,
        sgst_amount: itemSgst,
      }
    })

    const { error: itemsInsertError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems)

    if (itemsInsertError) {
      console.error(JSON.stringify({
        event: 'invoice_items_insert_error',
        error: itemsInsertError.message,
        invoice_id: insertedInvoice.id,
        ts: now_iso,
      }))
      // Non-fatal — invoice row exists; proceed to Razorpay
    }

    console.log(JSON.stringify({
      event: 'invoice_db_written',
      invoice_id: insertedInvoice.id,
      public_id: insertedInvoice.public_id,
      total_amount,
      item_count: invoiceItems.length,
      ts: now_iso,
    }))

    // =======================================================================
    // Task 3b: Razorpay + WhatsApp sends
    // =======================================================================

    let paymentLinkUrl: string | null = null

    try {
      paymentLinkUrl = await createRazorpayPaymentLink({
        invoiceId: insertedInvoice.id,
        invoiceNumber,
        totalAmount: total_amount,
        customerName,
        customerPhone: from,
      })
    } catch (err) {
      // Graceful fallback (RESEARCH §5 edge case)
      console.error(JSON.stringify({
        event: 'razorpay_link_failed',
        invoice_id: insertedInvoice.id,
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }))

      // Update invoice with null payment_link_url so record is complete
      await supabase
        .from('invoices')
        .update({ payment_link_url: null })
        .eq('id', insertedInvoice.id)

      // Send fallback message
      try {
        await sendWhatsAppMessage(
          WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN,
          from,
          "Could not generate payment link. Your order is saved — our team will contact you.",
        )
        // Still send WA-07 upsell even on Razorpay failure
        await sendWhatsAppMessage(
          WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN,
          from,
          `Track your orders anytime: ${NEXT_PUBLIC_APP_URL}/my`,
        )
      } catch (sendErr) {
        console.error(JSON.stringify({
          event: 'fallback_send_failed',
          error: sendErr instanceof Error ? sendErr.message : String(sendErr),
          ts: new Date().toISOString(),
        }))
      }

      return new Response('OK', { status: 200 })
    }

    // ── Update invoice with payment link URL ─────────────────────────────
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ payment_link_url: paymentLinkUrl })
      .eq('id', insertedInvoice.id)

    if (updateError) {
      console.error(JSON.stringify({
        event: 'invoice_update_payment_link_error',
        error: updateError.message,
        invoice_id: insertedInvoice.id,
        ts: new Date().toISOString(),
      }))
      // Non-fatal — continue with the payment link we have
    }

    // ── Send invoice WhatsApp message ─────────────────────────────────────
    const formattedTotal = total_amount.toFixed(2)
    try {
      await sendWhatsAppMessage(
        WHATSAPP_PHONE_NUMBER_ID,
        WHATSAPP_TOKEN,
        from,
        `Your invoice ${invoiceNumber} for ₹${formattedTotal} is ready. Pay here: ${paymentLinkUrl}`,
      )
    } catch (err) {
      console.error(JSON.stringify({
        event: 'invoice_send_failed',
        invoice_id: insertedInvoice.id,
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }))
    }

    // ── WA-07 Upsell message (sent AFTER invoice, sequentially) ──────────
    try {
      await sendWhatsAppMessage(
        WHATSAPP_PHONE_NUMBER_ID,
        WHATSAPP_TOKEN,
        from,
        `Track your orders anytime: ${NEXT_PUBLIC_APP_URL}/my`,
      )
    } catch (err) {
      console.error(JSON.stringify({
        event: 'upsell_send_failed',
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }))
    }

    console.log(JSON.stringify({
      event: 'invoice_created',
      invoice_id: insertedInvoice.id,
      public_id: insertedInvoice.public_id,
      payment_link_url: paymentLinkUrl,
      total_amount,
      duration_ms: Date.now() - startTime,
      ts: new Date().toISOString(),
    }))

    return new Response('OK', { status: 200 })
  }

  // ── Fallback (unreachable under normal operation) ─────────────────────────
  return new Response('OK', { status: 200 })
})
