'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, FileText, ShoppingCart, BarChart2 } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// NavLinks
// Renders the primary navigation links in the business layout header.
// lowStockCount: pre-fetched server-side (cached via unstable_cache in layout)
//   and passed as a prop to avoid a client-side DB round-trip on every page.
// companyType: derived server-side from get_company_context() in layout.tsx.
//   UI-only guard — RLS on whatsapp_sessions is the real security boundary (T-9-06).
// poPendingCount: count of incoming POs with status='sent' for Distributor role.
//   Fetched server-side in layout.tsx and passed as prop (no client-side DB round-trip).
// ─────────────────────────────────────────────────────────────────────────────

export interface NavLinksProps {
  lowStockCount?: number
  companyType?: string | null
  poPendingCount?: number
}

const staticLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/invoices', label: 'Invoices' },
  // Inventory is rendered separately to include the dynamic badge
  { href: '/products', label: 'Products' },
  { href: '/customers', label: 'Customers' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/settings/godowns', label: 'Settings' },
]

export default function NavLinks({
  lowStockCount = 0,
  companyType = null,
  poPendingCount = 0,
}: NavLinksProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const linkClass = (href: string) =>
    cn(
      'text-sm transition-colors flex items-center',
      isActive(href)
        ? 'text-foreground font-medium'
        : 'text-muted-foreground hover:text-foreground'
    )

  return (
    <>
      {/* Dashboard */}
      <Link key="/dashboard" href="/dashboard" className={linkClass('/dashboard')}>
        Dashboard
      </Link>

      {/* Invoices */}
      <Link key="/invoices" href="/invoices" className={linkClass('/invoices')}>
        Invoices
      </Link>

      {/* Inventory — with optional low-stock badge (per UI-SPEC + D-05) */}
      <Link
        key="/inventory"
        href={lowStockCount > 0 ? '/inventory?filter=low_stock' : '/inventory'}
        className={cn(linkClass('/inventory'), 'gap-1')}
        aria-label={
          lowStockCount > 0
            ? `Inventory: ${lowStockCount} low stock alerts`
            : undefined
        }
      >
        Inventory
        {lowStockCount > 0 && (
          <Badge
            variant="destructive"
            className="ml-1 h-4 px-1 text-xs tabular-nums"
          >
            {lowStockCount > 99 ? '99+' : lowStockCount}
          </Badge>
        )}
      </Link>

      {/* WhatsApp Orders — Retailer-only (WA-08, T-9-03) */}
      {companyType === 'Retailer' && (
        <Link
          key="/dashboard/whatsapp"
          href="/dashboard/whatsapp"
          className={cn(linkClass('/dashboard/whatsapp'), 'gap-1')}
        >
          <MessageSquare className="h-4 w-4" />
          WhatsApp Orders
        </Link>
      )}

      {/* GST Assistant — all roles (D-07, D-08) */}
      <Link
        key="/dashboard/gst"
        href="/dashboard/gst"
        className={cn(linkClass('/dashboard/gst'), 'gap-1')}
      >
        <FileText className="h-4 w-4" />
        GST
      </Link>

      {/* Purchase Orders — OEM and Distributor only (SUPPLY-01, SUPPLY-02) */}
      {(companyType === 'OEM' || companyType === 'Distributor') && (
        <Link
          key="/dashboard/purchase-orders"
          href="/dashboard/purchase-orders"
          className={cn(linkClass('/dashboard/purchase-orders'), 'gap-1')}
        >
          <ShoppingCart className="h-4 w-4" />
          Purchase Orders
          {companyType === 'Distributor' && (poPendingCount ?? 0) > 0 && (
            <Badge
              variant="destructive"
              className="ml-1 h-4 px-1 text-xs tabular-nums"
              aria-label={`Purchase Orders: ${poPendingCount} pending`}
            >
              {(poPendingCount ?? 0) > 99 ? '99+' : poPendingCount}
            </Badge>
          )}
        </Link>
      )}

      {/* Reports — all roles */}
      <Link
        key="/dashboard/reports"
        href="/dashboard/reports"
        className={cn(linkClass('/dashboard/reports'), 'gap-1')}
      >
        <BarChart2 className="h-4 w-4" />
        Reports
      </Link>

      {/* AI Chat — all roles (AI-01, AI-02) */}
      <Link
        key="/dashboard/chat"
        href="/dashboard/chat"
        className={cn(linkClass('/dashboard/chat'), 'gap-1')}
      >
        <MessageSquare className="h-4 w-4" />
        Chat
      </Link>

      {/* Products, Customers, Suppliers */}
      {staticLinks
        .filter((l) => l.href !== '/dashboard' && l.href !== '/invoices' && l.href !== '/settings/godowns')
        .map(({ href, label }) => (
          <Link key={href} href={href} className={linkClass(href)}>
            {label}
          </Link>
        ))}

      {/* Settings — godowns + pricing alerts */}
      <Link href="/settings/godowns" className={linkClass('/settings/godowns')}>
        Settings
      </Link>
      <Link
        href="/dashboard/settings/pricing-alerts"
        className={cn(linkClass('/dashboard/settings/pricing-alerts'), 'gap-1')}
      >
        Pricing Alerts
      </Link>
    </>
  )
}
