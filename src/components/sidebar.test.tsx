// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import '../../tests/setup-dom'

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))
// signOut is a server action imported transitively by LogoutButton; stub it.
vi.mock('@/lib/actions/auth-shared', () => ({ signOut: async () => {} }))

import { Sidebar } from './sidebar'

describe('Sidebar', () => {
  beforeEach(() => {
    document.cookie = 'sidebar_collapsed=; max-age=0; path=/'
  })

  it('renders expanded by default with the brand wordmark', () => {
    render(<Sidebar companyType="Retailer" userEmail="a@b.com" />)
    expect(screen.getByText('InvoiceIQ')).toBeInTheDocument()
  })

  it('collapses on toggle and writes the cookie', async () => {
    render(<Sidebar companyType="Retailer" userEmail="a@b.com" />)
    const toggle = screen.getByRole('checkbox', { name: /collapse sidebar/i })
    await userEvent.click(toggle)
    expect(document.cookie).toContain('sidebar_collapsed=1')
    expect(screen.queryByText('InvoiceIQ')).not.toBeInTheDocument()
  })
})
