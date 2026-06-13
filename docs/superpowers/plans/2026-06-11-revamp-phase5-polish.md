# UI/UX Revamp — Phase 5: Global Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish the revamp so the whole authenticated app looks consistently "Midnight Gold" dark, apply the GlowCard/glow highlights to key cards + buttons (from the original brief), and add loading animations. **Strictly UI/UX: no feature, logic, data, route, validation, or copy changes.**

**Architecture:** Three kinds of work, all presentational: (1) a mechanical color sweep replacing hardcoded light-mode utility classes with theme tokens / dark-native tints across 17 files; (2) GlowCard spotlight on the dashboard hero KPI + a subtle gold glow on primary buttons; (3) `loading.tsx` skeleton screens for the main data routes. shadcn components already render dark via tokens, so only the listed hardcoded spots need fixing.

**Tech Stack:** Tailwind tokens, Phase 1 `SpotlightCard`/`Skeleton`, existing shadcn components.

**Source spec:** `docs/superpowers/specs/2026-06-11-ui-ux-revamp-design.md` (§3, §5, §6, §11) + original brief ("give highlights to buttons and cards", "loading page animations").

---

## NON-NEGOTIABLE GUARDRAIL (applies to EVERY task)

This is a UI-only phase. For every edit:
- **ONLY** change color-related Tailwind utility classes (bg-*, text-*, border-*, ring-*, shadow tints) and add presentational wrappers/classes.
- **NEVER** change: JSX structure, component props/signatures, conditionals, loops, event handlers, server actions, data fetching, routes/hrefs, form fields, validation, state logic, or any visible text/copy/labels.
- **NEVER** remove or rename a feature, link, button, or field.
- After each file: `git diff` must show only className/color and additive-wrapper changes. If a change would alter behavior, STOP and report.
- Preserve the exact semantic meaning of status colors (paid stays green, overdue stays orange/amber, cancelled/error stays red, sent stays blue, draft stays neutral).

---

## Color Mapping Reference (apply mechanically)

**Neutral surfaces & text:**
| From | To |
|---|---|
| `bg-white` | `bg-card` (panels/cards) or `bg-background` (page bg) |
| `text-black`, `text-gray-900`, `text-gray-800`, `text-slate-900`, `text-slate-800` | `text-foreground` |
| `text-gray-700/600/500/400`, `text-slate-700/600/500` | `text-muted-foreground` |
| `bg-gray-50`, `bg-gray-100`, `bg-slate-50`, `bg-slate-100` | `bg-muted` |
| `bg-gray-200`, `bg-slate-200` | `bg-secondary` |
| `border-gray-200/300`, `border-slate-200/300` | `border-border` |
| `divide-gray-*`, `divide-slate-*` | `divide-border` |

**Semantic colored badges/chips** (keep the hue `X` ∈ {blue, green, emerald, orange, amber, red, yellow}; preserve which state uses which hue):
| From pattern | To pattern |
|---|---|
| `bg-X-50` / `bg-X-100` | `bg-X-500/15` |
| `text-X-700` / `text-X-800` / `text-X-600` | `text-X-400` |
| `border-X-200` / `border-X-300` | `border-X-500/30` |
| dot/icon `bg-X-500` | keep `bg-X-500` (reads fine on dark) |

Notes: "paid"/positive green may use `emerald`; keep whatever hue the source used. Draft/neutral chips → `bg-muted text-muted-foreground border-border`. Do not collapse distinct state hues into one.

---

## Task 1: Shared status badge components

**Files:** `src/components/invoices/invoice-status-badge.tsx`, `src/components/invoices/tax-badge.tsx`

These are reused across invoice lists/details, so fixing them fixes many screens. Restyle only.

- [ ] **Step 1: Update `invoice-status-badge.tsx` STATUS_CONFIG classNames** (labels + structure unchanged):

```ts
export const STATUS_CONFIG = {
  draft:     { label: 'Draft',     className: 'bg-muted text-muted-foreground border-border' },
  sent:      { label: 'Sent',      className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  paid:      { label: 'Paid',      className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  overdue:   { label: 'Overdue',   className: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
} as const
```
(Only the `className` strings change; `label`, keys, the component JSX below are untouched.)

- [ ] **Step 2: Update `tax-badge.tsx` chip colors** — replace the intra (blue) and inter (orange) chip classNames with dark tints; leave the `unknown` branch (already token-based), the dots, and all text exactly as-is:

