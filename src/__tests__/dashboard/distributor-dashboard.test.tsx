import { render, screen } from '@testing-library/react'
import { DistributorDashboard } from '@/components/dashboard/distributor-dashboard'

const defaultProps = {
  isAdmin: true,
  godownStock: [
    { godownName: 'Main Godown', totalQty: 150 },
  ],
  retailerOutstanding: [
    { customerName: 'Retailer X', outstanding: 25000 },
  ],
  pendingTransferCount: 3,
  revenueTrend: [],
  topProducts: [],
  paymentSplit: [],
}

describe('DistributorDashboard', () => {
  it('renders godown stock levels table', () => {
    render(<DistributorDashboard {...defaultProps} />)
    expect(screen.getByText('Main Godown')).toBeInTheDocument()
  })

  it('renders retailer outstanding balances table when isAdmin=true', () => {
    render(<DistributorDashboard {...defaultProps} isAdmin={true} />)
    expect(screen.getByText('Retailer X')).toBeInTheDocument()
  })

  it('does NOT render retailer outstanding balances when isAdmin=false', () => {
    render(<DistributorDashboard {...defaultProps} isAdmin={false} />)
    expect(screen.queryByText('Retailer X')).not.toBeInTheDocument()
  })

  it('renders pending transfers count card', () => {
    render(<DistributorDashboard {...defaultProps} />)
    expect(screen.getByText('Pending Transfers')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('wraps tables in overflow-x-auto divs', () => {
    const { container } = render(<DistributorDashboard {...defaultProps} />)
    const overflowDivs = container.querySelectorAll('.overflow-x-auto')
    expect(overflowDivs.length).toBeGreaterThanOrEqual(1)
  })
})
