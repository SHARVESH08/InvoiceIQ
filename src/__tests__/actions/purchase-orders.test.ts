/**
 * Phase 12 Plan 02 — PO Server Actions Tests
 * Covers: SUPPLY-01 (lookupDistributorByGstin), SUPPLY-02 (createPurchaseOrder),
 *         SUPPLY-03 (dispatch_po_and_create_invoice, receive_po_and_update_inventory)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Mock supabase/server ──────────────────────────────────────────────────────
const mockSupabaseUser = { id: 'user-uuid-123' }
const mockCompanyId = 'company-uuid-oem'

const mockSupabaseFrom = vi.fn()
const mockSupabaseRpc = vi.fn()
const mockSupabaseAuth = {
  getUser: vi.fn().mockResolvedValue({
    data: { user: mockSupabaseUser },
    error: null,
  }),
}

const mockSupabaseClient = {
  auth: mockSupabaseAuth,
  from: mockSupabaseFrom,
  rpc: mockSupabaseRpc,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
}))

// ── Mock supabase/admin ───────────────────────────────────────────────────────
const mockAdminFrom = vi.fn()
const mockAdminAuthAdmin = {
  getUserById: vi.fn(),
}
const mockAdminClient = {
  from: mockAdminFrom,
  auth: {
    admin: mockAdminAuthAdmin,
  },
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue(mockAdminClient),
}))

// ── Mock resend ───────────────────────────────────────────────────────────────
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'email-id' }),
    },
  })),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build chainable query mock
// ─────────────────────────────────────────────────────────────────────────────

function buildChain(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(resolveWith),
    single: vi.fn().mockResolvedValue(resolveWith),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(resolveWith),
    order: vi.fn(),
  }
  // All chaining methods (non-terminal) return the chain itself so fluent calls work
  ;['select', 'eq', 'limit', 'order', 'insert', 'update', 'delete'].forEach((method) => {
    chain[method].mockReturnValue(chain)
  })
  // Terminal methods resolve with the provided value
  chain['maybeSingle'] = vi.fn().mockResolvedValue(resolveWith)
  chain['single'] = vi.fn().mockResolvedValue(resolveWith)
  // Allow insert().select().single() — single is already terminal above
  // Allow standalone insert (without chained select) — also resolves
  // The chain's `insert` now returns `chain`, and `chain.single` resolves.
  return chain
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()

  // Default: auth resolves successfully
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: mockSupabaseUser },
    error: null,
  })

  // Default: get_company_id RPC returns OEM company id
  mockSupabaseRpc.mockImplementation((rpcName: string) => {
    if (rpcName === 'get_company_id') {
      return Promise.resolve({ data: mockCompanyId, error: null })
    }
    // requirePermission() resolves the caller's role through this RPC.
    if (rpcName === 'get_company_role') {
      return Promise.resolve({ data: 'admin', error: null })
    }
    if (rpcName === 'get_company_context') {
      return Promise.resolve({
        data: { company_id: mockCompanyId, company_type: 'OEM' },
        error: null,
      })
    }
    return Promise.resolve({ data: null, error: { message: `Unknown RPC: ${rpcName}` } })
  })
})

// ── lookupDistributorByGstin ──────────────────────────────────────────────────

describe('lookupDistributorByGstin', () => {
  it('returns company for valid Distributor GSTIN', async () => {
    const { lookupDistributorByGstin } = await import(
      '@/lib/actions/purchase-orders'
    )

    const distId = 'dist-company-uuid'
    const chain = buildChain({
      data: { id: distId, name: 'XYZ Distributors', company_type: 'Distributor' },
      error: null,
    })
    mockAdminFrom.mockReturnValue(chain)

    const result = await lookupDistributorByGstin('33AABCD1234E1ZK')

    expect(result).toEqual({ company: { id: distId, name: 'XYZ Distributors' } })
    expect(mockAdminFrom).toHaveBeenCalledWith('companies')
  })

  it('returns error when GSTIN belongs to an OEM company (not Distributor)', async () => {
    const { lookupDistributorByGstin } = await import(
      '@/lib/actions/purchase-orders'
    )

    const chain = buildChain({
      data: { id: 'oem-uuid', name: 'Some OEM', company_type: 'OEM' },
      error: null,
    })
    mockAdminFrom.mockReturnValue(chain)

    const result = await lookupDistributorByGstin('33AABCD1234E1ZK')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('OEM')
      expect(result.error).toContain('not a Distributor')
    }
  })

  it('returns error when GSTIN not found', async () => {
    const { lookupDistributorByGstin } = await import(
      '@/lib/actions/purchase-orders'
    )

    const chain = buildChain({ data: null, error: null })
    mockAdminFrom.mockReturnValue(chain)

    const result = await lookupDistributorByGstin('NOTFOUND')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('No distributor found')
    }
  })
})

// ── createPurchaseOrder ───────────────────────────────────────────────────────

describe('createPurchaseOrder', () => {
  it('returns error when distributor_company_id belongs to OEM, not Distributor', async () => {
    const { createPurchaseOrder } = await import(
      '@/lib/actions/purchase-orders'
    )

    // Admin client returns OEM-type company for distributor_company_id validation
    const adminDistChain = buildChain({
      data: { company_type: 'OEM', name: 'Some OEM Co' },
      error: null,
    })
    mockAdminFrom.mockReturnValue(adminDistChain)

    const result = await createPurchaseOrder({
      distributor_company_id: '550e8400-e29b-41d4-a716-446655440000',
      items: [
        {
          product_id: '550e8400-e29b-41d4-a716-446655440001',
          quantity_ordered: 10,
          unit_price: 100,
        },
      ],
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('not a Distributor')
    }
  })

  it('inserts PO with company_id from RPC not from client', async () => {
    const { createPurchaseOrder } = await import(
      '@/lib/actions/purchase-orders'
    )

    const insertedPoId = 'new-po-uuid'

    // Admin client calls: (1) distributor validation, (2) pricing_alerts insert,
    // (3) company_users lookup for email
    let adminCallCount = 0
    mockAdminFrom.mockImplementation(() => {
      adminCallCount++
      if (adminCallCount === 1) {
        return buildChain({
          data: { company_type: 'Distributor', name: 'XYZ Dist' },
          error: null,
        })
      }
      // pricing_alerts insert and company_users lookup — return benign data
      return buildChain({ data: null, error: null })
    })

    // Supabase client from calls
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'companies') {
        return buildChain({ data: { name: 'My OEM Company' }, error: null })
      }
      if (table === 'purchase_orders') {
        return buildChain({ data: { id: insertedPoId }, error: null })
      }
      if (table === 'purchase_order_items') {
        return buildChain({ data: [], error: null })
      }
      return buildChain({ data: null, error: null })
    })

    const result = await createPurchaseOrder({
      distributor_company_id: '550e8400-e29b-41d4-a716-446655440000',
      items: [
        {
          product_id: '550e8400-e29b-41d4-a716-446655440001',
          quantity_ordered: 5,
          unit_price: 200,
        },
      ],
    })

    // company_id must come from get_company_id() RPC, not from client input
    expect(mockSupabaseRpc).toHaveBeenCalledWith('get_company_id')
    // Result should contain the new PO id
    expect('poId' in result).toBe(true)
    if ('poId' in result) {
      expect(result.poId).toBe(insertedPoId)
    }
  })

  it('returns error on Zod validation failure (items array empty)', async () => {
    const { createPurchaseOrder } = await import(
      '@/lib/actions/purchase-orders'
    )

    const result = await createPurchaseOrder({
      distributor_company_id: '550e8400-e29b-41d4-a716-446655440000',
      items: [], // violates min(1)
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('line item')
    }
  })
})

// ── dispatchPO ────────────────────────────────────────────────────────────────

describe('dispatch_po_and_create_invoice RPC', () => {
  it('returns error when dispatch_po_and_create_invoice RPC fails', async () => {
    const { dispatchPO } = await import('@/lib/actions/purchase-orders')

    mockSupabaseRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_company_id') {
        return Promise.resolve({ data: mockCompanyId, error: null })
      }
      if (rpcName === 'get_company_role') {
        return Promise.resolve({ data: 'admin', error: null })
      }
      if (rpcName === 'dispatch_po_and_create_invoice') {
        return Promise.resolve({
          data: null,
          error: { message: 'PO not found or not in confirmed status' },
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const result = await dispatchPO('po-uuid-123')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('PO not found or not in confirmed status')
    }
  })

  it('atomicity: invoice insert failure leaves PO in confirmed status (RPC error returned)', async () => {
    const { dispatchPO } = await import('@/lib/actions/purchase-orders')

    // Simulate the RPC raising an exception (what PostgreSQL returns on atomic failure)
    mockSupabaseRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_company_id') {
        return Promise.resolve({ data: mockCompanyId, error: null })
      }
      if (rpcName === 'get_company_role') {
        return Promise.resolve({ data: 'admin', error: null })
      }
      if (rpcName === 'dispatch_po_and_create_invoice') {
        return Promise.resolve({
          data: null,
          error: { message: 'invoice insert failed, transaction rolled back' },
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const result = await dispatchPO('po-uuid-123')

    // The server action must return an error — PO status remains confirmed at DB level
    expect('error' in result).toBe(true)
  })
})

// ── receive_po_and_update_inventory RPC ───────────────────────────────────────

describe('receive_po_and_update_inventory RPC', () => {
  it('increments Distributor inventory on receipt (returns invoiceId)', async () => {
    const { receivePO } = await import('@/lib/actions/purchase-orders')

    const receiptInvoiceId = 'receipt-invoice-uuid'

    mockSupabaseRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_company_id') {
        return Promise.resolve({ data: mockCompanyId, error: null })
      }
      if (rpcName === 'get_company_role') {
        return Promise.resolve({ data: 'admin', error: null })
      }
      if (rpcName === 'receive_po_and_update_inventory') {
        return Promise.resolve({ data: receiptInvoiceId, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    mockSupabaseFrom.mockReturnValue(
      buildChain({ data: { invoice_number: 'PINV-2026-001' }, error: null })
    )

    const result = await receivePO('po-uuid-123', 'godown-uuid-789')

    expect('invoiceId' in result).toBe(true)
    if ('invoiceId' in result) {
      expect(result.invoiceId).toBe(receiptInvoiceId)
      expect(result.invoiceNumber).toBe('PINV-2026-001')
    }
  })

  it('returns error when receive_po_and_update_inventory RPC fails', async () => {
    const { receivePO } = await import('@/lib/actions/purchase-orders')

    mockSupabaseRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_company_id') {
        return Promise.resolve({ data: mockCompanyId, error: null })
      }
      if (rpcName === 'get_company_role') {
        return Promise.resolve({ data: 'admin', error: null })
      }
      if (rpcName === 'receive_po_and_update_inventory') {
        return Promise.resolve({
          data: null,
          error: { message: 'Product not found in Distributor catalog' },
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const result = await receivePO('po-uuid-123', 'godown-uuid-789')

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('Product not found in Distributor catalog')
    }
  })
})
