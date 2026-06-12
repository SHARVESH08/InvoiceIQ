import { describe, it, expect, vi, beforeEach } from 'vitest'

const state: {
  user: unknown
  companyId: unknown
  selectResult: unknown
  mutationResult: unknown
} = { user: { id: 'u1' }, companyId: 'co1', selectResult: { data: [], error: null }, mutationResult: { error: null } }

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
  const builder = () => {
    const b: Record<string, unknown> = {}
    const chain = () => b
    b.select = vi.fn(chain)
    b.eq = vi.fn(chain)
    b.in = vi.fn(chain)
    b.not = vi.fn(chain)
    b.then = (resolve: (v: unknown) => void) => resolve(state.selectResult)
    b.upsert = vi.fn(() => Promise.resolve(state.mutationResult))
    b.delete = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve(state.mutationResult)),
        in: vi.fn(() => Promise.resolve(state.mutationResult)),
      })),
    }))
    return b
  }
  return {
    createClient: vi.fn().mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
      rpc: vi.fn(async () => ({ data: state.companyId })),
      from: vi.fn(() => builder()),
    }),
  }
})

import { toggleProductAlert, toggleCategoryAlert } from './pricing-monitor'

beforeEach(() => {
  state.user = { id: 'u1' }
  state.companyId = 'co1'
  state.selectResult = { data: [], error: null }
  state.mutationResult = { error: null }
})

describe('toggleProductAlert', () => {
  it('rejects when unauthenticated', async () => {
    state.user = null
    const res = await toggleProductAlert('p1', true)
    expect(res).toEqual({ error: 'Not authenticated' })
  })

  it('returns success on enable', async () => {
    const res = await toggleProductAlert('p1', true)
    expect(res).toEqual({ success: true })
  })

  it('surfaces a DB error', async () => {
    state.mutationResult = { error: { message: 'boom' } }
    const res = await toggleProductAlert('p1', true)
    expect('error' in res).toBe(true)
  })
})

describe('toggleCategoryAlert', () => {
  it('enabling with no products in category errors', async () => {
    state.selectResult = { data: [], error: null }
    const res = await toggleCategoryAlert('Steel', true)
    expect('error' in res).toBe(true)
  })

  it('enabling upserts and returns success', async () => {
    state.selectResult = { data: [{ id: 'p1' }, { id: 'p2' }], error: null }
    const res = await toggleCategoryAlert('Steel', true)
    expect(res).toEqual({ success: true })
  })
})
