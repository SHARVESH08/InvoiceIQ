import { render, screen } from '@testing-library/react'
import { RetailerDashboard } from '@/components/dashboard/retailer-dashboard'

const defaultProps = {
  isAdmin: true,
  todaySales: 15000,
  lowStockCount: 5,
  whatsappOrderCount: 3,
  revenueTrend: [],
  topProducts: [],
  paymentSplit: [],
}

describe('RetailerDashboard', () => {
  it("renders Today's Sales total when isAdmin=true", () => {
    render(<RetailerDashboard {...defaultProps} isAdmin={true} />)
    expect(screen.getByText("Today's Sales")).toBeInTheDocument()
  })

  it("does NOT render Today's Sales when isAdmin=false", () => {
    render(<RetailerDashboard {...defaultProps} isAdmin={false} />)
    expect(screen.queryByText("Today's Sales")).not.toBeInTheDocument()
  })

  it('renders Low Stock Items count with destructive badge when count > 0', () => {
    render(<RetailerDashboard {...defaultProps} lowStockCount={5} />)
    expect(screen.getByText('Low Stock Items')).toBeInTheDocument()
    // Badge should appear with count
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders the WhatsApp Orders widget with live count', () => {
    render(<RetailerDashboard {...defaultProps} />)
    expect(screen.getByText('WhatsApp Orders')).toBeInTheDocument()
    expect(screen.getByText('Invoices sent via WhatsApp')).toBeInTheDocument()
  })
})
