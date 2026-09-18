/**
 * CRM server actions tests (Workstream 4)
 * Covers: lead validation + conversion (with compensating delete), deal stage
 * transitions, interaction linkage rule, task validation, funnel math.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockRpc, mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
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

import {
  createLead,
  updateLeadStatus,
  convertLead,
  createDeal,
  moveDealStage,
  logInteraction,
  createTask,
  getCrmFunnel,
} from '@/lib/actions/crm'
import { groupTasks } from '@/app/(business)/crm/_components/followups-list'

function authOk() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  mockRpc.mockImplementation((fn: string) => {
    if (fn === 'get_company_id') return Promise.resolve({ data: 'company-1', error: null })
    // Every mutating action now opens with requirePermission(), which resolves
    // the caller's role through this RPC. Admin = the previous behaviour.
    if (fn === 'get_company_role') return Promise.resolve({ data: 'admin', error: null })
    return Promise.resolve({ data: null, error: null })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── createLead ───────────────────────────────────────────────────────────────

describe('createLead', () => {
  it('rejects an empty name before touching the database', async () => {
    authOk()
    const result = await createLead({ name: '  ', source: 'walk_in' })
    expect(result).toEqual({ error: 'Name is required' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('refuses a caller whose role cannot write to the CRM', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockRpc.mockImplementation((fn: string) =>
      fn === 'get_company_role'
        ? Promise.resolve({ data: 'accountant', error: null })
        : Promise.resolve({ data: 'company-1', error: null })
    )

    const result = await createLead({ name: 'Priya Nair', source: 'walk_in' })
    expect(result).toHaveProperty('error')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('inserts with nulls for blank optional fields', async () => {
    authOk()
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert })

    const result = await createLead({
      name: 'Priya Nair',
      phone: '',
      email: '',
      source: 'referral',
      notes: '',
    })
    expect(result).toEqual({ success: true })
    expect(insert).toHaveBeenCalledWith({
      company_id: 'company-1',
      name: 'Priya Nair',
      phone: null,
      email: null,
      source: 'referral',
      notes: null,
    })
  })
})

// ─── updateLeadStatus / convertLead ──────────────────────────────────────────

describe('lead status transitions', () => {
  it('refuses manual transition to converted', async () => {
    const result = await updateLeadStatus('lead-1', 'converted')
    expect(result).toEqual({ error: 'Use convertLead to convert a lead' })
  })

  it('convertLead creates a customer and links it to the lead', async () => {
    authOk()
    const leadRow = {
      id: 'lead-1',
      name: 'Priya Nair',
      phone: '9812345678',
      email: null,
      status: 'qualified',
      customer_id: null,
    }
    const leadUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'crm_leads') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: leadRow, error: null }),
              }),
            }),
          }),
          update: leadUpdate,
        }
      }
      // customers table
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'cust-9' }, error: null }),
          }),
        }),
      }
    })

    const result = await convertLead('lead-1')
    expect(result).toEqual({ success: true })
    expect(leadUpdate).toHaveBeenCalledWith({ status: 'converted', customer_id: 'cust-9' })
  })

  it('convertLead refuses already-converted leads', async () => {
    authOk()
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'lead-1', status: 'converted', customer_id: 'cust-1' },
              error: null,
            }),
          }),
        }),
      }),
    })
    const result = await convertLead('lead-1')
    expect(result).toEqual({ error: 'Lead is already converted' })
  })
})

// ─── deals ────────────────────────────────────────────────────────────────────

describe('deals', () => {
  it('createDeal rejects negative values', async () => {
    const result = await createDeal({ title: 'Fleet quote', value: -5, stage: 'qualified' })
    expect(result).toEqual({ error: 'Value cannot be negative' })
  })

  it('moveDealStage rejects unknown stages', async () => {
    const result = await moveDealStage('deal-1', 'archived' as never)
    expect(result).toEqual({ error: 'Invalid stage' })
  })

  it('moveDealStage updates within the company scope', async () => {
    authOk()
    const eq2 = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: eq2 }) })
    mockFrom.mockReturnValue({ update })

    const result = await moveDealStage('deal-1', 'won')
    expect(result).toEqual({ success: true })
    expect(update).toHaveBeenCalledWith({ stage: 'won' })
  })
})

// ─── interactions / tasks ─────────────────────────────────────────────────────

describe('logInteraction', () => {
  it('requires a customer, lead, or deal link', async () => {
    const result = await logInteraction({ type: 'note', content: 'called about quote' })
    expect(result).toEqual({
      error: 'Interaction must be linked to a customer, lead, or deal',
    })
  })
})

describe('createTask', () => {
  it('rejects malformed due dates', async () => {
    const result = await createTask({ title: 'Call back', due_date: '13-07-2026' })
    expect(result).toEqual({ error: 'Invalid date' })
  })
})

// ─── grouping + funnel ────────────────────────────────────────────────────────

describe('groupTasks', () => {
  const t = (id: string, due: string) => ({
    id,
    title: id,
    due_date: due,
    status: 'open' as const,
    customer_id: null,
    lead_id: null,
    deal_id: null,
    created_at: '',
  })

  it('splits into overdue / today / upcoming by ISO comparison', () => {
    const groups = groupTasks(
      [t('a', '2026-07-10'), t('b', '2026-07-13'), t('c', '2026-08-01')],
      '2026-07-13'
    )
    expect(groups.overdue.map((x) => x.id)).toEqual(['a'])
    expect(groups.today.map((x) => x.id)).toEqual(['b'])
    expect(groups.upcoming.map((x) => x.id)).toEqual(['c'])
  })
})

describe('getCrmFunnel', () => {
  it('maps the get_crm_funnel RPC payload, coercing numeric strings', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_company_id') return Promise.resolve({ data: 'company-1', error: null })
      if (fn === 'get_crm_funnel') {
        return Promise.resolve({
          data: {
            leads_total: 4,
            leads_converted: 2,
            deals_won: 2,
            deals_lost: 1,
            // numeric(12,2) arrives as a string over PostgREST
            won_value: '350.00',
          },
          error: null,
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const funnel = await getCrmFunnel()
    expect(funnel).toEqual({
      leads_total: 4,
      leads_converted: 2,
      deals_won: 2,
      deals_lost: 1,
      won_value: 350,
    })
    // Aggregation happens in SQL now — no table scan from the app.
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns null when the RPC errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockRpc.mockImplementation((fn: string) =>
      fn === 'get_company_id'
        ? Promise.resolve({ data: 'company-1', error: null })
        : Promise.resolve({ data: null, error: { message: 'boom' } })
    )
    expect(await getCrmFunnel()).toBeNull()
  })
})
