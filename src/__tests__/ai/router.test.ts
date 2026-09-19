/**
 * Intent router tests — AI-01
 * RED → GREEN via TDD (Plan 11-02)
 */

import { classifyIntent, normalize } from '@/lib/ai/router'
import type { Intent } from '@/lib/ai/router'

/**
 * The payload fields carried by the Intent variants that have them. Assertions
 * below check one field at a time, so exposing them all as optional is more
 * useful than narrowing to a single variant per test.
 */
type IntentPayload = Partial<{
  product: string
  reference: string
  period: string
  customer: string
}>

/**
 * Strips the discriminant, leaving just the payload. Destructuring keeps this
 * fully type-checked — no cast, so a renamed field breaks the build here
 * rather than silently returning undefined at runtime.
 */
function payload(intent: Intent | null): IntentPayload {
  if (!intent) return {}
  const { type: _type, ...rest } = intent
  return rest
}

describe('normalize', () => {
  it('lowercases input', () => {
    expect(normalize('GSTR-1')).toBe('gstr 1')
  })

  it('replaces punctuation with spaces', () => {
    expect(normalize('INV-2025-0042')).toBe('inv 2025 0042')
  })

  it('collapses multiple spaces', () => {
    expect(normalize('sales  today')).toBe('sales today')
  })

  it('trims leading/trailing whitespace', () => {
    expect(normalize('  sales today  ')).toBe('sales today')
  })
})

describe('classifyIntent — stock queries', () => {
  it('matches "how many X do I have" [AI-01]', () => {
    const r = classifyIntent('how many rice bags do I have')
    expect(r?.type).toBe('stock_query')
    expect(payload(r)?.product).toMatch(/rice/i)
  })

  it('matches "stock of X" [AI-01]', () => {
    const r = classifyIntent('stock of basmati rice')
    expect(r?.type).toBe('stock_query')
    expect(payload(r)?.product).toMatch(/basmati rice/i)
  })

  it('matches "units of X left" [AI-01]', () => {
    const r = classifyIntent('units of sugar left')
    expect(r?.type).toBe('stock_query')
    expect(payload(r)?.product).toMatch(/sugar/i)
  })

  it('matches "qty of X available" [AI-01]', () => {
    const r = classifyIntent('qty of wheat flour available')
    expect(r?.type).toBe('stock_query')
    expect(payload(r)?.product).toMatch(/wheat flour/i)
  })

  it('matches "inventory of X" [AI-01]', () => {
    const r = classifyIntent('inventory of salt')
    expect(r?.type).toBe('stock_query')
    expect(payload(r)?.product).toMatch(/salt/i)
  })

  it('matches "do I have X in stock" [AI-01]', () => {
    const r = classifyIntent('do I have any mustard oil in stock')
    expect(r?.type).toBe('stock_query')
    expect(payload(r)?.product).toMatch(/mustard oil/i)
  })
})

describe('classifyIntent — invoice status', () => {
  it('matches "overdue invoices" [AI-01]', () => {
    expect(classifyIntent('overdue invoices')?.type).toBe('overdue_invoices')
  })

  it('matches "unpaid invoices" [AI-01]', () => {
    expect(classifyIntent('unpaid invoices')?.type).toBe('overdue_invoices')
  })

  it('matches "pending invoices" [AI-01]', () => {
    expect(classifyIntent('pending invoices')?.type).toBe('overdue_invoices')
  })

  it('matches specific invoice reference [AI-01]', () => {
    const r = classifyIntent('status of invoice INV-2025-26-0042')
    expect(r?.type).toBe('invoice_status')
    expect(payload(r)?.reference).toMatch(/INV-2025-26-0042/i)
  })

  it('matches short invoice number [AI-01]', () => {
    const r = classifyIntent('where is invoice 0042')
    expect(r?.type).toBe('invoice_status')
    expect(payload(r)?.reference).toMatch(/0042/)
  })
})

