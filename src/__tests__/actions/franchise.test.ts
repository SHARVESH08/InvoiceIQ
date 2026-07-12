/**
 * Franchise server actions tests (Workstream 3)
 * Covers: group creation validation, GSTIN invite lookup, invite response,
 * company switcher membership gating, HQ aggregate readers.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const {
  mockRpc,
  mockFrom,
  mockGetUser,
  mockAdminFrom,
  mockUpdateUserById,
} = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockUpdateUserById: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: mockAdminFrom,
    auth: { admin: { updateUserById: mockUpdateUserById } },
  }),
}))

import {
  createFranchiseGroup,
  findCompanyByGstin,
  respondToFranchiseInvite,
  switchActiveCompany,
  getFranchiseOverview,
  getMyMemberships,
} from '@/lib/actions/franchise'

// Valid GSTIN format for lookup tests (structure-valid sample)
const VALID_GSTIN = '27AAPFU0939F1ZV'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── createFranchiseGroup ─────────────────────────────────────────────────────

describe('createFranchiseGroup', () => {
  it('rejects names shorter than 2 characters without calling the RPC', async () => {
    const result = await createFranchiseGroup(' a ')
    expect(result).toEqual({ error: 'Name too short' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('calls create_franchise_group with the trimmed name', async () => {
    mockRpc.mockResolvedValue({ data: 'group-1', error: null })
    const result = await createFranchiseGroup('  Sharma Auto Group  ')
    expect(result).toEqual({ success: true })
    expect(mockRpc).toHaveBeenCalledWith('create_franchise_group', {
      p_name: 'Sharma Auto Group',
    })
  })

  it('surfaces RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const result = await createFranchiseGroup('Sharma Auto Group')
    expect(result).toEqual({ error: 'boom' })
  })
})

// ─── findCompanyByGstin ───────────────────────────────────────────────────────

describe('findCompanyByGstin', () => {
  it('rejects malformed GSTINs without calling the RPC', async () => {
    const result = await findCompanyByGstin('NOT-A-GSTIN')
    expect(result).toEqual({ error: 'Invalid GSTIN format' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('normalizes to uppercase and returns the matched company', async () => {
    mockRpc.mockResolvedValue({
      data: [{ company_id: 'c-1', name: 'Borivali', already_in_group: false }],
      error: null,
    })
    const result = await findCompanyByGstin(VALID_GSTIN.toLowerCase())
    expect(mockRpc).toHaveBeenCalledWith('find_company_for_franchise', {
      p_gstin: VALID_GSTIN,
    })
    expect(result).toEqual({ company_id: 'c-1', name: 'Borivali', already_in_group: false })
  })

  it('returns a friendly error when no company matches', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    const result = await findCompanyByGstin(VALID_GSTIN)
    expect(result).toEqual({ error: 'No company registered with this GSTIN' })
  })
})

// ─── respondToFranchiseInvite ─────────────────────────────────────────────────

describe('respondToFranchiseInvite', () => {
  it('passes invite id and acceptance to the RPC', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const result = await respondToFranchiseInvite('inv-1', true)
    expect(result).toEqual({ success: true })
    expect(mockRpc).toHaveBeenCalledWith('respond_franchise_invite', {
      p_invite_id: 'inv-1',
      p_accept: true,
    })
  })

  it('surfaces RPC errors (e.g. non-admin caller)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Only an admin of the invited company can respond' },
    })
    const result = await respondToFranchiseInvite('inv-1', true)
    expect(result).toEqual({ error: 'Only an admin of the invited company can respond' })
  })
})

// ─── switchActiveCompany ──────────────────────────────────────────────────────

describe('switchActiveCompany', () => {
  function mockMembershipLookup(found: boolean) {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: found ? { company_id: 'c-2' } : null, error: null }),
          }),
        }),
      }),
    })
  }

  it('rejects unauthenticated callers', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await switchActiveCompany('c-2')
    expect(result).toEqual({ error: 'Not authenticated' })
    expect(mockUpdateUserById).not.toHaveBeenCalled()
  })

  it('rejects companies the user is not a member of', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockMembershipLookup(false)
    const result = await switchActiveCompany('c-2')
    expect(result).toEqual({ error: 'You are not a member of that company' })
    expect(mockUpdateUserById).not.toHaveBeenCalled()
  })

  it('persists active_company_id to app_metadata for members', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockMembershipLookup(true)
    mockUpdateUserById.mockResolvedValue({ data: {}, error: null })

    const result = await switchActiveCompany('c-2')
    expect(result).toEqual({ success: true })
    expect(mockUpdateUserById).toHaveBeenCalledWith('user-1', {
      app_metadata: { active_company_id: 'c-2' },
    })
  })
})

// ─── HQ readers ───────────────────────────────────────────────────────────────

describe('getFranchiseOverview', () => {
  it('returns the RPC payload verbatim', async () => {
    const payload = {
      group_id: 'g-1',
      group_name: 'Sharma Auto Group',
      member_count: 5,
      revenue_mtd: 1840430,
      outstanding: 319210,
      invoice_count_mtd: 1284,
      low_stock_count: 17,
    }
    mockRpc.mockResolvedValue({ data: payload, error: null })
    expect(await getFranchiseOverview()).toEqual(payload)
  })

  it('returns null when the caller owns no group', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    expect(await getFranchiseOverview()).toBeNull()
  })

  it('returns null on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'nope' } })
    expect(await getFranchiseOverview()).toBeNull()
  })
})

describe('getMyMemberships', () => {
  it('marks the active company and flattens the company name', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockRpc.mockResolvedValue({ data: 'c-1', error: null }) // get_company_id
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              { company_id: 'c-1', role: 'admin', companies: { name: 'Andheri West' } },
              { company_id: 'c-2', role: 'admin', companies: { name: 'Borivali' } },
            ],
            error: null,
          }),
        }),
      }),
    })

    const result = await getMyMemberships()
    expect(result).toEqual([
      { company_id: 'c-1', company_name: 'Andheri West', role: 'admin', is_active: true },
      { company_id: 'c-2', company_name: 'Borivali', role: 'admin', is_active: false },
    ])
  })

  it('returns [] when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await getMyMemberships()).toEqual([])
  })
})
