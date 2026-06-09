import '@testing-library/jest-dom'

// ResizeObserver mock — required for Recharts in jsdom (DASH-04)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
