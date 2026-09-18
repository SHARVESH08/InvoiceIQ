// ─────────────────────────────────────────────────────────────────────────────
// IAM — roles and permissions
//
// Pure data + pure functions, no I/O, so this module is importable from client
// components (nav gating) and server actions (enforcement) alike, and is
// directly unit-testable.
//
// The enforcement rule: the UI uses this to decide what to SHOW, and server
// actions use it to decide what to ALLOW. Hiding a button is a convenience;
// requirePermission() in the action is the actual boundary.
// ─────────────────────────────────────────────────────────────────────────────

export const ROLES = [
  'admin',
  'manager',
  'billing',
  'accountant',
  'salesperson',
  'ca',
] as const

export type Role = (typeof ROLES)[number]

/**
 * Roles an admin may hand out from the invite form.
 *
 * 'admin' is deliberately absent: granting full control — including the power
 * to grant it to others — should be a separate, explicit promotion, not one
 * entry in a dropdown next to "Salesperson".
 */
export const INVITABLE_ROLES = [
  'manager',
  'billing',
  'accountant',
  'salesperson',
  'ca',
] as const satisfies readonly Role[]

export type InvitableRole = (typeof INVITABLE_ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  billing: 'Billing',
  accountant: 'Accountant',
  salesperson: 'Salesperson',
  ca: 'Chartered Accountant',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Full access, including team management and company settings.',
  manager: 'Runs day-to-day operations. Everything except team and settings.',
  billing: 'Raises invoices and manages customers. Reads stock, cannot change it.',
  accountant: 'GST filing and financial reports. Read-only everywhere else.',
  salesperson: 'Invoices, customers and the CRM pipeline.',
  ca: 'External accountant. Read-only access to GST and reports.',
}

export const PERMISSIONS = [
  'invoices:read',
  'invoices:write',
  'customers:read',
  'customers:write',
  'products:read',
  'products:write',
  'inventory:read',
  'inventory:write',
  'suppliers:read',
  'suppliers:write',
  'purchase_orders:read',
  'purchase_orders:write',
  'crm:read',
  'crm:write',
  'reports:read',
  'gst:read',
  'gst:write',
  'godowns:read',
  'godowns:write',
  'settings:read',
  'settings:write',
  /** Invite users and change their roles. */
  'team:manage',
  /** Create franchise groups, invite showrooms, respond to invites. */
  'franchise:manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

// ─── Role → permission map ───────────────────────────────────────────────────

const READ_ONLY_OPERATIONS: Permission[] = [
  'invoices:read',
  'customers:read',
  'products:read',
  'inventory:read',
  'suppliers:read',
  'purchase_orders:read',
  'godowns:read',
]

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // Everything. Listed explicitly rather than "all" so a newly added permission
  // is a deliberate grant, not an automatic one.
  admin: PERMISSIONS,

  manager: [
    ...READ_ONLY_OPERATIONS,
    'invoices:write',
    'customers:write',
    'products:write',
    'inventory:write',
    'suppliers:write',
    'purchase_orders:write',
    'crm:read',
    'crm:write',
    'reports:read',
    'gst:read',
    'gst:write',
    'godowns:write',
    'settings:read',
  ],

  billing: [
    ...READ_ONLY_OPERATIONS,
    'invoices:write',
    'customers:write',
    'crm:read',
    'gst:read',
    'settings:read',
  ],

  accountant: [
    ...READ_ONLY_OPERATIONS,
    'reports:read',
    'gst:read',
    'gst:write',
    'settings:read',
  ],

  salesperson: [
    ...READ_ONLY_OPERATIONS,
    'invoices:write',
    'customers:write',
    'crm:read',
    'crm:write',
  ],

  // External party: deliberately cannot see stock, suppliers or purchasing.
  ca: ['invoices:read', 'customers:read', 'reports:read', 'gst:read'],
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/**
 * Whether `role` grants `permission`.
 * An unknown or missing role grants nothing — fail closed, so a user whose row
 * is missing or whose role we can't parse is denied rather than waved through.
 */
export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!isRole(role)) return false
  return ROLE_PERMISSIONS[role].includes(permission)
}

/** Every permission a role holds. Useful for debugging and the team UI. */
export function permissionsFor(role: Role | null | undefined): readonly Permission[] {
  if (!isRole(role)) return []
  return ROLE_PERMISSIONS[role]
}
