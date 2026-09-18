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

  it('collapses the footer to a single Settings entry', () => {
    // Franchise and Telephony are tabs inside /settings now, not footer items.
    const { footer } = getNavItems({})
    expect(footer.map((i) => i.label)).toEqual(['Settings'])
    expect(footer[0].href).toBe('/settings')
  })

  it('hides HQ by default and leads with it for franchise owners', () => {
    expect(getNavItems({}).main.map((i) => i.label)).not.toContain('HQ')
    const ownerLabels = getNavItems({ isFranchiseOwner: true }).main.map((i) => i.label)
    expect(ownerLabels[0]).toBe('HQ')
    expect(ownerLabels[1]).toBe('Dashboard')
  })

  it('places Pricing Alerts in main immediately after GST', () => {
    const labels = getNavItems({}).main.map((i) => i.label)
    expect(labels).toContain('Pricing Alerts')
    expect(labels.indexOf('Pricing Alerts')).toBe(labels.indexOf('GST') + 1)
  })

  it('has no Chat entry — the assistant is the floating bubble', () => {
    expect(getNavItems({}).main.map((i) => i.label)).not.toContain('Chat')
  })

  it('exposes Godowns as a top-level entry, not a settings tab', () => {
    const godowns = getNavItems({}).main.find((i) => i.label === 'Godowns')
    expect(godowns).toBeDefined()
    expect(godowns!.href).toBe('/godowns')
  })
})

describe('getNavItems role filtering', () => {
  it('leaves the nav untouched when no role is supplied', () => {
    const withoutRole = getNavItems({}).main.map((i) => i.label)
    const explicitAdmin = getNavItems({ role: 'admin' }).main.map((i) => i.label)
    expect(withoutRole).toEqual(explicitAdmin)
  })

  it('hides everything permissioned for an unknown/absent role', () => {
    const { main, footer } = getNavItems({ role: null })
    // Dashboard carries no permission, so it survives; the rest should not.
    expect(main.map((i) => i.label)).toEqual(['Dashboard'])
    expect(footer).toEqual([])
  })

  it('hides stock and purchasing from an external CA', () => {
    const labels = getNavItems({ companyType: 'Distributor', role: 'ca' }).main.map(
      (i) => i.label
    )
    expect(labels).toContain('Invoices')
    expect(labels).toContain('GST')
    expect(labels).toContain('Reports')
    expect(labels).not.toContain('Inventory')
    expect(labels).not.toContain('Godowns')
    expect(labels).not.toContain('Suppliers')
    expect(labels).not.toContain('Purchase Orders')
  })

  it('hides Reports and Settings from a salesperson but keeps CRM', () => {
    const { main, footer } = getNavItems({ role: 'salesperson' })
    const labels = main.map((i) => i.label)
    expect(labels).toContain('CRM')
    expect(labels).toContain('Invoices')
    expect(labels).not.toContain('Reports')
    expect(footer).toEqual([])
  })

  it('keeps Settings visible for roles that can read it', () => {
    for (const role of ['admin', 'manager', 'billing', 'accountant'] as const) {
      expect(getNavItems({ role }).footer.map((i) => i.label)).toEqual(['Settings'])
    }
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
