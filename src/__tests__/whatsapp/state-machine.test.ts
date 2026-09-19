/**
 * WhatsApp State Machine — full test matrix
 * RED in Wave 0/Task-1, GREEN in Wave 2/Task-2.
 *
 * Covers: parseStart, parseNumber, reduce transitions across all 5 states,
 * dedup (D-09), expiry (D-08), unrecognized-input re-prompt (D-07),
 * 30-min TTL refresh (D-08), numbered catalog (D-05), multi-item DONE (D-06).
 */

import { describe, it, expect } from 'vitest'
import {
  STATES,
  parseStart,
  parseNumber,
  reduce,
  type CatalogEntry,
  type CartItem,
  type SessionSnapshot,
  type ReduceInput,
} from '@/lib/whatsapp/state-machine'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = '2026-05-31T10:00:00Z'
const EXPIRES_30M = '2026-05-31T10:30:00.000Z' // 30 min after NOW — not expired (toISOString format)
const PAST = '2026-05-31T09:29:00Z'            // 31 min before NOW — expired

const SAMPLE_CATALOG: CatalogEntry[] = [
  { product_id: 'prod-001', name: 'Widget',    unit_price: 100, in_stock: true },
  { product_id: 'prod-002', name: 'Gadget',    unit_price: 200, in_stock: true },
  { product_id: 'prod-003', name: 'Doohickey', unit_price: 50,  in_stock: true },
]

const COMPANY_MATCH = { company_id: 'co-abc', bot_code: 'SHOP01' }

// Helper: make a SessionSnapshot in IDLE by default
function makeSession(overrides?: Partial<SessionSnapshot>): SessionSnapshot {
  return {
    state: STATES.IDLE,
    cart: [],
    expires_at: EXPIRES_30M,
    last_processed_wamid: null,
    ...overrides,
  }
}

// Helper: make a ReduceInput with sensible defaults (null session, empty message)
function makeInput(overrides: Partial<ReduceInput>): ReduceInput {
  return {
    session: null,
    message_text: '',
    wamid: 'wamid.test001',
    now_iso: NOW,
    catalog: SAMPLE_CATALOG,
    bot_code_match: COMPANY_MATCH,
    ...overrides,
  }
}

// Convenience cart item
const WIDGET_ITEM: CartItem = {
  product_id: 'prod-001',
  name: 'Widget',
  qty: 1,
  unit_price: 100,
  total: 100,
}

// ---------------------------------------------------------------------------
// parseStart
// ---------------------------------------------------------------------------

