# UI/UX Revamp — Phase 3: Pricing Alerts (true per-product) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the category-only pricing-alert system with **true per-product** monitoring: a `pricing_monitor_products` table, a quota-safe per-product cron, per-product + per-category toggle server actions, and a searchable product list UI where each product (and each category as a whole) has the Phase 1 animated Switch.

**Architecture:** Monitoring becomes product-level (`pricing_monitor_products`, one row per monitored product). The weekly cron still makes **one Brave Search per distinct category** (preserving the 200-call cap) to get a market average, then compares **each monitored product's** `selling_price` to its category's market average and emails one grouped alert per company. A category "master" toggle is sugar over bulk product toggles (enable/disable every product in that category). The settings page lists the company's categorized products grouped by category with per-product and per-category switches.

**Tech Stack:** Supabase (Postgres + RLS), Next.js 16 server actions + route handler, Resend, Brave Search, Vitest (`vi` mocks — NOT the repo's broken jest-style action tests), Phase 1 `SwitchAnimated` + `Skeleton`.

**Source spec:** `docs/superpowers/specs/2026-06-11-ui-ux-revamp-design.md` (§8.2), revised per user decision (2026-06-12) to **true per-product** (requires backend + cron changes the original spec did not anticipate).

**Depends on:** Phase 1 (`SwitchAnimated`, `Skeleton`). Reuses existing `products` table (`id, name, category, selling_price, company_id`), `get_company_id()` RPC, `company_users`/`companies` for admin email.

---

## File Structure

**Created**
- `supabase/migrations/20260612000030_pricing_monitor_products.sql` — new table + RLS + indexes + backfill from `pricing_monitor_categories`.
- `src/lib/actions/pricing-monitor.ts` — `getMonitoredProductIds`, `toggleProductAlert`, `toggleCategoryAlert`.
- `src/lib/actions/pricing-monitor.test.ts` — vitest, mocked Supabase.
- `src/lib/pricing/evaluate-alerts.ts` — pure `evaluateProductAlerts()` (cron decision logic) + types.
- `src/lib/pricing/evaluate-alerts.test.ts` — vitest.
- `src/lib/pricing/category-state.ts` — pure UI helpers `categoryMonitorState()` + `filterProducts()`.
- `src/lib/pricing/category-state.test.ts` — vitest.
- `src/app/(business)/dashboard/settings/pricing-alerts/_components/product-alert-manager.tsx` — new client UI.
- `src/app/(business)/dashboard/settings/pricing-alerts/_components/product-alert-manager.test.tsx` — vitest jsdom.

**Modified**
- `src/app/api/cron/pricing-alerts/route.ts` — product-level evaluation via `evaluateProductAlerts`.
- `src/app/(business)/dashboard/settings/pricing-alerts/page.tsx` — fetch categorized products + monitored ids; render `ProductAlertManager`.

**Untouched (left for a later cleanup, not used by the new page):** `src/lib/actions/pricing-alerts.ts`, `_components/pricing-alert-settings.tsx`. The new page stops importing them; deletion is deferred to avoid scope creep.

---

## Task 1: Migration — `pricing_monitor_products` (+ backfill)

**Files:** Create `supabase/migrations/20260612000030_pricing_monitor_products.sql`

> The subagent AUTHORS the file only. It must NOT attempt to apply it to any database. The controller applies it to the remote Supabase separately (it touches production).

- [ ] **Step 1: Write the migration file**

```sql
-- Phase 3 (UI revamp): per-product pricing monitoring.
-- Replaces category-only monitoring with product-level rows. The weekly cron
-- still fetches one market price per category, but alerts per monitored product.

CREATE TABLE IF NOT EXISTS public.pricing_monitor_products (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id  uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, product_id)
);

CREATE INDEX IF NOT EXISTS pricing_monitor_products_company_idx
  ON public.pricing_monitor_products (company_id);

ALTER TABLE public.pricing_monitor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_monitor_products FORCE ROW LEVEL SECURITY;

CREATE POLICY "pricing_monitor_products_select"
  ON public.pricing_monitor_products
  FOR SELECT TO authenticated
  USING (company_id = (SELECT get_company_id()));

CREATE POLICY "pricing_monitor_products_insert"
  ON public.pricing_monitor_products
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_company_id()));

CREATE POLICY "pricing_monitor_products_delete"
  ON public.pricing_monitor_products
  FOR DELETE TO authenticated
  USING (company_id = (SELECT get_company_id()));

-- Backfill: seed product-level monitoring from existing monitored categories so
-- current users keep their alerts. Mirrors the cron's old ILIKE category match.
INSERT INTO public.pricing_monitor_products (company_id, product_id)
SELECT DISTINCT p.company_id, p.id
FROM public.products p
JOIN public.pricing_monitor_categories c
  ON c.company_id = p.company_id
 AND p.category ILIKE '%' || c.category || '%'
ON CONFLICT (company_id, product_id) DO NOTHING;
```

- [ ] **Step 2: Verify SQL is self-consistent (no apply)**

Confirm: references `public.companies(id)` and `public.products(id)` (both exist), uses `get_company_id()` (exists, used by the sibling table), unique `(company_id, product_id)`, RLS enabled+forced with the three policies. Do NOT run it against a database.

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/20260612000030_pricing_monitor_products.sql
git commit -m "feat(db): pricing_monitor_products table + RLS + backfill from categories"
```

> **Controller action (NOT the subagent):** after this commit and a quick review, the controller applies the migration to the remote Supabase (via the Supabase MCP) and confirms the table + policies exist before Task 3's cron change goes live.

---

## Task 2: Server actions — per-product + per-category toggles

**Files:**
- Create: `src/lib/actions/pricing-monitor.ts`
- Test: `src/lib/actions/pricing-monitor.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/actions/pricing-monitor.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chainable Supabase query-builder mock. Each call records args; terminal
// awaits resolve to a configurable result.
const state: {
  user: unknown
  companyId: unknown
  selectResult: unknown
  mutationResult: unknown
  lastFrom?: string
} = { user: { id: 'u1' }, companyId: 'co1', selectResult: { data: [], error: null }, mutationResult: { error: null } }

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => {
  const builder = () => {
    const b: Record<string, unknown> = {}
    const chain = () => b
    b.select = vi.fn(chain)
    b.eq = vi.fn(chain)
    b.in = vi.fn(chain)
    b.not = vi.fn(chain)
    // terminal: awaiting the builder returns selectResult
    b.then = (resolve: (v: unknown) => void) => resolve(state.selectResult)
    b.upsert = vi.fn(() => Promise.resolve(state.mutationResult))
    b.delete = vi.fn(() => ({
      eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve(state.mutationResult)), in: vi.fn(() => Promise.resolve(state.mutationResult)) })),
    }))
    return b
  }
  return {
    createClient: vi.fn().mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: state.user } })) },
      rpc: vi.fn(async () => ({ data: state.companyId })),
      from: vi.fn(() => builder()),
    }),
  }
})

