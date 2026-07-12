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
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Numeric badge (low-stock / PO pending). Omitted when zero. */
  badge?: number
  /** How the active route is matched. Defaults to 'prefix'. */
  match?: 'exact' | 'prefix'
}

export interface NavContext {
  companyType?: string | null
  lowStockCount?: number
  poPendingCount?: number
  /** True when the user owns a franchise group — surfaces the HQ nav entry. */
  isFranchiseOwner?: boolean
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
  const { companyType = null, lowStockCount = 0, poPendingCount = 0, isFranchiseOwner = false } = ctx

  const main: NavItem[] = [
    // HQ leads the nav for franchise owners: the group view is their home base.
    ...(isFranchiseOwner
      ? [{ href: '/hq', label: 'HQ', icon: Building2 } satisfies NavItem]
      : []),
    { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid, match: 'exact' },
    { href: '/invoices', label: 'Invoices', icon: FileText },
    {
      href: lowStockCount > 0 ? '/inventory?filter=low_stock' : '/inventory',
      label: 'Inventory',
      icon: Boxes,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    { href: '/products', label: 'Products', icon: Tags },
    { href: '/customers', label: 'Customers', icon: Users },
    { href: '/suppliers', label: 'Suppliers', icon: Truck },
  ]

  if (companyType === 'OEM' || companyType === 'Distributor') {
    main.push({
      href: '/dashboard/purchase-orders',
      label: 'Purchase Orders',
      icon: ShoppingCart,
      // Badge is Distributor-only by design: it counts incoming POs (status='sent')
      // awaiting the distributor. OEMs see the link but no pending badge.
      badge: companyType === 'Distributor' && poPendingCount > 0 ? poPendingCount : undefined,
    })
  }
  if (companyType === 'Retailer') {
    main.push({ href: '/dashboard/whatsapp', label: 'WhatsApp Orders', icon: MessageSquare })
  }

  main.push({ href: '/dashboard/reports', label: 'Reports', icon: BarChart3 })
  main.push({ href: '/dashboard/gst', label: 'GST', icon: Receipt })
  main.push({ href: '/dashboard/chat', label: 'Chat', icon: Sparkles })
  main.push({ href: '/dashboard/settings/pricing-alerts', label: 'Pricing Alerts', icon: BellRing })

  const footer: NavItem[] = [
    // Where a showroom admin finds (and accepts) incoming franchise invites.
    { href: '/settings/franchise', label: 'Franchise', icon: Building2 },
    { href: '/settings/godowns', label: 'Settings', icon: Settings },
  ]

  return { main, footer }
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
