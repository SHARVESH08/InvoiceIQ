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

/**
 * formatCatalog — returns numbered list of catalog items for the greeting reply.
 * e.g. "1. Widget — ₹100\n2. Gadget — ₹200"
 */
function formatCatalog(catalog: CatalogEntry[]): string {
  return catalog
    .map((entry, i) => `${i + 1}. ${entry.name} — ₹${entry.unit_price}`)
    .join('\n')
}

/**
 * cartTotal — sums total field across all CartItems.
 */
function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.total, 0)
}

/**
 * formatCartSummary — returns line-by-line cart summary.
 * e.g. "Widget x1 — ₹100\nGadget x1 — ₹200"
 */
function formatCartSummary(cart: CartItem[]): string {
  return cart
    .map(item => `${item.name} x${item.qty} — ₹${item.total}`)
    .join('\n')
}

/**
 * computeExpiresAt — adds 30 minutes to now_iso, returns ISO string.
 * Uses only Date.parse + arithmetic (no Date.now — deterministic).
 */
function computeExpiresAt(now_iso: string): string {
  return new Date(Date.parse(now_iso) + 30 * 60 * 1000).toISOString()
}

// =============================================================================
// Exported parsers
// =============================================================================

/**
 * parseStart — extracts the bot_code from a START-{CODE} message.
 *
 * Returns the code string (as-matched, preserving input case) if pattern matches,
 * null otherwise.
 *
 * Pattern: /^START-([A-Z0-9_-]+)$/i
 * Examples:
 *   parseStart('START-SHOP01') → 'SHOP01'
 *   parseStart('start-abc')   → 'abc'   (preserves case of input segment)
 *   parseStart('hello')       → null
 *   parseStart('START-')      → null    (empty code not allowed)
 */
export function parseStart(text: string): string | null {
  const match = text.trim().match(/^START-([A-Z0-9_-]+)$/i)
  return match ? match[1] : null
}

/**
 * parseNumber — parses a 1-based item selection number.
 *
 * Returns n if 1 ≤ n ≤ max, null otherwise.
 */
export function parseNumber(text: string, max: number): number | null {
  const n = parseInt(text.trim(), 10)
  if (isNaN(n) || n < 1 || n > max) return null
  return n
}

// =============================================================================
// Core reducer
// =============================================================================

/**
 * reduce — pure state machine reducer.
 *
 * Decision tree:
 *
 * 1. D-09 Duplicate-wamid short-circuit:
 *    if session.last_processed_wamid === wamid → return noop (no state change).
 *
 * 2. D-08 Expiry check:
 *    if session.expires_at && now_iso > session.expires_at → treat session as null (fresh IDLE).
 *
 * 3. Determine effective_state from session (or 'idle' when null).
 *
 * 4. Branch by state:
 *    IDLE:
 *      - parseStart(text) valid AND bot_code_match present → CATALOG_SENT + catalog greeting (D-05)
 *      - parseStart valid BUT bot_code_match null → IDLE + "bot code not recognised" error
 *      - anything else → IDLE + "Send START-{bot_code} to begin" re-prompt (D-07)
 *
 *    CATALOG_SENT / ITEM_SELECTION:
 *      - text.trim().toUpperCase() === 'DONE':
 *          cart empty  → same state + "empty cart" re-prompt (D-06)
 *          cart filled → CART_REVIEW + cart summary with YES/NO prompt
 *      - parseNumber(text, catalog.length) valid:
 *          → append catalog[n-1] as CartItem, state → ITEM_SELECTION + confirmation (D-05, D-06)
 *      - else → same state + re-prompt (D-07)
 *
 *    CART_REVIEW:
 *      - 'YES' (case-insensitive) → INVOICE_SENT + invoice_request reply (cart preserved)
 *      - 'NO'  (case-insensitive) → IDLE + cancellation reply, cart cleared
 *      - else → CART_REVIEW + "please reply YES or NO" re-prompt (D-07)
 *
 *    INVOICE_SENT:
 *      - any new message → recurse with session=null (treat as fresh IDLE greeting)
 *
 * 5. D-08 TTL refresh: next_expires_at = now_iso + 30min on every non-noop output.
 *
 * 6. Set next_last_processed_wamid = wamid on every non-noop output.
 *
 * No side effects: no DB writes, no network calls, no Date.now().
 */
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

  // Shorthand builder
  function out(
    next_state: SessionState,
    next_cart: CartItem[],
    reply: Reply,
  ): ReduceOutput {
    return { next_state, next_cart, reply, next_expires_at, next_last_processed_wamid: wamid }
  }

  // ---------------------------------------------------------------------------
  // Branch by effective state
  // ---------------------------------------------------------------------------

  // INVOICE_SENT — any new message resets to fresh IDLE
  if (effectiveState === STATES.INVOICE_SENT) {
    return reduce({ ...input, session: null })
  }

  // IDLE
  if (effectiveState === STATES.IDLE) {
    const code = parseStart(text)

    if (code !== null) {
      // Valid START pattern received
      if (bot_code_match === null) {
        // Unknown bot_code
        return out(STATES.IDLE, [], {
          kind: 'text',
          text: "Sorry, that bot code isn't recognised. Please check with the retailer.",
        })
      }
      // Known bot_code → send catalog (D-05: numbered list)
      const catalogList = formatCatalog(catalog)
      return out(STATES.CATALOG_SENT, [], {
        kind: 'text',
        text: `Welcome! Here's our catalog:\n${catalogList}\n\nReply with a number to add to cart, or DONE to checkout.`,
      })
    }

    // Non-START text at IDLE
    return out(STATES.IDLE, currentCart, {
      kind: 'text',
      text: `Send START-${bot_code_match?.bot_code ?? '{bot_code}'} to begin ordering.`,
    })
  }

  // CATALOG_SENT or ITEM_SELECTION — item selection or DONE
  if (effectiveState === STATES.CATALOG_SENT || effectiveState === STATES.ITEM_SELECTION) {
    const upper = text.toUpperCase()

    if (upper === 'DONE') {
      if (currentCart.length === 0) {
        // Empty cart — re-prompt
        return out(effectiveState, currentCart, {
          kind: 'text',
          text: 'Your cart is empty. Reply a number to add items.',
        })
      }
      // Cart has items → CART_REVIEW
      const lines = formatCartSummary(currentCart)
      const total = cartTotal(currentCart)
      return out(STATES.CART_REVIEW, currentCart, {
        kind: 'text',
        text: `Your cart:\n${lines}\n\nTotal: ₹${total}\n\nReply YES to confirm or NO to cancel.`,
      })
    }

    // Number selection
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

    // Unrecognised — re-prompt with context (D-07)
    if (effectiveState === STATES.CATALOG_SENT) {
      return out(STATES.CATALOG_SENT, currentCart, {
        kind: 'text',
        text: `Reply a number (1-${catalog.length}) to add an item, or DONE if you're done.`,
      })
    }
    // ITEM_SELECTION
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

    // Unrecognised at CART_REVIEW
    return out(STATES.CART_REVIEW, currentCart, {
      kind: 'text',
      text: 'Please reply YES to confirm or NO to cancel.',
    })
  }

  // Fallback — should never reach here given exhaustive state coverage
  return out(STATES.IDLE, [], {
    kind: 'text',
    text: `Send START-${bot_code_match?.bot_code ?? '{bot_code}'} to begin ordering.`,
  })
}