describe('classifyIntent — GST deadlines', () => {
  it('matches "GSTR-1 filing deadline" [AI-01]', () => {
    const r = classifyIntent('GSTR-1 filing deadline')
    expect(r?.type).toBe('gst_deadline')
    expect(payload(r)?.period).toBe('1')
  })

  it('matches "GSTR-3B due date" [AI-01]', () => {
    const r = classifyIntent('GSTR-3B due date')
    expect(r?.type).toBe('gst_deadline')
    expect(payload(r)?.period).toBe('3b')
  })

  it('matches "GSTR-9 when is it due" [AI-01]', () => {
    const r = classifyIntent('GSTR-9 when is it due')
    expect(r?.type).toBe('gst_deadline')
    expect(payload(r)?.period).toBe('9')
  })

  it('matches lowercase gst-1 [AI-01]', () => {
    const r = classifyIntent('when is gst-1 due')
    expect(r?.type).toBe('gst_deadline')
    expect(payload(r)?.period).toBe('1')
  })

  it('defaults to GSTR-1 for generic "gst filing deadline" [AI-01]', () => {
    const r = classifyIntent('gst filing deadline')
    expect(r?.type).toBe('gst_deadline')
    expect(payload(r)?.period).toBe('1')
  })
})

describe('classifyIntent — sales & revenue', () => {
  it('matches "sales today" [AI-01]', () => {
    expect(classifyIntent('sales today')?.type).toBe('sales_today')
  })

  it("matches \"today's sales\" [AI-01]", () => {
    expect(classifyIntent("today's sales")?.type).toBe('sales_today')
  })

  it('matches "sales this month" [AI-01]', () => {
    expect(classifyIntent('sales this month')?.type).toBe('sales_mtd')
  })

  it('matches "monthly sales" [AI-01]', () => {
    expect(classifyIntent('monthly sales')?.type).toBe('sales_mtd')
  })

  it('matches "revenue this year" [AI-01]', () => {
    expect(classifyIntent('revenue this year')?.type).toBe('revenue_ytd')
  })

  it('matches "total revenue ytd" [AI-01]', () => {
    expect(classifyIntent('total revenue ytd')?.type).toBe('revenue_ytd')
  })
})

describe('classifyIntent — products & stock alerts', () => {
  it('matches "top selling products" [AI-01]', () => {
    expect(classifyIntent('top selling products')?.type).toBe('top_products')
  })

  it('matches "best selling items" [AI-01]', () => {
    expect(classifyIntent('best selling items')?.type).toBe('top_products')
  })

  it('matches "low stock products" [AI-01]', () => {
    expect(classifyIntent('low stock products')?.type).toBe('low_stock')
  })

  it('matches "low stock items" [AI-01]', () => {
    expect(classifyIntent('low stock items')?.type).toBe('low_stock')
  })
})

describe('classifyIntent — payments', () => {
  it('matches "pending payments" [AI-01]', () => {
    expect(classifyIntent('pending payments')?.type).toBe('pending_payments')
  })

  it('matches "outstanding payments" [AI-01]', () => {
    expect(classifyIntent('outstanding payments')?.type).toBe('pending_payments')
  })

  it('matches customer balance query [AI-01]', () => {
    const r = classifyIntent('customer balance of Sharma Traders')
    expect(r?.type).toBe('customer_balance')
    expect(payload(r)?.customer).toMatch(/sharma traders/i)
  })

  it('matches "balance for X" [AI-01]', () => {
    const r = classifyIntent('balance for Raj Enterprises')
    expect(r?.type).toBe('customer_balance')
    expect(payload(r)?.customer).toMatch(/raj enterprises/i)
  })
})

describe('classifyIntent — Groq fallback (null returns)', () => {
  it('returns null for gibberish [AI-01]', () => {
    expect(classifyIntent('xyzzy gibberish query')).toBeNull()
  })

  it('returns null for off-topic queries [AI-01]', () => {
    expect(classifyIntent('tell me a joke')).toBeNull()
  })

  it('returns null for weather query [AI-01]', () => {
    expect(classifyIntent('what is the weather')).toBeNull()
  })

  it('returns null for empty string [AI-01]', () => {
    expect(classifyIntent('')).toBeNull()
  })
})