intra `<div>`: `inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 px-3 py-1 text-xs font-medium text-blue-400` (dot stays `bg-blue-500`).
inter `<div>`: `inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 px-3 py-1 text-xs font-medium text-orange-400` (dot stays `bg-orange-500`).

- [ ] **Step 3: Verify + commit**

Run: `npm run build` → success. Confirm `git diff` shows only color-class changes (labels/text/structure identical).
```bash
git add src/components/invoices/invoice-status-badge.tsx src/components/invoices/tax-badge.tsx
git commit -m "style(badges): dark-native status + tax badge tints (no logic change)"
```

---

## Task 2: Business app surfaces sweep (group A)

**Files (apply the Color Mapping Reference, restyle only):**
- `src/app/(business)/inventory/_components/inventory-table.tsx`
- `src/app/(business)/inventory/transfers/_components/transfers-table.tsx`
- `src/app/(business)/settings/godowns/_components/godowns-table.tsx`
- `src/app/(business)/inventory/[product_id]/page.tsx`
- `src/app/(onboarding)/onboarding/_components/gstin-step.tsx`

- [ ] **Step 1: For each file, read it, then replace ONLY hardcoded color classes per the Color Mapping Reference.** Do not touch any JSX/logic/text. Preserve semantic status hues (e.g. low-stock red stays red as `text-red-400`/`bg-red-500/15`).

- [ ] **Step 2: Verify no hardcoded colors remain in these files**

