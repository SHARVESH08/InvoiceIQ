import { describe, it, expect } from 'vitest'

import {
  ROLES,
  PERMISSIONS,
  can,
  isRole,
  permissionsFor,
  type Permission,
  type Role,
} from './permissions'

describe('isRole', () => {
  it('accepts every declared role', () => {
    for (const role of ROLES) expect(isRole(role)).toBe(true)
  })

  it('rejects unknown values, including the legacy "none" claim', () => {
    for (const value of ['none', 'owner', '', null, undefined, 0, {}]) {
      expect(isRole(value)).toBe(false)
    }
  })
})

describe('can — fail closed', () => {
  it('grants nothing to a null, undefined or unknown role', () => {
    for (const role of [null, undefined, 'none' as unknown as Role]) {
      for (const permission of PERMISSIONS) {
        expect(can(role, permission)).toBe(false)
      }
    }
  })
})

describe('role capabilities', () => {
  it('gives admin every permission', () => {
    for (const permission of PERMISSIONS) {
      expect(can('admin', permission)).toBe(true)
    }
  })

  it('reserves team and settings administration to admin alone', () => {
    const adminOnly: Permission[] = ['team:manage', 'settings:write', 'franchise:manage']
    for (const permission of adminOnly) {
      const holders = ROLES.filter((r) => can(r, permission))
      expect(holders).toEqual(['admin'])
    }
  })

  it('lets manager run operations but not administer the company', () => {
    expect(can('manager', 'inventory:write')).toBe(true)
    expect(can('manager', 'purchase_orders:write')).toBe(true)
    expect(can('manager', 'godowns:write')).toBe(true)
    expect(can('manager', 'team:manage')).toBe(false)
    expect(can('manager', 'settings:write')).toBe(false)
  })

  it('lets billing invoice and manage customers but not move stock', () => {
    expect(can('billing', 'invoices:write')).toBe(true)
    expect(can('billing', 'customers:write')).toBe(true)
    expect(can('billing', 'inventory:read')).toBe(true)
    expect(can('billing', 'inventory:write')).toBe(false)
    expect(can('billing', 'products:write')).toBe(false)
  })

  it('keeps accountant read-only outside GST', () => {
    expect(can('accountant', 'gst:write')).toBe(true)
    expect(can('accountant', 'reports:read')).toBe(true)
    expect(can('accountant', 'invoices:read')).toBe(true)
    expect(can('accountant', 'invoices:write')).toBe(false)
    expect(can('accountant', 'inventory:write')).toBe(false)
  })

  it('scopes salesperson to selling, not stock or purchasing', () => {
    expect(can('salesperson', 'invoices:write')).toBe(true)
    expect(can('salesperson', 'crm:write')).toBe(true)
    expect(can('salesperson', 'inventory:write')).toBe(false)
    expect(can('salesperson', 'purchase_orders:write')).toBe(false)
    expect(can('salesperson', 'reports:read')).toBe(false)
  })

  it('gives the external CA read-only GST/reports and no operational sight', () => {
    expect(can('ca', 'gst:read')).toBe(true)
    expect(can('ca', 'reports:read')).toBe(true)
    expect(can('ca', 'invoices:read')).toBe(true)
    expect(can('ca', 'gst:write')).toBe(false)
    expect(can('ca', 'inventory:read')).toBe(false)
    expect(can('ca', 'suppliers:read')).toBe(false)
    expect(can('ca', 'purchase_orders:read')).toBe(false)
  })

  it('never grants a write without the matching read', () => {
    const writes = PERMISSIONS.filter((p) => p.endsWith(':write'))
    for (const role of ROLES) {
      for (const write of writes) {
        if (!can(role, write)) continue
        const read = write.replace(':write', ':read') as Permission
        if (!(PERMISSIONS as readonly string[]).includes(read)) continue
        expect(
          can(role, read),
          `${role} has ${write} but not ${read}`
        ).toBe(true)
      }
    }
  })

  it('grants no role a permission outside the declared list', () => {
    for (const role of ROLES) {
      for (const permission of permissionsFor(role)) {
        expect(PERMISSIONS).toContain(permission)
      }
    }
  })
})
