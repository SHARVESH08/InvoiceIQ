/**
 * Wave 0 RED stub — CustomerChartPanel
 * Covers: PORTAL-02 (LineChart, BarChart, PieChart with mocked spend data)
 * Implement in Wave 2 (Plan 03).
 */

// Mock the module under test — src/app/(customer)/my/_components/customer-chart-panel.tsx
// will be created in Wave 2. Virtual mock prevents import resolution error.
jest.mock(
  '@/app/(customer)/my/_components/customer-chart-panel',
  () => ({ CustomerChartPanel: () => null }),
  { virtual: true }
)

describe('CustomerChartPanel', () => {
  it('renders LineChart, BarChart, PieChart with mocked spendTrend and spendByMerchant data [PORTAL-02 8-03-01]', () => {
    // stub: implement in Wave 2 (Plan 03)
    expect(false).toBe(true) // RED — not implemented
  })
})
