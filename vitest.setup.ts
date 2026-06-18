// Vitest global setup for component tests.
// Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.) and
// unmounts rendered React trees after each test to prevent DOM leakage.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// ResizeObserver mock — required for Recharts in jsdom (DASH-04)
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(() => {
  cleanup()
})
