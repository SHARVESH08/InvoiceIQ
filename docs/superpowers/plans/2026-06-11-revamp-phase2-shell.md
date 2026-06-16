# UI/UX Revamp — Phase 2: App Shell (Sidebar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the business app's top horizontal nav with a collapsible left **Sidebar** (expanded by default, flat list, icon on every item, gold active state, cookie-persisted collapse), driven by the Phase 1 `MenuToggle`; keep and restyle the mobile drawer; retheme the `ResumeBanner` for the dark palette.

**Architecture:** Nav destinations + role-gating + badges move into a pure, testable data module (`nav-items.tsx`). A presentational `SidebarNav` renders that list (vertical, with a `collapsed` mode) and is reused by both the desktop `Sidebar` and the mobile drawer. The server `(business)/layout.tsx` reads the `sidebar_collapsed` cookie (so SSR matches client, no hydration flash) and renders `Sidebar` beside a content column wrapped in the Phase 1 `PageTransition`.

**Tech Stack:** Next.js 16 App Router (Server + Client Components, `next/headers` cookies), Tailwind, lucide-react icons, Vitest + jsdom, Phase 1 primitives (`MenuToggle`, `PageTransition`).

**Source spec:** `docs/superpowers/specs/2026-06-11-ui-ux-revamp-design.md` (§7). **Depends on:** Phase 1 (Midnight Gold tokens, `MenuToggle`, `PageTransition`).

**Preserve exactly (from current `src/components/nav-links.tsx`):** role-gating — WhatsApp Orders only for `Retailer`; Purchase Orders only for `OEM`/`Distributor` (with pending badge for `Distributor`); low-stock badge + `?filter=low_stock` href on Inventory; Dashboard active only on exact `/dashboard`.

---

## File Structure

**Created**
- `src/components/nav/nav-items.tsx` — `getNavItems(ctx)` (role-filtered ordered list + footer items) + `isNavItemActive()` + `NavItem`/`NavContext` types. Pure logic, no DOM.
- `src/components/nav/nav-items.test.ts` — role gating, badges, active matcher.
- `src/components/nav/sidebar-nav.tsx` — presentational vertical nav list (active state, collapsed mode, badges). Client.
- `src/components/nav/sidebar-nav.test.tsx` — active item + collapsed rendering (jsdom).
- `src/components/sidebar.tsx` — desktop collapsible sidebar (logo, MenuToggle, nav, footer, user, logout; cookie persistence). Client.
- `src/components/sidebar.test.tsx` — collapse toggle writes cookie + width class (jsdom).

**Modified**
- `src/components/logout-button.tsx` — add `iconOnly` variant for the collapsed rail.
- `src/app/(business)/layout.tsx` — read cookie, render `Sidebar` + content column + `PageTransition`; drop the top `<nav>`.
- `src/components/mobile-header.tsx` + `src/components/mobile-nav-drawer.tsx` — reuse `SidebarNav`/`NavContext` instead of `NavLinks`.
- `src/components/resume-banner.tsx` — retheme amber→dark/gold.

**Deleted**
- `src/components/nav-links.tsx` — replaced by `nav-items` + `SidebarNav` (only after all importers are updated).

---

## Task 1: Nav data module (`nav-items`)

**Files:**
- Create: `src/components/nav/nav-items.tsx`
- Test: `src/components/nav/nav-items.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/components/nav/nav-items.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, verify it FAILS**

Run: `npm test -- src/components/nav/nav-items.test.ts`
Expected: FAIL ("Cannot find module './nav-items'").

- [ ] **Step 3: Create `src/components/nav/nav-items.tsx`**

```tsx
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
```

- [ ] **Step 4: Run test, verify it PASSES**

Run: `npm test -- src/components/nav/nav-items.test.ts`
Expected: PASS (7 tests). If any lucide icon name fails to import (the repo's `lucide-react` is pinned oddly), substitute a valid exported icon of similar meaning and re-run. Fix code, not tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/nav/nav-items.tsx src/components/nav/nav-items.test.ts
git commit -m "feat(nav): role-gated nav-items data model + active matcher"
```

---

## Task 2: `SidebarNav` presentational list

