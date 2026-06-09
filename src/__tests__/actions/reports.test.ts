/**
 * Phase 12 Plan 04 — Reports server actions tests
 * Covers: REPORTS-01 (getPnlSummary), REPORTS-02 (getHsnSummary)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ─── Hoist mocks so they are available inside vi.mock factory ─────────────────
const { mockRpc, mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: mockGetUser,
    },
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

// Import after mock is set up
import { getPnlSummary, getHsnSummary } from '@/lib/actions/reports'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupAuthFail() {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Not authenticated') })
}

// ─── getPnlSummary ────────────────────────────────────────────────────────────

describe('getPnlSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns correct revenue, COGS, gross_margin for date range', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_company_id') return Promise.resolve({ data: 'company-1', error: null })
      if (fn === 'get_pnl_summary') {
        return Promise.resolve({
          data: { revenue: 100, cogs: 60, gross_margin: 40 },
          error: null,
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const result = await getPnlSummary('2026-04-01', '2026-06-30')

    expect(result).toEqual({
      revenue: 100,
      cogs: 60,
      gross_margin: 40,
      margin_percent: 40,
    })
  })

  it('returns margin_percent = 0 when revenue is 0', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_company_id') return Promise.resolve({ data: 'company-1', error: null })
      if (fn === 'get_pnl_summary') {
        return Promise.resolve({
          data: { revenue: 0, cogs: 0, gross_margin: 0 },
          error: null,
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const result = await getPnlSummary('2026-04-01', '2026-06-30')
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.margin_percent).toBe(0)
    }
  })

  it('returns { error } when not authenticated', async () => {
    setupAuthFail()

    const result = await getPnlSummary('2026-04-01', '2026-06-30')
    expect(result).toEqual({ error: 'Not authenticated' })
  })
})

// ─── getHsnSummary ────────────────────────────────────────────────────────────

describe('getHsnSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('groups invoice_items by hsn_code correctly', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: 'company-1', error: null })

    const fakeItems = [
      {
        hsn_code: '8471',
        quantity: 10,
        taxable_amount: 1000,
        cgst_amount: 90,
        sgst_amount: 90,
        igst_amount: 0,
        invoices: { invoice_date: '2026-04-15', doc_type: 'sale', status: 'sent', company_id: 'company-1' },
      },
      {
        hsn_code: '8471',
        quantity: 5,
        taxable_amount: 500,
        cgst_amount: 45,
        sgst_amount: 45,
        igst_amount: 0,
        invoices: { invoice_date: '2026-05-10', doc_type: 'sale', status: 'sent', company_id: 'company-1' },
      },
    ]

    const queryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: fakeItems, error: null }),
    }
    mockFrom.mockReturnValue(queryChain)

    const result = await getHsnSummary('2026-04-01', '2026-06-30')

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]).toEqual({
        hsn_code: '8471',
        taxable_value: 1500,
        cgst: 135,
        sgst: 135,
        igst: 0,
        total_tax: 270,
      })
    }
  })

  it('returns multiple rows sorted by taxable_value descending', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: 'company-1', error: null })

    const fakeItems = [
      { hsn_code: '1001', quantity: 1, taxable_amount: 200, cgst_amount: 18, sgst_amount: 18, igst_amount: 0, invoices: {} },
      { hsn_code: '2002', quantity: 1, taxable_amount: 800, cgst_amount: 72, sgst_amount: 72, igst_amount: 0, invoices: {} },
    ]

    const queryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: fakeItems, error: null }),
    }
    mockFrom.mockReturnValue(queryChain)

    const result = await getHsnSummary('2026-04-01', '2026-06-30')

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.rows[0].hsn_code).toBe('2002')
      expect(result.rows[1].hsn_code).toBe('1001')
    }
  })

  it('returns { error } when not authenticated', async () => {
    setupAuthFail()

    const result = await getHsnSummary('2026-04-01', '2026-06-30')
    expect(result).toEqual({ error: 'Not authenticated' })
  })
})
