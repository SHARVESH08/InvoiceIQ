'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { MenuToggle } from '@/components/ui/menu-toggle'
import { LogoutButton } from '@/components/logout-button'
import { SidebarNav } from '@/components/nav/sidebar-nav'
import { getNavItems, type NavContext } from '@/components/nav/nav-items'

const COOKIE = 'sidebar_collapsed'

interface SidebarProps extends NavContext {
  userEmail: string
  defaultCollapsed?: boolean
}

export function Sidebar({ userEmail, defaultCollapsed = false, ...ctx }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const { main, footer } = getNavItems(ctx)

  function setExpanded(open: boolean) {
    const nextCollapsed = !open
    setCollapsed(nextCollapsed)
    // `;secure` only on HTTPS — added in production, omitted on http (dev/jsdom)
    // so the cookie is still stored locally.
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? ';secure' : ''
    document.cookie = `${COOKIE}=${nextCollapsed ? '1' : '0'};path=/;max-age=31536000;samesite=lax${secure}`
  }

  return (
    <aside
      className={cn(
        'hidden md:flex md:flex-col shrink-0 border-r border-border bg-card/40 transition-[width] duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Brand + toggle */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-border px-3',
          collapsed ? 'flex-col h-auto gap-2 py-3' : 'gap-2',
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2" aria-label="InvoiceIQ home">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            i
          </span>
          {!collapsed && <span className="font-display text-base font-semibold">InvoiceIQ</span>}
        </Link>
        <div className={cn(!collapsed && 'ml-auto')}>
          <MenuToggle
            open={!collapsed}
            onOpenChange={setExpanded}
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="size-5 text-muted-foreground hover:text-foreground"
          />
        </div>
      </div>

      {/* Main nav (scrolls) */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <SidebarNav items={main} collapsed={collapsed} />
      </div>

      {/* Footer: settings/pricing-alerts + user + logout */}
      <div className="border-t border-border px-2 py-3">
        <SidebarNav items={footer} collapsed={collapsed} />
        <div
          className={cn(
            'mt-3 flex items-center gap-2 px-1',
            collapsed && 'flex-col gap-2 px-0',
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold uppercase text-foreground">
            {(userEmail.charAt(0) || '?').toUpperCase()}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{userEmail}</span>
          )}
          <LogoutButton iconOnly={collapsed} />
        </div>
      </div>
    </aside>
  )
}
