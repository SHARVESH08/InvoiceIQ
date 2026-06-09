import { render, act } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────────

// Capture the INSERT event callback so tests can invoke it directly
let capturedCallback: (() => void) | null = null
const mockUnsubscribe = jest.fn()
const mockSubscribe = jest.fn()

// The channel object returned from .on(...) needs subscribe + unsubscribe
// mockSubscribe returns the same channelRef so channel.unsubscribe() works
const channelRef = {
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
}
mockSubscribe.mockReturnValue(channelRef)

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({
      on: (_event: string, _filter: object, cb: () => void) => {
        capturedCallback = cb
        return channelRef
      },
    }),
  }),
}))

const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { RealtimeDashboard } from '@/components/realtime-dashboard'

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  capturedCallback = null
  mockSubscribe.mockReturnValue(channelRef)
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
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
      capturedCallback!()
      capturedCallback!()
      capturedCallback!()
    })

    // Debounce pending — no refresh yet
    expect(mockRefresh).not.toHaveBeenCalled()

    // Advance to 499ms — still not fired
    act(() => {
      jest.advanceTimersByTime(499)
    })
    expect(mockRefresh).not.toHaveBeenCalled()

    // Advance 2ms more (501ms total since last event) — fires exactly once
    act(() => {
      jest.advanceTimersByTime(2)
    })
    expect(mockRefresh).toHaveBeenCalledTimes(1)

    // Another burst + 500ms — fires second time
    act(() => {
      capturedCallback!()
      jest.advanceTimersByTime(500)
    })
    expect(mockRefresh).toHaveBeenCalledTimes(2)
  })
})
