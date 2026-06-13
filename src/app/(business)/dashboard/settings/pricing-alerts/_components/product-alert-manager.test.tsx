// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
// 7 segments up from _components to repo root: _components → pricing-alerts → settings → dashboard → (business) → app → src → root
import '../../../../../../../tests/setup-dom'

const { toggleProductAlert, toggleCategoryAlert } = vi.hoisted(() => ({
  toggleProductAlert: vi.fn(async () => ({ success: true })),
  toggleCategoryAlert: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/actions/pricing-monitor', () => ({ toggleProductAlert, toggleCategoryAlert }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { ProductAlertManager } from './product-alert-manager'

const products = [
  { id: 'a', name: 'Rebar 8mm', category: 'Steel', selling_price: 100 },
  { id: 'b', name: 'Cement Bag', category: 'Cement', selling_price: 400 },
]

describe('ProductAlertManager', () => {
  it('renders products grouped by category with a switch per product', () => {
    render(<ProductAlertManager products={products} initialMonitoredIds={['a']} />)
    expect(screen.getByText('Rebar 8mm')).toBeInTheDocument()
    expect(screen.getByText('Steel')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThanOrEqual(4)
  })

  it('filters by search query', async () => {
    render(<ProductAlertManager products={products} initialMonitoredIds={[]} />)
    await userEvent.type(screen.getByRole('searchbox'), 'cement')
    expect(screen.getByText('Cement Bag')).toBeInTheDocument()
    expect(screen.queryByText('Rebar 8mm')).not.toBeInTheDocument()
  })

  it('calls toggleProductAlert when a product switch is toggled', async () => {
    render(<ProductAlertManager products={products} initialMonitoredIds={[]} />)
    const rebarSwitch = screen.getByRole('checkbox', { name: /monitor rebar 8mm/i })
    await userEvent.click(rebarSwitch)
    expect(toggleProductAlert).toHaveBeenCalledWith('a', true)
  })

  it('calls toggleCategoryAlert when a category master switch is toggled', async () => {
    render(<ProductAlertManager products={products} initialMonitoredIds={[]} />)
    const steelMaster = screen.getByRole('checkbox', { name: /monitor all steel/i })
    await userEvent.click(steelMaster)
    expect(toggleCategoryAlert).toHaveBeenCalledWith('Steel', true)
  })
})
