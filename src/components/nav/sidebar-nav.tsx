'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NavItem, isNavItemActive } from './nav-items'

export function SidebarNav({
  items,
  collapsed = false,
  onNavigate,
  ariaLabel,
}: {
  items: NavItem[]
  collapsed?: boolean
  onNavigate?: () => void
  /** Distinguishes multiple <nav> landmarks (e.g. "Primary" vs "Account"). */
  ariaLabel?: string
}) {
  const pathname = usePathname()
  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isNavItemActive(item.href, item.match, pathname)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            // When expanded the visible label provides the accessible name; when
            // collapsed the label text (and any badge count) is hidden, so fold
            // both into aria-label to keep the alert reachable for screen readers.
            aria-label={
              collapsed ? (item.badge ? `${item.label}, ${item.badge} alerts` : item.label) : undefined
            }
            aria-current={active ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              collapsed && 'justify-center px-0',
              active
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary"
              />
            )}
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
            {item.badge ? (
              // Collapsed rail shows only a dot (count is ambient); expand to see the number.
              collapsed ? (
                <span
                  aria-hidden
                  className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive"
                />
              ) : (
                <span className="ml-auto rounded-full bg-destructive px-1.5 text-xs font-semibold tabular-nums text-destructive-foreground">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
