// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import '../../../tests/setup-dom'

vi.mock('next/navigation', () => ({ usePathname: () => '/invoices' }))

import { SidebarNav } from './sidebar-nav'
import { getNavItems } from './nav-items'

describe('SidebarNav', () => {
  it('marks the item matching the current path as current', () => {
    const { main } = getNavItems({ companyType: 'Retailer' })
    render(<SidebarNav items={main} />)
    const invoices = screen.getByRole('link', { name: /invoices/i })
    expect(invoices).toHaveAttribute('aria-current', 'page')
    const dashboard = screen.getByRole('link', { name: /dashboard/i })
    expect(dashboard).not.toHaveAttribute('aria-current')
  })

  it('hides text labels when collapsed (icons remain)', () => {
    const { main } = getNavItems({ companyType: 'Retailer' })
    render(<SidebarNav items={main} collapsed />)
    expect(screen.queryByText('Invoices')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Invoices' })).toBeInTheDocument()
  })
})
