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
}

/**
 * Ordered, role-filtered nav model. Preserves the gating rules from the
 * previous nav-links.tsx. Pure data so it can be unit-tested and reused by
 * both the desktop sidebar and the mobile drawer.
 */
export function getNavItems(ctx: NavContext): { main: NavItem[]; footer: NavItem[] } {
  const { companyType = null, lowStockCount = 0, poPendingCount = 0 } = ctx

  const main: NavItem[] = [
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
      badge: companyType === 'Distributor' && poPendingCount > 0 ? poPendingCount : undefined,
    })
  }
  if (companyType === 'Retailer') {
    main.push({ href: '/dashboard/whatsapp', label: 'WhatsApp Orders', icon: MessageSquare })
  }

  main.push({ href: '/dashboard/reports', label: 'Reports', icon: BarChart3 })
  main.push({ href: '/dashboard/gst', label: 'GST', icon: Receipt })
  main.push({ href: '/dashboard/chat', label: 'Assistant', icon: Sparkles })

  const footer: NavItem[] = [
    { href: '/settings/godowns', label: 'Settings', icon: Settings },
    { href: '/dashboard/settings/pricing-alerts', label: 'Pricing Alerts', icon: BellRing },
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
