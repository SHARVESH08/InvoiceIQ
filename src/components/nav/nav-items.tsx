import {
  LayoutGrid,
  FileText,
  Boxes,
  Tags,
  Users,
  Truck,
  ShoppingCart,
  MessageSquare,
  BarChart3,
  Receipt,
  Sparkles,
  Settings,
  BellRing,
  Building2,
  SquareKanban,
  PhoneCall,
  Warehouse,
  Bell,
  type LucideIcon,
} from 'lucide-react'

import { can, type Permission, type Role } from '@/lib/auth/permissions'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Numeric badge (low-stock / PO pending). Omitted when zero. */
  badge?: number
  /** How the active route is matched. Defaults to 'prefix'. */
  match?: 'exact' | 'prefix'
  /**
   * Permission required to see this entry. Omitted means "everyone in a
   * company". Hiding is cosmetic — the matching server actions enforce it.
   */
  permission?: Permission
}

export interface NavContext {
  companyType?: string | null
  lowStockCount?: number
  poPendingCount?: number
  /** True when the user owns a franchise group — surfaces the HQ nav entry. */
  isFranchiseOwner?: boolean
  /**
   * The caller's role. Undefined means "don't filter" so existing callers and
   * tests keep their previous behaviour.
   */
  role?: Role | null
  /** Unread notifications, badged on the Notifications entry. */
  unreadNotifications?: number
}

export interface NavGroups {
  main: NavItem[]
  footer: NavItem[]
}

/**
 * Customer-portal nav model. The customer area is cross-tenant (invoices from
 * every business by email match) and only has two destinations, but it reuses
 * the same shell (Sidebar / MobileNavDrawer) as the business app for a
 * consistent revamped look.
 */
export function getCustomerNavItems(): NavGroups {
  return {
    main: [
      { href: '/my', label: 'My Invoices', icon: FileText, match: 'exact' },
    ],
    footer: [
      { href: '/my/settings', label: 'Settings', icon: Settings },
    ],
  }
}

/**
 * Ordered, role-filtered nav model. Preserves the gating rules from the
 * previous nav-links.tsx. Pure data so it can be unit-tested and reused by
 * both the desktop sidebar and the mobile drawer.
 */
export function getNavItems(ctx: NavContext): { main: NavItem[]; footer: NavItem[] } {
  const {
    companyType = null,
    lowStockCount = 0,
    poPendingCount = 0,
    isFranchiseOwner = false,
    role,
    unreadNotifications = 0,
  } = ctx

  const main: NavItem[] = [
    // HQ leads the nav for franchise owners: the group view is their home base.
    ...(isFranchiseOwner
      ? [{ href: '/hq', label: 'HQ', icon: Building2 } satisfies NavItem]
      : []),
    { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid, match: 'exact' },
    { href: '/invoices', label: 'Invoices', icon: FileText, permission: 'invoices:read' },
    {
      href: lowStockCount > 0 ? '/inventory?filter=low_stock' : '/inventory',
      label: 'Inventory',
      icon: Boxes,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      permission: 'inventory:read',
    },
    { href: '/godowns', label: 'Godowns', icon: Warehouse, permission: 'godowns:read' },
    { href: '/products', label: 'Products', icon: Tags, permission: 'products:read' },
    { href: '/customers', label: 'Customers', icon: Users, permission: 'customers:read' },
    { href: '/crm', label: 'CRM', icon: SquareKanban, permission: 'crm:read' },
    { href: '/suppliers', label: 'Suppliers', icon: Truck, permission: 'suppliers:read' },
  ]

  if (companyType === 'OEM' || companyType === 'Distributor') {
    main.push({
      href: '/dashboard/purchase-orders',
      label: 'Purchase Orders',
      icon: ShoppingCart,
      // Badge is Distributor-only by design: it counts incoming POs (status='sent')
      // awaiting the distributor. OEMs see the link but no pending badge.
      badge: companyType === 'Distributor' && poPendingCount > 0 ? poPendingCount : undefined,
      permission: 'purchase_orders:read',
    })
  }
  if (companyType === 'Retailer') {
    main.push({
      href: '/dashboard/whatsapp',
      label: 'WhatsApp Orders',
      icon: MessageSquare,
      permission: 'invoices:write',
    })
  }

  main.push({
    href: '/dashboard/reports',
    label: 'Reports',
    icon: BarChart3,
    permission: 'reports:read',
  })
  main.push({ href: '/dashboard/gst', label: 'GST', icon: Receipt, permission: 'gst:read' })
  // No Chat entry: the assistant is the floating bubble (AssistantBubble), which
  // is present on every business page. /dashboard/chat still works as a deep link
  // and is reachable from the bubble's expand control.
  main.push({
    href: '/dashboard/settings/pricing-alerts',
    label: 'Pricing Alerts',
    icon: BellRing,
    permission: 'inventory:read',
  })

  const footer: NavItem[] = [
    // No permission: notifications belong to the person, not the role. Every
    // member of a company has an inbox.
    {
      href: '/notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
    },
    // Franchise (where a showroom admin accepts invites) and Telephony are tabs
    // inside Settings now, so one entry covers all of them.
    { href: '/settings', label: 'Settings', icon: Settings, permission: 'settings:read' },
  ]

  // role === undefined means the caller didn't supply one — leave the nav
  // untouched rather than silently hiding everything.
  if (role === undefined) return { main, footer }

  const allowed = (item: NavItem) => !item.permission || can(role, item.permission)
  return { main: main.filter(allowed), footer: footer.filter(allowed) }
}

export function isNavItemActive(
  href: string,
  match: 'exact' | 'prefix' | undefined,
  pathname: string,
): boolean {
  const base = href.split('?')[0]
  if (match === 'exact') return pathname === base
  return pathname === base || pathname.startsWith(base + '/')
}
