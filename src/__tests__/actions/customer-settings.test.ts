/**
 * GREEN tests — updateEmailReminders Server Action
 * Covers: PORTAL-05 (Zod validation, Supabase update, revalidatePath)
 */

import { updateEmailReminders } from '@/lib/actions/customer-settings'

// Mock next/cache
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

// Mock Supabase server client.
// NOTE: jest.mock() is hoisted above these const declarations, so the factory
// must reference the mocks lazily (inside arrow functions) — touching them
// eagerly at factory-eval time throws a TDZ "before initialization" error.
const mockUpdate = jest.fn()
const mockEq = jest.fn()
const mockGetUser = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: jest.fn(() => ({
      update: (...args: unknown[]) => {
        mockUpdate(...args)
        return { eq: (...eqArgs: unknown[]) => mockEq(...eqArgs) }
      },
    })),
  }),
}))

describe('updateEmailReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates input with Zod; rejects non-boolean [PORTAL-05 8-04-01]', async () => {
    // Non-boolean input should fail Zod validation
    const result = await updateEmailReminders({ email_reminders: 'yes' as unknown as boolean })
    expect(result).toEqual({ error: 'Invalid input' })
  })

  it('calls supabase update and revalidatePath on valid input [PORTAL-05 8-04-01]', async () => {
    const { revalidatePath } = await import('next/cache')

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    mockEq.mockResolvedValue({ error: null })

    const result = await updateEmailReminders({ email_reminders: false })

    expect(result).toEqual({ success: true })
    expect(revalidatePath).toHaveBeenCalledWith('/my/settings')
  })
})
