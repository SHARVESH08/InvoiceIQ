// Copied from src/lib/whatsapp/state-machine.ts (Plan 09-04).
// Single source of truth in src; this is the Deno-compatible deploy mirror.
// TODO: If you update src/lib/whatsapp/state-machine.ts, sync this file.

/**
 * WhatsApp Bot State Machine — pure-function reducer.
 *
 * State diagram (ASCII):
 *
 *   IDLE ──[START-{code}]──► CATALOG_SENT ──[number]──► ITEM_SELECTION
 *     ▲                                                       │
 *     │                   [DONE, cart empty]◄────────────────┤
 *     │                                                       │ [DONE, cart > 0]
 *     │                                                       ▼
 *     │◄──────────────[NO]────── CART_REVIEW ◄───────────────┘
 *     │                               │
 *     │                             [YES]
 *     │                               ▼
 *     └───────[any new msg]──── INVOICE_SENT
 *
 * Decision rules implemented here:
 *   D-05  Numbered catalog (1-based item selection)
 *   D-06  Multi-item via repeated selection; DONE to finalise cart
 *   D-07  Re-prompt with current context on unrecognised input (state unchanged)
 *   D-08  30-min TTL refreshed on every message; expired session → fresh IDLE
 *   D-09  Duplicate wamid → noop short-circuit (last_processed_wamid check)
 *   D-10  source_wamid on invoice surfaced via invoice_request reply (Edge Function persists)
 *
 * IMPORTANT: No imports, no I/O, no Date.now() — all side-effects are outside this file.
 */

// =============================================================================
// State constants (lowercase — canonical casing prevents DB string mismatch)
// =============================================================================

export const STATES = {
  IDLE: 'idle',
  CATALOG_SENT: 'catalog_sent',
  ITEM_SELECTION: 'item_selection',
  CART_REVIEW: 'cart_review',
  INVOICE_SENT: 'invoice_sent',
} as const

export type SessionState = (typeof STATES)[keyof typeof STATES]

// =============================================================================
// Domain types
// =============================================================================

export interface CartItem {
  product_id: string
  name: string
  qty: number
  unit_price: number
  total: number
}

export interface CatalogEntry {
  product_id: string
  name: string
  unit_price: number
  in_stock: boolean
}

export interface SessionSnapshot {
  state: SessionState
  cart: CartItem[]
  expires_at: string | null   // ISO timestamp
  last_processed_wamid: string | null
}

export interface ReduceInput {
  session: SessionSnapshot | null   // null when no prior row
  message_text: string
  wamid: string
  now_iso: string                   // injected for determinism
  catalog: CatalogEntry[]           // resolved by caller (Edge Function)
  bot_code_match: { company_id: string; bot_code: string } | null  // resolved by caller
}

export type Reply =
  | { kind: 'text'; text: string }
  | { kind: 'invoice_request' }     // signals Edge Function to create invoice
  | { kind: 'noop' }                // duplicate wamid / status-only event

export interface ReduceOutput {
  next_state: SessionState
  next_cart: CartItem[]
  reply: Reply
  next_expires_at: string           // ISO timestamp
  next_last_processed_wamid: string
}

// =============================================================================
// Pure helpers
// =============================================================================

function formatCatalog(catalog: CatalogEntry[]): string {
  return catalog
    .map((entry, i) => `${i + 1}. ${entry.name} — ₹${entry.unit_price}`)
    .join('\n')
}

function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.total, 0)
}

function formatCartSummary(cart: CartItem[]): string {
  return cart
    .map(item => `${item.name} x${item.qty} — ₹${item.total}`)
    .join('\n')
}

function computeExpiresAt(now_iso: string): string {
  return new Date(Date.parse(now_iso) + 30 * 60 * 1000).toISOString()
}

// =============================================================================
// Exported parsers
// =============================================================================

export function parseStart(text: string): string | null {
  const match = text.trim().match(/^START-([A-Z0-9_-]+)$/i)
  return match ? match[1] : null
}

export function parseNumber(text: string, max: number): number | null {
  const n = parseInt(text.trim(), 10)
  if (isNaN(n) || n < 1 || n > max) return null
  return n
}

// =============================================================================
// Core reducer
// =============================================================================