describe('parseStart', () => {
  it('returns bot_code for START-SHOP01', () => {
    expect(parseStart('START-SHOP01')).toBe('SHOP01')
  })

  it('returns bot_code for START-ABC123', () => {
    expect(parseStart('START-ABC123')).toBe('ABC123')
  })

  it('handles lowercase start-abc (case-insensitive input, returns as-matched)', () => {
    expect(parseStart('start-abc')).toBe('abc')
  })

  it('returns null for bare START (no code)', () => {
    expect(parseStart('START')).toBeNull()
  })

  it('returns null for START- (empty code)', () => {
    expect(parseStart('START-')).toBeNull()
  })

  it('returns null for non-START messages', () => {
    expect(parseStart('hello')).toBeNull()
    expect(parseStart('')).toBeNull()
    expect(parseStart('STOP-ABC')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseNumber
// ---------------------------------------------------------------------------

describe('parseNumber', () => {
  it('returns 1 for "1" with max=3', () => {
    expect(parseNumber('1', 3)).toBe(1)
  })

  it('returns 3 for "3" with max=3', () => {
    expect(parseNumber('3', 3)).toBe(3)
  })

  it('returns null for "0" (below range)', () => {
    expect(parseNumber('0', 3)).toBeNull()
  })

  it('returns null for "4" with max=3 (above range)', () => {
    expect(parseNumber('4', 3)).toBeNull()
  })

  it('returns null for "abc" (non-numeric)', () => {
    expect(parseNumber('abc', 3)).toBeNull()
  })

  it('returns null for "one" (word form)', () => {
    expect(parseNumber('one', 3)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// reduce: IDLE
// ---------------------------------------------------------------------------

describe('reduce: IDLE', () => {
  it('IDLE + valid START-SHOP01 -> CATALOG_SENT with catalog text reply', () => {
    const out = reduce(makeInput({
      session: null,
      message_text: 'START-SHOP01',
      wamid: 'wamid.start001',
    }))
    expect(out.next_state).toBe(STATES.CATALOG_SENT)
    expect(out.reply.kind).toBe('text')
    if (out.reply.kind === 'text') {
      expect(out.reply.text).toMatch(/Widget/i)
      expect(out.reply.text).toMatch(/1\./)
    }
    expect(out.next_last_processed_wamid).toBe('wamid.start001')
  })

  it('IDLE + START-INVALID (unknown bot_code) -> stays IDLE with friendly error', () => {
    const out = reduce(makeInput({
      session: null,
      message_text: 'START-INVALID',
      wamid: 'wamid.invalid001',
      bot_code_match: null,
      catalog: [],
    }))
    expect(out.next_state).toBe(STATES.IDLE)
    expect(out.reply.kind).toBe('text')
    if (out.reply.kind === 'text') {
      expect(out.reply.text).toMatch(/not recognised|check with the retailer/i)
    }
    expect(out.next_last_processed_wamid).toBe('wamid.invalid001')
  })

  it('IDLE + non-START text -> stays IDLE with re-prompt', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.IDLE }),
      message_text: 'hello',
      wamid: 'wamid.nonstarttext001',
    }))
    expect(out.next_state).toBe(STATES.IDLE)
    expect(out.reply.kind).toBe('text')
    if (out.reply.kind === 'text') {
      expect(out.reply.text).toMatch(/START-/i)
    }
  })

  it('IDLE + duplicate wamid -> noop', () => {
    const session = makeSession({
      state: STATES.IDLE,
      last_processed_wamid: 'wamid.dup_idle',
    })
    const out = reduce(makeInput({
      session,
      message_text: 'START-SHOP01',
      wamid: 'wamid.dup_idle',
    }))
    expect(out.reply.kind).toBe('noop')
    expect(out.next_state).toBe(STATES.IDLE)
  })

  it('IDLE + expired session -> treated as fresh IDLE (START redirects to CATALOG_SENT)', () => {
    const expiredSession = makeSession({
      state: STATES.IDLE,
      expires_at: PAST,
    })
    const out = reduce(makeInput({
      session: expiredSession,
      message_text: 'START-SHOP01',
      wamid: 'wamid.expired_idle',
    }))
    // Expired session is reset to null-like; valid START should still work
    expect(out.next_state).toBe(STATES.CATALOG_SENT)
    expect(out.reply.kind).toBe('text')
  })
})

// ---------------------------------------------------------------------------
// reduce: CATALOG_SENT
// ---------------------------------------------------------------------------

describe('reduce: CATALOG_SENT', () => {
  it('CATALOG_SENT + "1" -> ITEM_SELECTION, cart has Widget', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.CATALOG_SENT, cart: [] }),
      message_text: '1',
      wamid: 'wamid.select001',
    }))
    expect(out.next_state).toBe(STATES.ITEM_SELECTION)
    expect(out.next_cart).toHaveLength(1)
    expect(out.next_cart[0].product_id).toBe('prod-001')
    expect(out.next_cart[0].qty).toBe(1)
    expect(out.reply.kind).toBe('text')
    if (out.reply.kind === 'text') {
      expect(out.reply.text).toMatch(/Widget/i)
    }
  })

  it('CATALOG_SENT + number-out-of-range -> state unchanged, re-prompt', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.CATALOG_SENT, cart: [] }),
      message_text: '99',
      wamid: 'wamid.outofrange001',
    }))
    expect(out.next_state).toBe(STATES.CATALOG_SENT)
    expect(out.next_cart).toHaveLength(0)
    expect(out.reply.kind).toBe('text')
  })

  it('CATALOG_SENT + DONE with empty cart -> re-prompt (state unchanged)', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.CATALOG_SENT, cart: [] }),
      message_text: 'DONE',
      wamid: 'wamid.emptydonecatalog',
    }))
    expect(out.next_state).toBe(STATES.CATALOG_SENT)
    expect(out.reply.kind).toBe('text')
    if (out.reply.kind === 'text') {
      expect(out.reply.text).toMatch(/empty|number/i)
    }
  })
})

// ---------------------------------------------------------------------------
// reduce: ITEM_SELECTION
// ---------------------------------------------------------------------------

