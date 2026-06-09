/**
 * Phase 13 Plan 01 — Onboarding Server Actions Tests (Wave 0 stub)
 * RED state: tests import from actions file that does not exist yet.
 * Will pass once Wave 1 Plan 03 creates src/app/(onboarding)/onboarding/actions.ts
 *
 * Covers: saveOnboardingStep, completeOnboarding
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'

// ── Mock supabase/server ──────────────────────────────────────────────────────
const mockSupabaseUser = { id: 'user-uuid-123' }
const mockCompanyId = 'company-uuid-onboarding'

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
  createClient: vi.fn(),
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
  ;['select', 'eq', 'limit', 'order', 'insert', 'update', 'delete'].forEach((method) => {
    chain[method].mockReturnValue(chain)
  })
  chain['maybeSingle'] = vi.fn().mockResolvedValue(resolveWith)
  chain['single'] = vi.fn().mockResolvedValue(resolveWith)
  return chain
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()

  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabaseClient)

  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: mockSupabaseUser },
    error: null,
  })

  mockSupabaseRpc.mockImplementation((rpcName: string) => {
    if (rpcName === 'get_company_id') {
      return Promise.resolve({ data: mockCompanyId, error: null })
    }
    return Promise.resolve({ data: null, error: { message: `Unknown RPC: ${rpcName}` } })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests — RED state until Wave 1 creates the actions file
// ─────────────────────────────────────────────────────────────────────────────

// NOTE: Import is at top-level so MODULE_NOT_FOUND surfaces immediately
import { saveOnboardingStep, completeOnboarding } from '@/app/(onboarding)/onboarding/actions'

describe('saveOnboardingStep', () => {
  it('updates onboarding_step in companies table', async () => {
    const chain = buildChain({ data: { id: mockCompanyId, onboarding_step: 2 }, error: null })
    mockSupabaseFrom.mockReturnValue(chain)

    const result = await saveOnboardingStep(2)

    expect(result).not.toHaveProperty('error')
    expect(mockSupabaseFrom).toHaveBeenCalledWith('companies')
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ onboarding_step: 2 }))
    expect(chain.eq).toHaveBeenCalledWith('id', mockCompanyId)
  })

  it('returns error when not authenticated', async () => {
    mockSupabaseAuth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const result = await saveOnboardingStep(1)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toBe('Not authenticated')
  })

  it('returns error when company membership not found', async () => {
    mockSupabaseRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'get_company_id') {
        return Promise.resolve({ data: null, error: { message: 'Company membership not found' } })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const result = await saveOnboardingStep(1)

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toBe('Company membership not found')
  })
})

describe('completeOnboarding', () => {
  it('sets onboarding_step=4 and onboarding_completed=true', async () => {
    const chain = buildChain({
      data: { id: mockCompanyId, onboarding_step: 4, onboarding_completed: true },
      error: null,
    })
    mockSupabaseFrom.mockReturnValue(chain)

    const result = await completeOnboarding()

    expect(result).not.toHaveProperty('error')
    expect(mockSupabaseFrom).toHaveBeenCalledWith('companies')
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ onboarding_step: 4, onboarding_completed: true })
    )
  })

  it('returns error when not authenticated', async () => {
    mockSupabaseAuth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const result = await completeOnboarding()

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toBe('Not authenticated')
  })
})