**Files:**
- Create: `src/components/nav/sidebar-nav.tsx`
- Test: `src/components/nav/sidebar-nav.test.tsx`

- [ ] **Step 1: Write the failing test** — create `src/components/nav/sidebar-nav.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import '../../../tests/setup-dom'

vi.mock('next/navigation', () => ({ usePathname: () => '/invoices' }))

import { SidebarNav } from './sidebar-nav'
import { getNavItems } from './nav-items'

describe('SidebarNav', () => {
  it('marks the item matching the current path as current', () => {
    const { main } = getNavItems({ companyType: 'Retailer' })
    render(<SidebarNav items={main} />)
    const invoices = screen.getByRole('link', { name: /invoices/i })
    expect(invoices).toHaveAttribute('aria-current', 'page')
    const dashboard = screen.getByRole('link', { name: /dashboard/i })
    expect(dashboard).not.toHaveAttribute('aria-current')
  })

  it('hides text labels when collapsed (icons remain)', () => {
    const { main } = getNavItems({ companyType: 'Retailer' })
    render(<SidebarNav items={main} collapsed />)
    // label text is not rendered when collapsed; the link is still present via aria-label
    expect(screen.queryByText('Invoices')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Invoices' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS**

Run: `npm test -- src/components/nav/sidebar-nav.test.tsx`
Expected: FAIL ("Cannot find module './sidebar-nav'").

- [ ] **Step 3: Create `src/components/nav/sidebar-nav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NavItem, isNavItemActive } from './nav-items'