export function reduce(input: ReduceInput): ReduceOutput {
  const { session, message_text, wamid, now_iso, catalog, bot_code_match } = input
  const text = message_text.trim()

  // --- D-09: Duplicate wamid short-circuit ---
  if (session !== null && session.last_processed_wamid === wamid) {
    return {
      next_state: session.state,
      next_cart: session.cart,
      reply: { kind: 'noop' },
      next_expires_at: session.expires_at ?? computeExpiresAt(now_iso),
      next_last_processed_wamid: wamid,
    }
  }

  // --- D-08: Expiry check — treat expired session as null (fresh IDLE) ---
  let effectiveSession: SessionSnapshot | null = session
  if (
    effectiveSession !== null &&
    effectiveSession.expires_at !== null &&
    now_iso > effectiveSession.expires_at
  ) {
    effectiveSession = null
  }

  const effectiveState: SessionState = effectiveSession?.state ?? STATES.IDLE
  const currentCart: CartItem[] = effectiveSession?.cart ?? []
  const next_expires_at = computeExpiresAt(now_iso)

  function out(
    next_state: SessionState,
    next_cart: CartItem[],
    reply: Reply,
  ): ReduceOutput {
    return { next_state, next_cart, reply, next_expires_at, next_last_processed_wamid: wamid }
  }

  // INVOICE_SENT — any new message resets to fresh IDLE
  if (effectiveState === STATES.INVOICE_SENT) {
    return reduce({ ...input, session: null })
  }

  // IDLE
  if (effectiveState === STATES.IDLE) {
    const code = parseStart(text)

    if (code !== null) {
      if (bot_code_match === null) {
        return out(STATES.IDLE, [], {
          kind: 'text',
          text: "Sorry, that bot code isn't recognised. Please check with the retailer.",
        })
      }
      const catalogList = formatCatalog(catalog)
      return out(STATES.CATALOG_SENT, [], {
        kind: 'text',
        text: `Welcome! Here's our catalog:\n${catalogList}\n\nReply with a number to add to cart, or DONE to checkout.`,
      })
    }

    return out(STATES.IDLE, currentCart, {
      kind: 'text',
      text: `Send START-${bot_code_match?.bot_code ?? '{bot_code}'} to begin ordering.`,
    })
  }

  // CATALOG_SENT or ITEM_SELECTION
  if (effectiveState === STATES.CATALOG_SENT || effectiveState === STATES.ITEM_SELECTION) {
    const upper = text.toUpperCase()

    if (upper === 'DONE') {
      if (currentCart.length === 0) {
        return out(effectiveState, currentCart, {
          kind: 'text',
          text: 'Your cart is empty. Reply a number to add items.',
        })
      }
      const lines = formatCartSummary(currentCart)
      const total = cartTotal(currentCart)
      return out(STATES.CART_REVIEW, currentCart, {
        kind: 'text',
        text: `Your cart:\n${lines}\n\nTotal: ₹${total}\n\nReply YES to confirm or NO to cancel.`,
      })
    }

    const n = parseNumber(text, catalog.length)
    if (n !== null) {
      const entry = catalog[n - 1]
      const newItem: CartItem = {
        product_id: entry.product_id,
        name: entry.name,
        qty: 1,
        unit_price: entry.unit_price,
        total: entry.unit_price,
      }
      const newCart = [...currentCart, newItem]
      return out(STATES.ITEM_SELECTION, newCart, {
        kind: 'text',
        text: `${entry.name} added. Cart: ${newCart.length} item(s). Reply another number or DONE to checkout.`,
      })
    }

    if (effectiveState === STATES.CATALOG_SENT) {
      return out(STATES.CATALOG_SENT, currentCart, {
        kind: 'text',
        text: `Reply a number (1-${catalog.length}) to add an item, or DONE if you're done.`,
      })
    }
    return out(STATES.ITEM_SELECTION, currentCart, {
      kind: 'text',
      text: `I didn't understand. Reply a number (1-${catalog.length}) to add an item, or DONE to checkout.`,
    })
  }

  // CART_REVIEW
  if (effectiveState === STATES.CART_REVIEW) {
    const upper = text.toUpperCase()

    if (upper === 'YES') {
      return out(STATES.INVOICE_SENT, currentCart, { kind: 'invoice_request' })
    }

    if (upper === 'NO') {
      const botCode = bot_code_match?.bot_code ?? '{bot_code}'
      return out(STATES.IDLE, [], {
        kind: 'text',
        text: `Order cancelled. Send START-${botCode} to order again.`,
      })
    }

    return out(STATES.CART_REVIEW, currentCart, {
      kind: 'text',
      text: 'Please reply YES to confirm or NO to cancel.',
    })
  }

  // Fallback
  return out(STATES.IDLE, [], {
    kind: 'text',
    text: `Send START-${bot_code_match?.bot_code ?? '{bot_code}'} to begin ordering.`,
  })
}
