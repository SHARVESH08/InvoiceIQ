import { render, screen } from '@testing-library/react'
import { OemDashboard } from '@/components/dashboard/oem-dashboard'

const defaultProps = {
  isAdmin: true,
  revenueMtd: 124500,
  topDistributors: [
    { name: 'Distributor A', revenue: 50000 },
    { name: 'Distributor B', revenue: 30000 },
  ],
  revenueTrend: [],
  topProducts: [],
  paymentSplit: [],
}

describe('OemDashboard', () => {
  it('renders Revenue This Month widget when isAdmin=true', () => {
    render(<OemDashboard {...defaultProps} isAdmin={true} />)
    expect(screen.getByText('Revenue This Month')).toBeInTheDocument()
  })

  it('does NOT render Revenue This Month widget when isAdmin=false', () => {
    render(<OemDashboard {...defaultProps} isAdmin={false} />)
    expect(screen.queryByText('Revenue This Month')).not.toBeInTheDocument()
  })

  it('renders Est. GSTR-1 Due Date widget', () => {
    render(<OemDashboard {...defaultProps} />)
    expect(screen.getByText('Est. GSTR-1 Due Date')).toBeInTheDocument()
  })

  it('renders Purchase Orders placeholder widget', () => {
    render(<OemDashboard {...defaultProps} />)
    expect(screen.getByText('Purchase Orders')).toBeInTheDocument()
    expect(screen.getByText('PO management arrives in a future update')).toBeInTheDocument()
  })

  it('renders top distributors table wrapped in overflow-x-auto', () => {
    const { container } = render(<OemDashboard {...defaultProps} />)
    const overflowDivs = container.querySelectorAll('.overflow-x-auto')
    expect(overflowDivs.length).toBeGreaterThanOrEqual(1)
  })
})