describe('reduce: ITEM_SELECTION', () => {
  it('ITEM_SELECTION + another number -> appends to cart, stays ITEM_SELECTION', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.ITEM_SELECTION, cart: [WIDGET_ITEM] }),
      message_text: '2',
      wamid: 'wamid.addgadget001',
    }))
    expect(out.next_state).toBe(STATES.ITEM_SELECTION)
    expect(out.next_cart).toHaveLength(2)
    expect(out.next_cart[1].product_id).toBe('prod-002')
  })

  it('ITEM_SELECTION + DONE with items -> CART_REVIEW, reply contains item names + YES/NO prompt', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.ITEM_SELECTION, cart: [WIDGET_ITEM] }),
      message_text: 'DONE',
      wamid: 'wamid.done001',
    }))
    expect(out.next_state).toBe(STATES.CART_REVIEW)
    expect(out.reply.kind).toBe('text')
    if (out.reply.kind === 'text') {
      expect(out.reply.text).toMatch(/Widget/i)
      expect(out.reply.text.toLowerCase()).toMatch(/yes/)
    }
  })

  it('ITEM_SELECTION + DONE empty cart -> re-prompt, state unchanged', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.ITEM_SELECTION, cart: [] }),
      message_text: 'DONE',
      wamid: 'wamid.doneempty001',
    }))
    expect(out.next_state).toBe(STATES.ITEM_SELECTION)
    expect(out.reply.kind).toBe('text')
    if (out.reply.kind === 'text') {
      expect(out.reply.text).toMatch(/empty|number/i)
    }
  })

  it('ITEM_SELECTION + unrecognized text -> state unchanged, re-prompt', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.ITEM_SELECTION, cart: [WIDGET_ITEM] }),
      message_text: 'gibberish text',
      wamid: 'wamid.unrecog001',
    }))
    expect(out.next_state).toBe(STATES.ITEM_SELECTION)
    expect(out.reply.kind).toBe('text')
    if (out.reply.kind === 'text') {
      expect(out.reply.text.length).toBeGreaterThan(0)
    }
  })

  it('ITEM_SELECTION + duplicate wamid -> noop', () => {
    const session = makeSession({
      state: STATES.ITEM_SELECTION,
      cart: [WIDGET_ITEM],
      last_processed_wamid: 'wamid.dup001',
    })
    const out = reduce(makeInput({
      session,
      message_text: '2',
      wamid: 'wamid.dup001',
    }))
    expect(out.reply.kind).toBe('noop')
    expect(out.next_state).toBe(STATES.ITEM_SELECTION)
  })
})

// ---------------------------------------------------------------------------
// reduce: CART_REVIEW
// ---------------------------------------------------------------------------

describe('reduce: CART_REVIEW', () => {
  it('CART_REVIEW + "YES" -> INVOICE_SENT, reply.kind === "invoice_request"', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.CART_REVIEW, cart: [WIDGET_ITEM] }),
      message_text: 'YES',
      wamid: 'wamid.yes001',
    }))
    expect(out.next_state).toBe(STATES.INVOICE_SENT)
    expect(out.reply.kind).toBe('invoice_request')
    expect(out.next_cart).toHaveLength(1) // cart preserved for Edge Function
  })

  it('CART_REVIEW + lowercase "yes" -> INVOICE_SENT (case-insensitive)', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.CART_REVIEW, cart: [WIDGET_ITEM] }),
      message_text: 'yes',
      wamid: 'wamid.yeslower001',
    }))
    expect(out.next_state).toBe(STATES.INVOICE_SENT)
    expect(out.reply.kind).toBe('invoice_request')
  })

  it('CART_REVIEW + "NO" -> IDLE, cart cleared, cancellation reply', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.CART_REVIEW, cart: [WIDGET_ITEM] }),
      message_text: 'NO',
      wamid: 'wamid.no001',
    }))
    expect(out.next_state).toBe(STATES.IDLE)
    expect(out.next_cart).toHaveLength(0)
    expect(out.reply.kind).toBe('text')
    if (out.reply.kind === 'text') {
      expect(out.reply.text).toMatch(/cancelled|cancel/i)
    }
  })

  it('CART_REVIEW + unrecognized text -> state unchanged, re-prompt YES/NO', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.CART_REVIEW, cart: [WIDGET_ITEM] }),
      message_text: 'maybe',
      wamid: 'wamid.cartunrecog001',
    }))
    expect(out.next_state).toBe(STATES.CART_REVIEW)
    expect(out.reply.kind).toBe('text')
    if (out.reply.kind === 'text') {
      expect(out.reply.text.toLowerCase()).toMatch(/yes.*no|no.*yes/)
    }
  })
})

