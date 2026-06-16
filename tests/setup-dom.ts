// Registers @testing-library/jest-dom matchers (toBeInTheDocument, toBeChecked, …)
// Imported by component test files that use the jsdom environment.
import '@testing-library/jest-dom/vitest'

// Stub browser APIs missing from jsdom that framer-motion viewport features need
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    root = null
    rootMargin = ''
    thresholds = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  } as unknown as typeof IntersectionObserver
}