Run: `git grep -nE "bg-white|text-black|(bg|text|border|divide)-(gray|slate)-[0-9]|(bg|text|border)-(red|green|blue|yellow|emerald|indigo|orange|amber)-(50|100|200|300|600|700|800|900)" -- "src/app/(business)/inventory" "src/app/(business)/settings/godowns" "src/app/(onboarding)"`
Expected: no matches in the five files above (semantic `-400` text and `-500/15`/`-500/30` tints are the allowed dark-native forms and won't match this pattern).

- [ ] **Step 3: Build + diff check + commit**

Run: `npm run build` → success. Review `git diff` — confirm only color classes changed.
```bash
git add "src/app/(business)/inventory" "src/app/(business)/settings/godowns" "src/app/(onboarding)/onboarding/_components/gstin-step.tsx"
git commit -m "style(inventory/godowns/onboarding): dark token color sweep (no logic change)"
```

---

## Task 3: Business app surfaces sweep (group B: GST, POs, WhatsApp)

**Files (restyle only, same rules):**
- `src/app/(business)/dashboard/purchase-orders/page.tsx`
- `src/app/(business)/dashboard/purchase-orders/[id]/page.tsx`
- `src/app/(business)/dashboard/purchase-orders/new/page.tsx`
- `src/app/(business)/dashboard/purchase-orders/_components/po-card-mobile.tsx`
- `src/app/(business)/dashboard/gst/_components/gstr2b-tab.tsx`
- `src/app/(business)/dashboard/gst/_components/gstr3b-tab.tsx`
- `src/app/(business)/dashboard/gst/_components/gst-period-selector.tsx`
- `src/app/(business)/dashboard/whatsapp/_components/whatsapp-realtime-log.tsx`

- [ ] **Step 1: Read each file; replace ONLY hardcoded color classes per the Color Mapping Reference.** Preserve PO/GST status hues and the WhatsApp log level colors (info/success/error keep blue/green/red as dark tints). No JSX/logic/text changes.

- [ ] **Step 2: Verify no hardcoded colors remain**

Run: `git grep -nE "bg-white|text-black|(bg|text|border|divide)-(gray|slate)-[0-9]|(bg|text|border)-(red|green|blue|yellow|emerald|indigo|orange|amber)-(50|100|200|300|600|700|800|900)" -- "src/app/(business)/dashboard/purchase-orders" "src/app/(business)/dashboard/gst" "src/app/(business)/dashboard/whatsapp"`
Expected: no matches.

- [ ] **Step 3: Build + diff check + commit**

Run: `npm run build` → success. Confirm `git diff` is color-only.
```bash
git add "src/app/(business)/dashboard/purchase-orders" "src/app/(business)/dashboard/gst" "src/app/(business)/dashboard/whatsapp"
git commit -m "style(po/gst/whatsapp): dark token color sweep (no logic change)"
```

---

## Task 4: Customer + public pages sweep

**Files (restyle only — these are end-user/public facing, extra care):**
- `src/app/(customer)/my/_components/customer-invoice-table.tsx`
- `src/app/(public)/invoice/[public_id]/page.tsx`

- [ ] **Step 1: Read each; replace ONLY hardcoded color classes per the Color Mapping Reference.** The public invoice page must remain fully legible on dark; keep status hues. No structural/logic/text changes (this is a shared public artifact — do not alter what data is shown).

- [ ] **Step 2: Verify + build**

Run: `git grep -nE "bg-white|text-black|(bg|text|border|divide)-(gray|slate)-[0-9]|(bg|text|border)-(red|green|blue|yellow|emerald|indigo|orange|amber)-(50|100|200|300|600|700|800|900)" -- "src/app/(customer)" "src/app/(public)"`
Expected: no matches.
Run: `npm run build` → success.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(customer)/my/_components/customer-invoice-table.tsx" "src/app/(public)/invoice/[public_id]/page.tsx"
git commit -m "style(customer/public): dark token color sweep (no logic change)"
```

---

## Task 5: GlowCard highlights + loading animations

Two additive, presentational features from the original brief. No logic changes.

### 5a: Gold glow on primary buttons (site-wide "highlight to buttons")

**File:** `src/components/ui/button.tsx`

- [ ] **Step 1: Read `button.tsx`.** In the `buttonVariants` cva config, for the `default` (primary) variant ONLY, append a subtle gold glow shadow that appears on hover. Change the default variant string from its current value (e.g. `bg-primary text-primary-foreground hover:bg-primary/90`) by ADDING `shadow-sm transition-shadow hover:shadow-[0_4px_20px_-6px_hsl(var(--primary)/0.6)]`. Do not change any other variant, size, or the component logic.

- [ ] **Step 2: Build** → success. Confirm only the default-variant class string changed.

### 5b: SpotlightCard on the dashboard hero KPI

**File:** the dashboard KPI usage. First locate it: `git grep -ln "kpi-card\|KpiCard\|Revenue" -- "src/app/(business)/dashboard" "src/components/dashboard"`. The revenue/primary KPI is rendered via `src/components/dashboard/kpi-card.tsx` and/or the role dashboards.

- [ ] **Step 3: Read `src/components/dashboard/kpi-card.tsx`.** If it renders a `Card`, wrap ONLY the single most important KPI (revenue) call site in `<SpotlightCard>` OR add an optional `highlight?: boolean` prop to `KpiCard` that, when true, adds the gold glow classes (`border-primary/40 shadow-[0_0_30px_-12px_hsl(var(--primary)/0.6)]`) to the card. Prefer the `highlight` prop (smaller blast radius). Pass `highlight` only to the revenue KPI in the dashboards. Do not change KPI data, props' existing behavior, or labels.

- [ ] **Step 4: Build** → success.

### 5c: Loading skeletons for main data routes

**Files (create):** `loading.tsx` in each of:
- `src/app/(business)/dashboard/`
- `src/app/(business)/invoices/`
- `src/app/(business)/inventory/`
- `src/app/(business)/products/`

- [ ] **Step 5: Create each `loading.tsx`** as a Server Component using the Phase 1 `Skeleton`. Example for dashboard (`src/app/(business)/dashboard/loading.tsx`):

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}
```

For invoices/inventory/products use a table-shaped skeleton:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Build + commit**

Run: `npm run build` → success (Next picks up `loading.tsx` automatically).
```bash
git add src/components/ui/button.tsx src/components/dashboard/kpi-card.tsx "src/app/(business)/dashboard/loading.tsx" "src/app/(business)/invoices/loading.tsx" "src/app/(business)/inventory/loading.tsx" "src/app/(business)/products/loading.tsx"
git commit -m "feat(ui): gold button glow, spotlight revenue KPI, route loading skeletons"
```

---

## Self-Review Notes

- Original-brief items completed here: GlowCard "highlights to buttons and cards" (5a/5b), "loading page animations" (5c).
- Whole-app dark consistency: Tasks 1-4 (mechanical color→token sweep across the 17 files that had hardcoded colors).
- **Feature preservation:** every task is restyle-only; the verification step is `git diff` shows color-class changes only + build success. No tests change behavior here (visual). Reviewers must confirm zero logic/text/structure changes and that status-color semantics are preserved.
- After all tasks: a final controller audit (git diff main..HEAD on the touched files) to re-confirm no feature/behavior changed, per the user's strict rule.
```
