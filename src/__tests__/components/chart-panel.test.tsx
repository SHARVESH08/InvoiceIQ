import { render } from '@testing-library/react'
import { ChartPanel } from '@/components/dashboard/chart-panel'

describe('ChartPanel', () => {
  it('renders without crashing with empty arrays', () => {
    const { container } = render(
      <ChartPanel revenueTrend={[]} topProducts={[]} paymentSplit={[]} />
    )
    expect(container).not.toBeEmptyDOMElement()
  })

  it('renders without crashing with mock data', () => {
    const { container } = render(
      <ChartPanel
        revenueTrend={[{ month: '2026-01', revenue: 1000 }]}
        topProducts={[{ name: 'Widget A', revenue: 500 }]}
        paymentSplit={[{ mode: 'cash', count: 3, total: 1500 }]}
      />
    )
    expect(container).not.toBeEmptyDOMElement()
  })

  it('renders three chart section headings', () => {
    const { getByText } = render(
      <ChartPanel revenueTrend={[]} topProducts={[]} paymentSplit={[]} />
    )
    expect(getByText('Revenue Trend (12 Months)')).toBeInTheDocument()
    expect(getByText('Top 5 Products by Revenue')).toBeInTheDocument()
    expect(getByText('Payment Mode Split')).toBeInTheDocument()
  })
})
