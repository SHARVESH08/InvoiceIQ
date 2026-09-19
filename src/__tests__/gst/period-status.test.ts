import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { computeGstr1, updatePeriodStatus } from '@/lib/actions/gst'
import { createClient } from '@/lib/supabase/server'

const mockMaybySingle = vi.fn()
const mockUpsert = vi.fn()
const mockInvoiceLte = vi.fn()

function setupClient(user: object | null = { id: 'u1' }, companyId: string | null = 'c1') {
  const gstChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybySingle: mockMaybySingle,
    maybeSingle: mockMaybySingle,
    upsert: mockUpsert,
  }
  const invoiceChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: mockInvoiceLte,
  }
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : new Error('not authenticated'),
      }),
    },
    // get_company_role feeds requirePermission(); everything else is
    // get_company_id. 'admin' preserves the pre-IAM behaviour of these tests.
    rpc: vi.fn().mockImplementation((fn: string) =>
      Promise.resolve({ data: fn === 'get_company_role' ? 'admin' : companyId, error: null })
    ),
    from: vi.fn().mockImplementation((table: string) =>
      table === 'invoices' ? invoiceChain : gstChain
    ),
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

describe('computeGstr1 period status guard [GST-06]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMaybySingle.mockResolvedValue({ data: null, error: null })
    mockUpsert.mockResolvedValue({ error: null })
    mockInvoiceLte.mockResolvedValue({ data: [], error: null })
    setupClient()
  })

  it('filed period returns { error: "Period is filed and cannot be modified." } [GST-06]', async () => {
    mockMaybySingle.mockResolvedValue({ data: { status: 'filed' }, error: null })
    const result = await computeGstr1('2025-26', '04')
    expect(result).toEqual({ error: 'Period is filed and cannot be modified.' })
  })

  it('draft period allows computation and returns data [GST-06]', async () => {
    mockMaybySingle.mockResolvedValue({ data: { status: 'draft' }, error: null })
    const result = await computeGstr1('2025-26', '04')
    expect(result).toHaveProperty('success', true)
  })

  it('ready period allows computation and returns data [GST-06]', async () => {
    mockMaybySingle.mockResolvedValue({ data: { status: 'ready' }, error: null })
    const result = await computeGstr1('2025-26', '04')
    expect(result).toHaveProperty('success', true)
  })

  it('unauthenticated returns { error: "Not authenticated" } [GST-06]', async () => {
    setupClient(null, null)
    const result = await computeGstr1('2025-26', '04')
    expect(result).toEqual({ error: 'Not authenticated' })
  })
})

describe('updatePeriodStatus [GST-06]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMaybySingle.mockResolvedValue({ data: null, error: null })
    mockUpsert.mockResolvedValue({ error: null })
    setupClient()
  })

  it('filing a period transitions status from ready to filed [GST-06]', async () => {
    mockMaybySingle.mockResolvedValue({ data: { status: 'ready' }, error: null })
    const result = await updatePeriodStatus('GSTR-1', '2025-26', '04', 'filed')
    expect(result).toHaveProperty('success', true)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'filed', filed_at: expect.any(String) }),
      expect.any(Object)
    )
  })

  it('cannot modify a filed period [GST-06]', async () => {
    mockMaybySingle.mockResolvedValue({ data: { status: 'filed' }, error: null })
    const result = await updatePeriodStatus('GSTR-1', '2025-26', '04', 'draft')
    expect(result).toEqual({ error: 'Period is filed and cannot be modified.' })
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})