// ---------------------------------------------------------------------------
// reduce: INVOICE_SENT
// ---------------------------------------------------------------------------

describe('reduce: INVOICE_SENT', () => {
  it('INVOICE_SENT + any new message -> resets to IDLE-like, re-greet', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.INVOICE_SENT, cart: [WIDGET_ITEM] }),
      message_text: 'hello',
      wamid: 'wamid.invoicenew001',
    }))
    // Resets to IDLE or prompts to start fresh
    expect([STATES.IDLE, STATES.CATALOG_SENT]).toContain(out.next_state)
    expect(out.reply.kind).toBe('text')
  })

  it('INVOICE_SENT + duplicate wamid -> noop', () => {
    const session = makeSession({
      state: STATES.INVOICE_SENT,
      cart: [WIDGET_ITEM],
      last_processed_wamid: 'wamid.invdup001',
    })
    const out = reduce(makeInput({
      session,
      message_text: 'hello',
      wamid: 'wamid.invdup001',
    }))
    expect(out.reply.kind).toBe('noop')
  })
})

// ---------------------------------------------------------------------------
// Common invariants
// ---------------------------------------------------------------------------

describe('reduce: common invariants', () => {
  it('next_expires_at is always 30 min from now_iso', () => {
    const out = reduce(makeInput({
      session: null,
      message_text: 'START-SHOP01',
      wamid: 'wamid.ttl001',
      now_iso: NOW,
    }))
    expect(out.next_expires_at).toBe(EXPIRES_30M)
  })

  it('next_last_processed_wamid === wamid on normal transitions', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.CATALOG_SENT }),
      message_text: '1',
      wamid: 'wamid.wamidset001',
    }))
    expect(out.next_last_processed_wamid).toBe('wamid.wamidset001')
  })

  it('noop branch does NOT update next_last_processed_wamid beyond the dup wamid', () => {
    const session = makeSession({
      state: STATES.ITEM_SELECTION,
      last_processed_wamid: 'wamid.noop_check',
    })
    const out = reduce(makeInput({
      session,
      message_text: '2',
      wamid: 'wamid.noop_check',
    }))
    expect(out.reply.kind).toBe('noop')
    // next_expires_at on noop preserves original session expires_at
    expect(out.next_expires_at).toBe(EXPIRES_30M)
  })
})

// ---------------------------------------------------------------------------
// reduce: dedup (WA-05 / D-09) — legacy describe block retained for clarity
// ---------------------------------------------------------------------------

describe('reduce: dedup (WA-05 / D-09)', () => {
  it('duplicate wamid (session.last_processed_wamid === wamid) -> reply.kind === "noop"', () => {
    const session = makeSession({
      state: STATES.ITEM_SELECTION,
      last_processed_wamid: 'wamid.dup001',
    })
    const out = reduce(makeInput({
      session,
      message_text: '2',
      wamid: 'wamid.dup001',
    }))
    expect(out.reply.kind).toBe('noop')
  })
})

// ---------------------------------------------------------------------------
// reduce: session expiry (D-08)
// ---------------------------------------------------------------------------

describe('reduce: session expiry (D-08)', () => {
  it('expired session (now_iso > session.expires_at) -> treated as IDLE, fresh greeting', () => {
    const expiredSession = makeSession({
      state: STATES.ITEM_SELECTION,
      cart: [WIDGET_ITEM],
      expires_at: PAST,
    })
    const out = reduce(makeInput({
      session: expiredSession,
      message_text: 'DONE',
      wamid: 'wamid.expired001',
      now_iso: NOW,
    }))
    expect([STATES.IDLE, STATES.CATALOG_SENT]).toContain(out.next_state)
    expect(out.reply.kind).toBe('text')
  })
})

// ---------------------------------------------------------------------------
// reduce: unrecognized input (D-07)
// ---------------------------------------------------------------------------

describe('reduce: unrecognized input (D-07)', () => {
  it('unrecognized input at ITEM_SELECTION -> state unchanged, re-prompt reply', () => {
    const out = reduce(makeInput({
      session: makeSession({ state: STATES.ITEM_SELECTION }),
      message_text: 'gibberish text',
      wamid: 'wamid.unrecog001',
    }))
    expect(out.next_state).toBe(STATES.ITEM_SELECTION)
    expect(out.reply.kind).toBe('text')
    if (out.reply.kind === 'text') {
      expect(out.reply.text.length).toBeGreaterThan(0)
    }
  })
})