import { toggleProductAlert, toggleCategoryAlert } from './pricing-monitor'

beforeEach(() => {
  state.user = { id: 'u1' }
  state.companyId = 'co1'
  state.selectResult = { data: [], error: null }
  state.mutationResult = { error: null }
})

describe('toggleProductAlert', () => {
  it('rejects when unauthenticated', async () => {
    state.user = null
    const res = await toggleProductAlert('p1', true)
    expect(res).toEqual({ error: 'Not authenticated' })
  })

  it('returns success on enable', async () => {
    const res = await toggleProductAlert('p1', true)
    expect(res).toEqual({ success: true })
  })

  it('surfaces a DB error', async () => {
    state.mutationResult = { error: { message: 'boom' } }
    const res = await toggleProductAlert('p1', true)
    expect('error' in res).toBe(true)
  })
})

describe('toggleCategoryAlert', () => {
  it('enabling with no products in category errors', async () => {
    state.selectResult = { data: [], error: null } // no products found
    const res = await toggleCategoryAlert('Steel', true)
    expect('error' in res).toBe(true)
  })

  it('enabling upserts and returns success', async () => {
    state.selectResult = { data: [{ id: 'p1' }, { id: 'p2' }], error: null }
    const res = await toggleCategoryAlert('Steel', true)
    expect(res).toEqual({ success: true })
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS**

Run: `npm test -- src/lib/actions/pricing-monitor.test.ts`
Expected: FAIL ("Cannot find module './pricing-monitor'").

- [ ] **Step 3: Create `src/lib/actions/pricing-monitor.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const PAGE = '/dashboard/settings/pricing-alerts'

type Result = { success: true } | { error: string }

async function ctx() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) return { error: 'No company found' as const }
  return { supabase, companyId: companyId as string }
}

/** All product_ids monitored for the authenticated user's company. */
export async function getMonitoredProductIds(): Promise<string[]> {
  const c = await ctx()
  if ('error' in c) return []
  const { data } = await c.supabase
    .from('pricing_monitor_products')
    .select('product_id')
    .eq('company_id', c.companyId)
  return (data ?? []).map((r) => r.product_id as string)
}

/** Enable/disable price monitoring for a single product. */
export async function toggleProductAlert(productId: string, enabled: boolean): Promise<Result> {
  if (!productId) return { error: 'Product is required' }
  const c = await ctx()
  if ('error' in c) return c

  if (enabled) {
    const { error } = await c.supabase
      .from('pricing_monitor_products')
      .upsert(
        { company_id: c.companyId, product_id: productId },
        { onConflict: 'company_id,product_id', ignoreDuplicates: true },
      )
    if (error) return { error: 'Failed to enable alert' }
  } else {
    const { error } = await c.supabase
      .from('pricing_monitor_products')
      .delete()
      .eq('company_id', c.companyId)
      .eq('product_id', productId)
    if (error) return { error: 'Failed to disable alert' }
  }
  revalidatePath(PAGE)
  return { success: true }
}

/** Enable/disable monitoring for every product in a category (the master toggle). */
export async function toggleCategoryAlert(category: string, enabled: boolean): Promise<Result> {
  const trimmed = category?.trim() ?? ''
  if (!trimmed) return { error: 'Category is required' }
  const c = await ctx()
  if ('error' in c) return c

  const { data: prodRows, error: prodErr } = await c.supabase
    .from('products')
    .select('id')
    .eq('company_id', c.companyId)
    .eq('category', trimmed)
  if (prodErr) return { error: 'Failed to read products' }

  const ids = (prodRows ?? []).map((r) => r.id as string)
  if (ids.length === 0) return { error: 'No products in this category' }

  if (enabled) {
    const { error } = await c.supabase
      .from('pricing_monitor_products')
      .upsert(
        ids.map((product_id) => ({ company_id: c.companyId, product_id })),
        { onConflict: 'company_id,product_id', ignoreDuplicates: true },
      )
    if (error) return { error: 'Failed to enable category' }
  } else {
    const { error } = await c.supabase
      .from('pricing_monitor_products')
      .delete()
      .eq('company_id', c.companyId)
      .in('product_id', ids)
    if (error) return { error: 'Failed to disable category' }
  }
  revalidatePath(PAGE)
  return { success: true }
}
```

- [ ] **Step 4: Run test, verify it PASSES**

Run: `npm test -- src/lib/actions/pricing-monitor.test.ts`
Expected: PASS (5 tests). If the chainable mock needs tweaks to match the call shapes, adjust the TEST MOCK (not the action logic) until green — the actions are the source of truth for behavior.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/pricing-monitor.ts src/lib/actions/pricing-monitor.test.ts
git commit -m "feat(pricing): per-product + per-category monitor toggle actions"
```

---

## Task 3: Cron — per-product evaluation (pure fn + route rewire)

**Files:**
- Create: `src/lib/pricing/evaluate-alerts.ts`, `src/lib/pricing/evaluate-alerts.test.ts`
- Modify: `src/app/api/cron/pricing-alerts/route.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/pricing/evaluate-alerts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { evaluateProductAlerts, type MonitoredProduct } from './evaluate-alerts'

const p = (over: Partial<MonitoredProduct>): MonitoredProduct => ({
  company_id: 'co1', product_id: 'p1', name: 'Item', category: 'Steel', selling_price: 100, ...over,
})

describe('evaluateProductAlerts', () => {
  it('flags a product whose price deviates more than the threshold', () => {
    const out = evaluateProductAlerts([p({ selling_price: 100 })], { Steel: 130 }) // +30%
    expect(out.get('co1')).toHaveLength(1)
    expect(out.get('co1')![0].name).toBe('Item')
  })

  it('ignores products within threshold', () => {
    const out = evaluateProductAlerts([p({ selling_price: 100 })], { Steel: 105 }) // 5%
    expect(out.size).toBe(0)
  })

  it('skips products with no market price for their category or zero price', () => {
    const out = evaluateProductAlerts(
      [p({ category: 'Unknown' }), p({ product_id: 'p2', selling_price: 0 })],
      { Steel: 130 },
    )
    expect(out.size).toBe(0)
  })

  it('groups multiple flagged products by company', () => {
    const out = evaluateProductAlerts(
      [p({ product_id: 'p1' }), p({ product_id: 'p2', name: 'Rod' })],
      { Steel: 200 },
    )
    expect(out.get('co1')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS**

Run: `npm test -- src/lib/pricing/evaluate-alerts.test.ts`
Expected: FAIL ("Cannot find module './evaluate-alerts'").

- [ ] **Step 3: Create `src/lib/pricing/evaluate-alerts.ts`**

```ts
export interface MonitoredProduct {
  company_id: string
  product_id: string
  name: string
  category: string
  selling_price: number
}

export interface ProductAlert {
  name: string
  category: string
  companyPrice: number
  marketAvg: number
  deltaPct: number // absolute % difference
}

/**
 * Pure cron decision logic. For each monitored product, compare its selling
 * price to the market average for its category; collect products whose
 * deviation exceeds `threshold` (default 10%), grouped by company.
 */
export function evaluateProductAlerts(
  products: MonitoredProduct[],
  marketAvgByCategory: Record<string, number>,
  threshold = 0.1,
): Map<string, ProductAlert[]> {
  const byCompany = new Map<string, ProductAlert[]>()
  for (const p of products) {
    const marketAvg = marketAvgByCategory[p.category]
    if (marketAvg == null || !(p.selling_price > 0)) continue
    const delta = Math.abs(marketAvg - p.selling_price) / p.selling_price
    if (delta <= threshold) continue
    const arr = byCompany.get(p.company_id) ?? []
    arr.push({
      name: p.name,
      category: p.category,
      companyPrice: p.selling_price,
      marketAvg,
      deltaPct: delta * 100,
    })
    byCompany.set(p.company_id, arr)
  }
  return byCompany
}
```

- [ ] **Step 4: Run test, verify it PASSES**

Run: `npm test -- src/lib/pricing/evaluate-alerts.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Rewire `src/app/api/cron/pricing-alerts/route.ts` to product-level**

Replace the body between the `supabase`/`resend` client creation and the final `return NextResponse.json(...)`. Keep the CRON_SECRET guard (lines ~9-16) and the client creation (lines ~19-24) EXACTLY as they are. Replace the category-fetch-through-email loop with:

```ts
    // Fetch all monitored products joined with their product data.
    const { data: monRows, error: monErr } = await supabase
      .from('pricing_monitor_products')
      .select('company_id, products(id, name, category, selling_price)')

    if (monErr) {
      console.error('[pricing-alerts] fetch monitored products error:', monErr)
      return NextResponse.json({ error: 'Failed to fetch monitored products' }, { status: 500 })
    }

    type Joined = { company_id: string; products: { id: string; name: string | null; category: string | null; selling_price: number | null } | null }
    const monitored = ((monRows ?? []) as Joined[])
      .map((r) => ({
        company_id: r.company_id,
        product_id: r.products?.id ?? '',
        name: r.products?.name ?? 'product',
        category: (r.products?.category ?? '').trim(),
        selling_price: r.products?.selling_price ?? 0,
      }))
      .filter((m) => m.category.length > 0 && m.selling_price > 0)

    // One Brave call per distinct category (preserve the 200-call cap).
    const MAX_BRAVE_CALLS = 200
    const categories = Array.from(new Set(monitored.map((m) => m.category))).slice(0, MAX_BRAVE_CALLS)

    const marketAvgByCategory: Record<string, number> = {}
    for (const category of categories) {
      try {
        const results = await searchBrave(`${category} price india wholesale`, 10)
        const avg = computeAveragePrice(extractPricesFromResults(results))
        if (avg !== null) marketAvgByCategory[category] = avg
      } catch (braveErr) {
        console.error(`[pricing-alerts] Brave error for "${category}":`, braveErr)
      }
    }

    // Decide which products to alert on, grouped by company.
    const alertsByCompany = evaluateProductAlerts(monitored, marketAvgByCategory)

    let alertsSent = 0
    for (const [companyId, alerts] of alertsByCompany) {
      const { data: adminRows } = await supabase
        .from('company_users')
        .select('user_id, companies(name)')
        .eq('company_id', companyId)
        .eq('role', 'admin')
        .limit(1)
      const adminUser = adminRows?.[0]
      if (!adminUser) continue

      const { data: authUser } = await supabase.auth.admin.getUserById(adminUser.user_id)
      const adminEmail = authUser?.user?.email
      if (!adminEmail) continue

      const companyName = (adminUser.companies as { name?: string } | null)?.name ?? 'Your company'
      const lines = alerts.map(
        (a) =>
          `  • ${a.name} (${a.category}): yours ₹${a.companyPrice.toFixed(2)} vs market ₹${a.marketAvg.toFixed(2)} (${a.deltaPct.toFixed(1)}% off)`,
      )

      const { error: emailError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: adminEmail,
        subject: `Pricing alert: ${alerts.length} product${alerts.length === 1 ? '' : 's'} need a look`,
        text: [
          `Hello ${companyName},`,
          '',
          'These monitored products are priced more than 10% away from the market:',
          '',
          ...lines,
          '',
          'Review them at:',
          `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://invoiceiq.in'}/dashboard/settings/pricing-alerts`,
          '',
          "This alert was generated by InvoiceIQ's automated pricing monitor.",
        ].join('\n'),
      })
      if (emailError) {
        console.error(`[pricing-alerts] Resend error company=${companyId}:`, emailError)
      } else {
        alertsSent += alerts.length
      }
    }

    return NextResponse.json(
      { categories_checked: Object.keys(marketAvgByCategory).length, alerts_sent: alertsSent },
      { status: 200 },
    )
```

Also add the import at the top of the route file (next to the existing brave import):

```ts
import { evaluateProductAlerts } from '@/lib/pricing/evaluate-alerts'
```

Remove the now-unused old category loop entirely (no references to `pricing_monitor_categories`, `categoryToCompanies`, or `categoriesChecked` should remain in this file).

- [ ] **Step 6: Verify build + the cron compiles**

Run: `npm run build`
Expected: success, no unused-symbol/type errors in the route. Run `npm test -- src/lib/pricing/evaluate-alerts.test.ts` again to confirm still green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pricing/evaluate-alerts.ts src/lib/pricing/evaluate-alerts.test.ts "src/app/api/cron/pricing-alerts/route.ts"
git commit -m "feat(pricing): per-product cron evaluation (one Brave call per category)"
```

---

## Task 4: UI helpers — category state + search filter

**Files:**
- Create: `src/lib/pricing/category-state.ts`, `src/lib/pricing/category-state.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/pricing/category-state.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { categoryMonitorState, filterProducts, type ProductRow } from './category-state'

const rows: ProductRow[] = [
  { id: 'a', name: 'Rebar 8mm', category: 'Steel', selling_price: 100 },
  { id: 'b', name: 'Rebar 10mm', category: 'Steel', selling_price: 120 },
  { id: 'c', name: 'Cement Bag', category: 'Cement', selling_price: 400 },
]

describe('categoryMonitorState', () => {
  it('returns "all" when every product in the category is monitored', () => {
    expect(categoryMonitorState(rows, 'Steel', new Set(['a', 'b']))).toBe('all')
  })
  it('returns "some" when partially monitored', () => {
    expect(categoryMonitorState(rows, 'Steel', new Set(['a']))).toBe('some')
  })
  it('returns "none" when nothing in the category is monitored', () => {
    expect(categoryMonitorState(rows, 'Steel', new Set(['c']))).toBe('none')
  })
})

describe('filterProducts', () => {
  it('matches by product name (case-insensitive)', () => {
    expect(filterProducts(rows, 'rebar').map((r) => r.id)).toEqual(['a', 'b'])
  })
  it('matches by category', () => {
    expect(filterProducts(rows, 'cement').map((r) => r.id)).toEqual(['c'])
  })
  it('returns all rows for empty query', () => {
    expect(filterProducts(rows, '   ')).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS**

Run: `npm test -- src/lib/pricing/category-state.test.ts`
Expected: FAIL ("Cannot find module './category-state'").

- [ ] **Step 3: Create `src/lib/pricing/category-state.ts`**

```ts
export interface ProductRow {
  id: string
  name: string
  category: string
  selling_price: number
}

export type CategoryState = 'all' | 'some' | 'none'

/** Aggregate monitor state of one category given the set of monitored ids. */
export function categoryMonitorState(
  products: ProductRow[],
  category: string,
  monitored: Set<string>,
): CategoryState {
  const inCat = products.filter((p) => p.category === category)
  if (inCat.length === 0) return 'none'
  const on = inCat.filter((p) => monitored.has(p.id)).length
  if (on === 0) return 'none'
  if (on === inCat.length) return 'all'
  return 'some'
}

/** Case-insensitive filter over product name + category. */
export function filterProducts(products: ProductRow[], query: string): ProductRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return products
  return products.filter(
    (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
  )
}
```

- [ ] **Step 4: Run test, verify it PASSES**

Run: `npm test -- src/lib/pricing/category-state.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing/category-state.ts src/lib/pricing/category-state.test.ts
git commit -m "feat(pricing): category-state + product-search helpers"
```

---

## Task 5: New UI — `ProductAlertManager` + page wiring

**Files:**
- Create: `src/app/(business)/dashboard/settings/pricing-alerts/_components/product-alert-manager.tsx`
- Test: `src/app/(business)/dashboard/settings/pricing-alerts/_components/product-alert-manager.test.tsx`
- Modify: `src/app/(business)/dashboard/settings/pricing-alerts/page.tsx`

- [ ] **Step 1: Write the failing test** — create `_components/product-alert-manager.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
// 6 dirs up: _components → pricing-alerts → settings → dashboard → (business) → app → src → root
import '../../../../../../../tests/setup-dom'

const toggleProductAlert = vi.fn(async () => ({ success: true }))
const toggleCategoryAlert = vi.fn(async () => ({ success: true }))
vi.mock('@/lib/actions/pricing-monitor', () => ({ toggleProductAlert, toggleCategoryAlert }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { ProductAlertManager } from './product-alert-manager'

const products = [
  { id: 'a', name: 'Rebar 8mm', category: 'Steel', selling_price: 100 },
  { id: 'b', name: 'Cement Bag', category: 'Cement', selling_price: 400 },
]

describe('ProductAlertManager', () => {
  it('renders products grouped by category and a switch per product', () => {
    render(<ProductAlertManager products={products} initialMonitoredIds={['a']} />)
    expect(screen.getByText('Rebar 8mm')).toBeInTheDocument()
    expect(screen.getByText('Steel')).toBeInTheDocument()
    // one checkbox per product + one per category header (2 products, 2 categories)
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThanOrEqual(4)
  })

  it('filters by search query', async () => {
    render(<ProductAlertManager products={products} initialMonitoredIds={[]} />)
    await userEvent.type(screen.getByRole('searchbox'), 'cement')
    expect(screen.getByText('Cement Bag')).toBeInTheDocument()
    expect(screen.queryByText('Rebar 8mm')).not.toBeInTheDocument()
  })

  it('calls toggleProductAlert when a product switch is toggled', async () => {
    render(<ProductAlertManager products={products} initialMonitoredIds={[]} />)
    const rebarSwitch = screen.getByRole('checkbox', { name: /monitor rebar 8mm/i })
    await userEvent.click(rebarSwitch)
    expect(toggleProductAlert).toHaveBeenCalledWith('a', true)
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS**

Run: `npm test -- "src/app/(business)/dashboard/settings/pricing-alerts/_components/product-alert-manager.test.tsx"`
Expected: FAIL ("Cannot find module './product-alert-manager'"). If the setup-dom relative path is wrong, count the directories and correct it before continuing.

- [ ] **Step 3: Create `_components/product-alert-manager.tsx`**

```tsx
'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SwitchAnimated } from '@/components/ui/switch-animated'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  categoryMonitorState,
  filterProducts,
  type ProductRow,
} from '@/lib/pricing/category-state'
import { toggleProductAlert, toggleCategoryAlert } from '@/lib/actions/pricing-monitor'

export function ProductAlertManager({
  products,
  initialMonitoredIds,
}: {
  products: ProductRow[]
  initialMonitoredIds: string[]
}) {
  const [monitored, setMonitored] = useState<Set<string>>(() => new Set(initialMonitoredIds))
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  const visible = useMemo(() => filterProducts(products, query), [products, query])

  // Group visible products by category (sorted), each with its product rows.
  const groups = useMemo(() => {
    const map = new Map<string, ProductRow[]>()
    for (const p of visible) {
      const arr = map.get(p.category) ?? []
      arr.push(p)
      map.set(p.category, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [visible])

  function setProduct(id: string, enabled: boolean) {
    // optimistic
    setMonitored((prev) => {
      const next = new Set(prev)
      if (enabled) next.add(id)
      else next.delete(id)
      return next
    })
    startTransition(async () => {
      const res = await toggleProductAlert(id, enabled)
      if ('error' in res) {
        toast.error(res.error)
        setMonitored((prev) => {
          const next = new Set(prev)
          if (enabled) next.delete(id)
          else next.add(id)
          return next
        })
      }
    })
  }

  function setCategory(category: string, enabled: boolean) {
    const ids = products.filter((p) => p.category === category).map((p) => p.id)
    const prevSnapshot = new Set(monitored)
    setMonitored((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (enabled) next.add(id)
        else next.delete(id)
      }
      return next
    })
    startTransition(async () => {
      const res = await toggleCategoryAlert(category, enabled)
      if ('error' in res) {
        toast.error(res.error)
        setMonitored(prevSnapshot)
      } else {
        toast.success(
          enabled ? `Monitoring all of ${category}` : `Stopped monitoring ${category}`,
        )
      }
    })
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No categorized products yet. Add a category to your products to monitor their prices.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Input
        type="search"
        role="searchbox"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products or categories…"
        aria-label="Search products"
        className="max-w-sm"
      />

      {groups.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No products match “{query}”.</p>
      ) : (
        groups.map(([category, rows]) => {
          const state = categoryMonitorState(products, category, monitored)
          return (
            <Card key={category}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{category}</p>
                    <p className="text-xs text-muted-foreground">
                      {state === 'all' ? 'All monitored' : state === 'some' ? 'Partially monitored' : 'Not monitored'}
                    </p>
                  </div>
                  <SwitchAnimated
                    checked={state === 'all'}
                    onCheckedChange={(v) => setCategory(category, v)}
                    disabled={isPending}
                    aria-label={`Monitor all ${category}`}
                  />
                </div>
                <ul className="divide-y divide-border">
                  {rows.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{p.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          ₹{p.selling_price.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <SwitchAnimated
                        checked={monitored.has(p.id)}
                        onCheckedChange={(v) => setProduct(p.id, v)}
                        disabled={isPending}
                        aria-label={`Monitor ${p.name}`}
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it PASSES**

Run: `npm test -- "src/app/(business)/dashboard/settings/pricing-alerts/_components/product-alert-manager.test.tsx"`
Expected: PASS (3 tests). Fix code, not tests, until green.

- [ ] **Step 5: Rewire the page `src/app/(business)/dashboard/settings/pricing-alerts/page.tsx`**

Replace its body to fetch categorized products + monitored ids and render the new manager. Full new file:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMonitoredProductIds } from '@/lib/actions/pricing-monitor'
import { ProductAlertManager } from './_components/product-alert-manager'
import type { ProductRow } from '@/lib/pricing/category-state'

// Pricing Alert Settings — RSC shell. Per-product market-price monitoring.
export default async function PricingAlertsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: companyId } = await supabase.rpc('get_company_id')
  if (!companyId) redirect('/login')

  const { data: productRows } = await supabase
    .from('products')
    .select('id, name, category, selling_price')
    .eq('company_id', companyId)
    .not('category', 'is', null)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  const products: ProductRow[] = (productRows ?? [])
    .map((p) => ({
      id: p.id as string,
      name: (p.name as string | null) ?? 'Unnamed product',
      category: ((p.category as string | null) ?? '').trim(),
      selling_price: (p.selling_price as number | null) ?? 0,
    }))
    .filter((p) => p.category.length > 0)

  const monitoredIds = await getMonitoredProductIds()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold leading-tight">Pricing Alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor market prices per product. Toggle a whole category, or pick individual products.
          We email you weekly when a monitored product drifts more than 10% from the market.
        </p>
      </div>
      <ProductAlertManager products={products} initialMonitoredIds={monitoredIds} />
    </div>
  )
}
```

- [ ] **Step 6: Verify build + full component/lib tests**

Run: `npm run build`
Expected: success.
Run: `npm test -- src/lib/pricing src/lib/actions/pricing-monitor.test.ts "src/app/(business)/dashboard/settings/pricing-alerts"`
Expected: all Phase 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(business)/dashboard/settings/pricing-alerts/_components/product-alert-manager.tsx" "src/app/(business)/dashboard/settings/pricing-alerts/_components/product-alert-manager.test.tsx" "src/app/(business)/dashboard/settings/pricing-alerts/page.tsx"
git commit -m "feat(pricing): per-product search + category/product toggle UI"
```

---

## Self-Review Notes (coverage vs decision)

- True per-product monitoring → new `pricing_monitor_products` table (Task 1) + product-level cron (Task 3) + per-product/per-category actions (Task 2).
- Category master toggle = bulk product toggle (`toggleCategoryAlert`) → Task 2; UI aggregate state (all/some/none) → Task 4 + Task 5.
- Search bar + product list like the Products tab + a switch per product → Task 5 (uses Phase 1 `SwitchAnimated`).
- Quota safety preserved: still one Brave call per distinct category, 200-call cap → Task 3.
- Existing users keep alerts via backfill → Task 1.
- **Controller (not subagent) applies the migration to the remote DB** after Task 1, before the cron change is relied upon.
- Tests use vitest `vi` (the repo's jest-style action tests are pre-existing-broken and out of scope).
- **Deferred (not this phase):** deleting the now-unused `pricing-alerts.ts` category actions + old `pricing-alert-settings.tsx`, and dropping the `pricing_monitor_categories` table — left in place to avoid risk; schedule as cleanup once per-product is verified in production.
```
