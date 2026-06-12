import { describe, it, expect } from 'vitest'
import { getNavItems, isNavItemActive } from './nav-items'

describe('getNavItems role gating', () => {
  it('shows WhatsApp Orders for Retailer, not Purchase Orders', () => {
    const { main } = getNavItems({ companyType: 'Retailer' })
    const labels = main.map((i) => i.label)
    expect(labels).toContain('WhatsApp Orders')
    expect(labels).not.toContain('Purchase Orders')
  })

  it('shows Purchase Orders for OEM/Distributor, not WhatsApp Orders', () => {
    const oem = getNavItems({ companyType: 'OEM' }).main.map((i) => i.label)
    expect(oem).toContain('Purchase Orders')
    expect(oem).not.toContain('WhatsApp Orders')
  })

  it('puts a low-stock badge + filter href on Inventory when count > 0', () => {
    const { main } = getNavItems({ companyType: 'Retailer', lowStockCount: 5 })
    const inv = main.find((i) => i.label === 'Inventory')!
    expect(inv.badge).toBe(5)
    expect(inv.href).toBe('/inventory?filter=low_stock')
  })

  it('sets the Distributor PO pending badge', () => {
    const { main } = getNavItems({ companyType: 'Distributor', poPendingCount: 3 })
    const po = main.find((i) => i.label === 'Purchase Orders')!
    expect(po.badge).toBe(3)
  })

  it('returns Settings and Pricing Alerts as footer items', () => {
    const { footer } = getNavItems({})
    expect(footer.map((i) => i.label)).toEqual(['Settings', 'Pricing Alerts'])
  })
})

describe('isNavItemActive', () => {
  it('matches Dashboard only exactly', () => {
    expect(isNavItemActive('/dashboard', 'exact', '/dashboard')).toBe(true)
    expect(isNavItemActive('/dashboard', 'exact', '/dashboard/reports')).toBe(false)
  })
  it('prefix-matches section routes and ignores query strings', () => {
    expect(isNavItemActive('/inventory?filter=low_stock', 'prefix', '/inventory')).toBe(true)
    expect(isNavItemActive('/invoices', 'prefix', '/invoices/123')).toBe(true)
    expect(isNavItemActive('/invoices', 'prefix', '/invoicesX')).toBe(false)
  })
})
