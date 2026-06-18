import { render, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

// Capture the INSERT event callback so tests can invoke it directly.
// The real handler reads payload.new.company_id, so tests pass a matching payload.
type InvoicePayload = { new: { company_id: string } }
const insertPayload: InvoicePayload = { new: { company_id: 'test-id' } }
let capturedCallback: ((payload: InvoicePayload) => void) | null = null
const mockUnsubscribe = vi.fn()
const mockSubscribe = vi.fn()

// The channel object returned from .on(...) needs subscribe + unsubscribe
// mockSubscribe returns the same channelRef so channel.unsubscribe() works
const channelRef = {
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
}
mockSubscribe.mockReturnValue(channelRef)

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({
      on: (_event: string, _filter: object, cb: (payload: InvoicePayload) => void) => {
        capturedCallback = cb
        return channelRef
      },
    }),
  }),
}))

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { RealtimeDashboard } from '@/components/realtime-dashboard'

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallback = null
  mockSubscribe.mockReturnValue(channelRef)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RealtimeDashboard', () => {
  it('subscribes to invoices channel on mount', () => {
    render(
      <RealtimeDashboard companyId="test-id">
        <div>child</div>
      </RealtimeDashboard>
    )
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
  })

  it('calls unsubscribe on unmount', () => {
    const { unmount } = render(
      <RealtimeDashboard companyId="test-id">
        <div>child</div>
      </RealtimeDashboard>
    )
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('debounces router.refresh — fires once 500ms after a burst of INSERT events', () => {
    render(
      <RealtimeDashboard companyId="test-id">
        <div>child</div>
      </RealtimeDashboard>
    )

    // Invoke INSERT callback 3 times in rapid succession
    act(() => {
      capturedCallback!(insertPayload)
      capturedCallback!(insertPayload)
      capturedCallback!(insertPayload)
    })

    // Debounce pending — no refresh yet
    expect(mockRefresh).not.toHaveBeenCalled()

    // Advance to 499ms — still not fired
    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(mockRefresh).not.toHaveBeenCalled()

    // Advance 2ms more (501ms total since last event) — fires exactly once
    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(mockRefresh).toHaveBeenCalledTimes(1)

    // Another burst + 500ms — fires second time
    act(() => {
      capturedCallback!(insertPayload)
      vi.advanceTimersByTime(500)
    })
    expect(mockRefresh).toHaveBeenCalledTimes(2)
  })
})