export function SidebarNav({
  items,
  collapsed = false,
  onNavigate,
}: {
  items: NavItem[]
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isNavItemActive(item.href, item.match, pathname)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
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
```

- [ ] **Step 4: Run test, verify it PASSES**

Run: `npm test -- src/components/nav/sidebar-nav.test.tsx`
Expected: PASS (2 tests). Fix code, not tests, until green.

- [ ] **Step 5: Commit**

```bash
git add src/components/nav/sidebar-nav.tsx src/components/nav/sidebar-nav.test.tsx
git commit -m "feat(nav): SidebarNav list with active state + collapsed mode"
```

---

## Task 3: `LogoutButton` icon-only variant

**Files:**
- Modify: `src/components/logout-button.tsx`

No new test (covered by build + the sidebar test rendering it); small additive change.

- [ ] **Step 1: Add an `iconOnly` prop to `src/components/logout-button.tsx`**

Replace the component body so it supports an icon-only collapsed rendering. The full new file:

```tsx
import { LogOut } from 'lucide-react'

import { cn } from '@/lib/utils'
import { signOut } from '@/lib/actions/auth-shared'

// LogoutButton: a <form> bound to the signOut server action.
// variant: 'inline' (header item) | 'mobile' (full-width 44px drawer item)
// iconOnly: collapsed-sidebar rendering — icon only, label moved to title/sr-only.
export function LogoutButton({
  variant = 'inline',
  iconOnly = false,
}: {
  variant?: 'inline' | 'mobile'
  iconOnly?: boolean
}) {
  return (
    <form action={signOut} className={variant === 'mobile' ? 'w-full' : undefined}>
      <button
        type="submit"
        title={iconOnly ? 'Log out' : undefined}
        aria-label={iconOnly ? 'Log out' : undefined}
        className={cn(
          'flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
          variant === 'mobile' && 'min-h-[44px] w-full px-2',
          iconOnly && 'w-full justify-center',
        )}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {iconOnly ? <span className="sr-only">Log out</span> : 'Log out'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/logout-button.tsx
git commit -m "feat(nav): LogoutButton iconOnly variant for collapsed rail"
```

---

## Task 4: `Sidebar` (desktop, collapsible, cookie-persisted)

**Files:**
- Create: `src/components/sidebar.tsx`
- Test: `src/components/sidebar.test.tsx`

- [ ] **Step 1: Write the failing test** — create `src/components/sidebar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import '../../tests/setup-dom'

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))
// signOut is a server action imported transitively by LogoutButton; stub it.
vi.mock('@/lib/actions/auth-shared', () => ({ signOut: async () => {} }))

import { Sidebar } from './sidebar'

describe('Sidebar', () => {
  beforeEach(() => {
    document.cookie = 'sidebar_collapsed=; max-age=0; path=/'
  })

  it('renders expanded by default with the brand wordmark', () => {
    render(<Sidebar companyType="Retailer" userEmail="a@b.com" />)
    expect(screen.getByText('InvoiceIQ')).toBeInTheDocument()
  })

  it('collapses on toggle and writes the cookie', async () => {
    render(<Sidebar companyType="Retailer" userEmail="a@b.com" />)
    const toggle = screen.getByRole('checkbox', { name: /collapse sidebar/i })
    await userEvent.click(toggle)
    expect(document.cookie).toContain('sidebar_collapsed=1')
    // wordmark hidden once collapsed
    expect(screen.queryByText('InvoiceIQ')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS**

Run: `npm test -- src/components/sidebar.test.tsx`
Expected: FAIL ("Cannot find module './sidebar'").

- [ ] **Step 3: Create `src/components/sidebar.tsx`**

```tsx
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
    document.cookie = `${COOKIE}=${nextCollapsed ? '1' : '0'};path=/;max-age=31536000;samesite=lax`
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
            {userEmail.charAt(0)}
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
```

- [ ] **Step 4: Run test, verify it PASSES**

Run: `npm test -- src/components/sidebar.test.tsx`
Expected: PASS (2 tests). Fix code, not tests, until green.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar.tsx src/components/sidebar.test.tsx
git commit -m "feat(shell): collapsible cookie-persisted Sidebar"
```

---

## Task 5: Integrate the shell (layout + mobile drawer + ResumeBanner; remove nav-links)

**Files:**
- Modify: `src/app/(business)/layout.tsx`
- Modify: `src/components/mobile-nav-drawer.tsx`
- Modify: `src/components/mobile-header.tsx`
- Modify: `src/components/resume-banner.tsx`
- Delete: `src/components/nav-links.tsx`

Integration task (no new unit test); verified by build + the existing component tests + manual dev-server check.

- [ ] **Step 1: Confirm all `nav-links` importers**

Run: `git grep -n "nav-links\|NavLinks" -- src`
Expected importers: `src/app/(business)/layout.tsx`, `src/components/mobile-header.tsx`, `src/components/mobile-nav-drawer.tsx`. If `git grep` reports others, they must be updated in this task too before deletion.

- [ ] **Step 2: Update `src/components/mobile-nav-drawer.tsx`** to use `SidebarNav` + `NavContext`:

```tsx
'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SidebarNav } from '@/components/nav/sidebar-nav'
import { getNavItems, type NavContext } from '@/components/nav/nav-items'
import { LogoutButton } from '@/components/logout-button'

interface Props extends NavContext {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNavDrawer({ open, onOpenChange, ...ctx }: Props) {
  const { main, footer } = getNavItems(ctx)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] bg-card p-0">
        <div className="flex flex-col gap-3 p-4 pt-8">
          <SidebarNav items={main} onNavigate={() => onOpenChange(false)} />
          <div className="border-t border-border pt-3">
            <SidebarNav items={footer} onNavigate={() => onOpenChange(false)} />
          </div>
          <div className="mt-1 border-t border-border pt-3">
            <LogoutButton variant="mobile" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 3: Update `src/components/mobile-header.tsx`** to type props as `NavContext` (drop the `NavLinksProps` import):

Change the import line `import type { NavLinksProps } from '@/components/nav-links'` to:

```tsx
import type { NavContext } from '@/components/nav/nav-items'
```

and change the component signature `export function MobileHeader(props: NavLinksProps) {` to:

```tsx
export function MobileHeader(props: NavContext) {
```

Leave the rest (the `Menu` button, `MobileNavDrawer` usage) unchanged.

- [ ] **Step 4: Retheme `src/components/resume-banner.tsx`** for the dark palette (replace the amber classes). Full new file:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

export function ResumeBanner({ step }: { step: number }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  const nextStep = step + 1
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Your setup is incomplete</p>
        <p className="text-sm text-muted-foreground">
          Finish setting up your account to start creating invoices.{' '}
          <Link href={`/onboarding?step=${nextStep}`} className="font-medium text-primary underline">
            Continue setup →
          </Link>
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="ml-4 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Rewrite `src/app/(business)/layout.tsx`** to render the sidebar shell.

Keep ALL the existing server-side data fetching (the `try/catch` that resolves `user`, `lowStockCount`, `companyType`, `poPendingCount`, `onboardingStep`, `onboardingCompleted`) exactly as-is. Only change: (a) add imports, (b) read the cookie, (c) replace the returned JSX. Specifically:

Replace the imports block at the top:

```tsx
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getCachedLowStockCount } from '@/lib/cache/low-stock'
import { MobileHeader } from '@/components/mobile-header'
import { ResumeBanner } from '@/components/resume-banner'
import { Sidebar } from '@/components/sidebar'
import { PageTransition } from '@/components/motion/page-transition'
```

(Note: `NavLinks` and `LogoutButton` imports are removed from this file; the sidebar owns logout now.)

Then, after the data-fetching `try/catch` and before `return`, read the cookie:

```tsx
  const cookieStore = await cookies()
  const defaultCollapsed = cookieStore.get('sidebar_collapsed')?.value === '1'
```

Replace the entire `return ( ... )` block with:

```tsx
  return (
    <div className="flex min-h-screen">
      <Sidebar
        userEmail={user?.email ?? ''}
        companyType={companyType}
        lowStockCount={lowStockCount}
        poPendingCount={poPendingCount}
        defaultCollapsed={defaultCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader
          lowStockCount={lowStockCount}
          companyType={companyType}
          poPendingCount={poPendingCount}
        />
        <main className="flex-1 p-6">
          {!onboardingCompleted && <ResumeBanner step={onboardingStep} />}
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  )
```

- [ ] **Step 6: Delete the obsolete `nav-links.tsx`**

```bash
git rm src/components/nav-links.tsx
```

- [ ] **Step 7: Verify build + targeted tests**

Run: `npm run build`
Expected: success, and NO unresolved-import errors referencing `nav-links` (proves all importers were updated).
Run: `npm test -- src/components`
Expected: the Phase 1 + Phase 2 component tests pass (spotlight-card, switch-animated, menu-toggle, skeleton, reveal, nav-items, sidebar-nav, sidebar).

- [ ] **Step 8: Manual dev-server check**

Run `npm run dev`, log in, open the business app. Verify on desktop: left sidebar, expanded by default, gold active item, Inventory low-stock badge, the menu-toggle collapses to a 64px icon rail and the choice survives a page refresh (cookie). On mobile width: the top hamburger opens the drawer with the same items. Confirm role-gating (WhatsApp vs Purchase Orders) is unchanged for the logged-in company type.

- [ ] **Step 9: Commit**

```bash
git add src/app/(business)/layout.tsx src/components/mobile-nav-drawer.tsx src/components/mobile-header.tsx src/components/resume-banner.tsx
git commit -m "feat(shell): left sidebar layout + mobile drawer reuse + dark ResumeBanner; remove top nav"
```

---

## Self-Review Notes (coverage vs spec §7)

- Top nav → left sidebar, expanded default, flat list, icon per item, gold active → Tasks 2, 4, 5.
- Collapsible via MenuToggle + persisted (cookie, SSR-matched) → Task 4 + layout cookie read (Task 5).
- Role-gating + badges preserved → Task 1 (data) verified by tests; consumed everywhere.
- Mobile drawer kept + restyled → Task 5 Step 2.
- Logout + user pinned to footer → Task 4; icon-only collapsed → Task 3.
- `PageTransition` wraps the page slot only (not the sidebar) → Task 5 Step 5 (honors the Phase 1 caveat).
- ResumeBanner dark retheme → Task 5 Step 4.
- **Not in this phase:** applying GlowCard/spotlight to dashboard KPI cards, and the full per-page palette sweep (Phase 5); pricing-alerts rebuild (Phase 3); landing (Phase 4).
- Integration steps (layout rewrite, nav-links deletion) are verified by build + existing tests + a manual dev-server check rather than a new unit test, by nature.
```
