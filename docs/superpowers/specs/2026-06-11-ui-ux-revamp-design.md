# InvoiceIQ UI/UX Revamp — Design Spec

**Date:** 2026-06-11
**Status:** Approved (brainstorm) → ready for implementation plan
**Scope:** Full visual revamp of InvoiceIQ (Next.js 16 + Tailwind 3.4 + shadcn/ui). Dark-only "Midnight Gold" identity, collapsible left-sidebar shell, spotlight accents, pricing-alerts rebuild, animated marketing landing page.

---

## 1. Goals & Non-Goals

### Goals
- Replace the monochrome white/navy slate theme with a distinctive **dark-only "Midnight Gold"** palette.
- Convert the top horizontal nav into a **collapsible left sidebar** driven by an animated menu-toggle, with an icon on every destination.
- Add **spotlight/glow accents** (GlowCard) to key cards and primary CTAs, tuned to the gold accent.
- Rebuild the **pricing-alerts** page: per-category master toggle + searchable per-product toggle list.
- Ship a **captivating animated landing page** (scroll + load motion) explaining what InvoiceIQ is, who it's for, and how it differs from legacy/basic tools (comparison without naming brands).
- Add a layer of **global motion + loading polish** (route transitions, skeletons), all honoring `prefers-reduced-motion`.

### Non-Goals
- No light mode (dark-only by decision). Tokens are structured so a light theme *could* be added later, but it is out of scope now.
- No data-model, RLS, or business-logic changes. This is presentation-layer only.
- No information-architecture changes: routes, slugs, and nav labels stay stable.
- No new charting library; existing `recharts` stays, restyled to the palette.

---

## 2. Sequencing (Foundation-First)

Implementation order (each phase independently shippable):

1. **Foundation** — color tokens + typography + motion/loading primitives + GlowCard + Switch components.
2. **App shell** — sidebar (desktop collapsible + mobile drawer), restyled top-level chrome.
3. **Pricing alerts rebuild** — uses the Switch from phase 1.
4. **Landing page** — inherits the full visual language.
5. **Global polish** — sweep remaining pages (tables, forms, dashboards) for palette + motion consistency.

---

## 3. Foundation — Color System ("Midnight Gold", dark-only)

Source-of-truth hex tokens:

| Token | Hex | Role |
|---|---|---|
| `background` | `#121110` | app background (warm near-black) |
| `surface` / `card` | `#1A1817` | cards, panels |
| `elevated` / `popover` | `#232120` | popovers, hover surfaces, inputs-raised |
| `border` / `input` | `#2E2B29` | hairlines, input borders |
| `foreground` | `#ECE8E1` | primary text (warm off-white) |
| `muted-foreground` | `#9C968C` | secondary text |
| `primary` / `accent` (gold) | `#F5A623` | brand, primary CTA, active nav, focus ring, glow |
| `primary-foreground` | `#1A1206` | text/icon on gold |
| `success` (paid) | `#2DBE76` | paid / positive states |
| `destructive` (overdue/low-stock) | `#F0524B` | overdue, low stock, errors |
| `draft/neutral chip` | uses `elevated` + `muted` | draft/pending states |

**shadcn variable mapping** (`src/app/globals.css`): the app is dark-only, so put the dark values directly in `:root` AND keep them mirrored under `.dark` (and force `class="dark"` on `<html>` in `src/app/layout.tsx` so any `dark:` utilities resolve correctly). Convert the hex above to HSL triplets for the existing `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`. Add two new tokens: `--success: 151 62% 46%;` and `--success-foreground`. Bump `--radius` to `0.625rem` for a slightly softer, premium feel.

Approx HSL (finalize precisely at implementation; hex is canonical):
`background 30 6% 6%` · `card 30 6% 9%` · `popover 30 5% 13%` · `border/input 28 6% 17%` · `foreground 40 22% 90%` · `muted-foreground 36 8% 58%` · `primary 38 91% 55%` · `primary-foreground 34 62% 6%` · `ring 38 91% 55%` · `destructive 3 85% 62%` · `success 151 62% 46%`.

Add `success` to `tailwind.config.ts` colors block (mirroring the existing `destructive` pattern). Restyle `Badge`/status components to use `success` for paid, `destructive` for overdue/low, neutral (`elevated`+`muted`) for draft.

**Color discipline (Taste):** gold is the *only* accent. No second accent anywhere. Semantic green/red are reserved strictly for status, never decoration. No pure `#000`/`#fff`.

---

## 4. Foundation — Typography

Three families:

| Use | Font | Source | Loading |
|---|---|---|---|
| Landing display (hero + big section titles) | **Clash Display** (500–700) | Fontshare (not on Google) | `next/font/local`, self-hosted woff2 in `src/app/fonts/` |
| App UI + all body text (app + landing body) | **Space Grotesk** (400–700) | Google Fonts | `next/font/google` |
| Numbers: ₹ amounts, GSTIN, invoice no., tabular data | **IBM Plex Mono** (400–500) | Google Fonts | `next/font/google` |

- Wire all three in `src/app/layout.tsx` via `next/font` and expose as CSS variables (`--font-display`, `--font-sans`, `--font-mono`). Never `<link>` Google Fonts (Taste rule).
- `tailwind.config.ts`: `fontFamily: { sans: ['var(--font-sans)'], display: ['var(--font-display)'], mono: ['var(--font-mono)'] }`.
- Default `body` → `font-sans` (Space Grotesk). Use `font-display` only for landing hero/section headlines. Use `font-mono` + `tabular-nums` for every monetary/identifier figure across the app.
- Display headline defaults: `tracking-[-0.02em] leading-[1.03]`. Body: `leading-relaxed max-w-[65ch]`.
- Clash Display is display-only; never use it for body/long text.

---

## 5. Foundation — Motion & Loading Primitives

Library: **framer-motion** (already installed, v12; import from `framer-motion`). No GSAP needed for the approved flows. Dials (Taste): VARIANCE 7 / MOTION 6 / DENSITY 4 for landing; app shell stays calmer (MOTION 3–4).

Reusable primitives (new files under `src/components/motion/`):
- `Reveal` — `whileInView` fade+rise (`y:24→0`, `opacity:0→1`, `ease:[0.16,1,0.3,1]`, `viewport once`). For section/content reveals.
- `RevealStagger` — staggered children for lists/grids/bento.
- `Marquee` — CSS-driven infinite horizontal scroll, pauses on hover. Used **once** on landing (trust strip).
- `Spotlight`/`GlowCard` — see §6.
- `PageTransition` — subtle fade/slide on route change for app pages (wrap in `(business)/layout.tsx` and landing).

Loading:
- **Skeleton loaders** shaped like final content (KPI cards, table rows, sidebar) — replace generic spinners. Add `loading.tsx` files for major routes (dashboard, invoices, inventory, products, pricing-alerts).
- **First-load / route splash:** lightweight branded splash (logo + gold shimmer) only if route data warrants; prefer skeletons over a blocking splash. A one-time hero load animation on the landing page is in scope.

**Reduced motion (mandatory):** every primitive wraps `useReducedMotion()` and degrades to static/instant. Marquee, glow pulse, parallax all collapse to static under `prefers-reduced-motion: reduce`. Animate only `transform`/`opacity`.

---

## 6. Accent / GlowCard (spotlight-card)

Integrate the provided `GlowCard` (spotlight border + cursor-tracked radial) at `src/components/ui/spotlight-card.tsx`.

- **Palette tuning:** force the glow hue to gold. Set `glowColor="orange"` baseline and override the component's HSL base/spread so the spotlight reads as `#F5A623` gold (base hue ≈ 38, reduced spread so it stays gold, not rainbow). Provide a thin wrapper `<SpotlightCard>` that locks our gold values + radius (`--radius:12`) so call sites don't repeat config.
- **Where to use (sparingly — Taste's glow-override is deliberate, not everywhere):**
  - Dashboard **hero KPI** (revenue) card.
  - Landing **hero product panel**, the 3 **feature panels**, and the **final CTA**.
  - **Primary CTA buttons** get a softer gold glow shadow (not the full GlowCard), via a `.btn-glow` utility.
  - "Why different" comparison: our column gets a gold glow.
- **Perf note:** the provided component attaches a `document` `pointermove` listener **per instance** and injects a `<style>` per instance. Refactor to: (a) inject the shared `<style>` once (module-level/guard), and (b) optionally a single shared pointer provider. Keep instance count low (< ~8 on any page). Honor reduced-motion: disable cursor tracking, keep a static border.

---

## 7. App Shell — Collapsible Left Sidebar

Replaces the top `<nav>` in `src/app/(business)/layout.tsx`.

**Behavior**
- **Desktop (`md+`):** fixed left sidebar. **Expanded by default** (~240px) with labels; collapses to a **64px icon rail** via the menu-toggle. State **persisted** (cookie so SSR matches, or `localStorage` with no-flash guard). Collapsed rail shows hover tooltips.
- **Mobile (`<md`):** keep the existing `Sheet`-based drawer (`mobile-nav-drawer.tsx` + `mobile-header.tsx`), restyled to the new palette; the menu-toggle opens it.
- **Active state:** gold left bar + gold-tinted gradient background + gold icon/text. `usePathname` logic preserved from current `nav-links.tsx`.
- **Low-stock badge** stays on Inventory (red pill expanded, red dot collapsed). **PO pending badge** for Distributors preserved.
- **Flat list (no group headers)** — all destinations in one icon list, in this order: Dashboard, Invoices, Inventory, Products, Customers, Suppliers, Purchase Orders (OEM/Distributor), WhatsApp Orders (Retailer), Reports, GST, Assistant (Chat). Pinned to bottom: Settings, Pricing Alerts, then user (avatar + email) + Logout. Role-gating logic preserved exactly as today.

**Components**
- `src/components/ui/menu-toggle.tsx` — provided animated morphing toggle (uses `cn`, already available). Drives expand/collapse on desktop and drawer open on mobile.
- `src/components/sidebar.tsx` (new) — the desktop sidebar (client component for toggle state).
- Rework `src/components/nav-links.tsx` to render icon+label rows reused by sidebar + drawer (keep its prop contract: `lowStockCount`, `companyType`, `poPendingCount`).
- Icons: **lucide-react** (already a dependency — keep it for consistency across the app; one icon family).
- Logo: a small gold rounded-square monogram "i" wordmark lockup, reused in sidebar + landing nav.

**Layout impact:** `main` content shifts right by the sidebar width; content max-width and padding retuned for the dark theme.

---

## 8. Switch Component + Pricing-Alerts Rebuild

### 8.1 Switch (`src/components/ui/switch-animated.tsx`)
Integrate the provided animated SVG toggle, **reimplemented without `styled-components`** (do not add that dependency to a Tailwind app). Port the styles to a colocated CSS module (`switch-animated.module.css`) or `styled-jsx`, keeping the SVG path animation. **Recolor to the palette:** track off = `border`/`muted`; track on + checked path = **gold** `#F5A623`; knob/stroke = `foreground`. Honor reduced-motion (instant toggle). Accessible: real checkbox input, `aria-label`, keyboard-toggle, 44px touch target.

> Note: the existing shadcn `src/components/ui/switch.tsx` (Radix) stays for plain settings switches. The animated one is used where the user wants the expressive toggle (pricing alerts). Name it distinctly to avoid collision.

### 8.2 Pricing-Alerts page (`src/app/(business)/dashboard/settings/pricing-alerts/page.tsx` + `PricingAlertSettings`)
Rebuild the UI around two levels of control (server actions `toggleAllProductCategories`, category + per-product toggles already exist — reuse them):
- **Search bar** at top (same UX as the Products tab) filtering the product list.
- **Per-category master toggle**: each category is a section header with a Switch that toggles alerts for the **whole category** at once.
- **Per-product rows**: under each category, list products (like the Products tab) each with a Switch to toggle alerts individually.
- Mixed state: a category whose products are partially enabled shows an indeterminate/partial visual on its master toggle.
- Keep the existing "all products" master toggle at the very top.
- All toggles call existing server actions; optimistic UI with toast (`sonner`) feedback; skeleton while loading.

---

## 9. Landing Page (`src/app/page.tsx` → full rebuild)

Dark, animated, 11 sections, 5+ distinct layout families. Final copy contains **zero em-dashes** (Taste rule). Real images generated for hero + 3 feature panels + bento (or `picsum.photos/seed/...` placeholders with clearly-labeled TODOs if generation unavailable). Hero obeys discipline: headline ≤2 lines, subtext ≤20 words, CTA above the fold, `min-h-[100dvh]`, `pt-24` max.

1. **Nav** — sticky, single line, ≤72px: logo + Features / Why InvoiceIQ / Pricing + Log in + gold **Start free**. (Single signup CTA label "Start free" everywhere — no duplicate intent.)
2. **Hero** — asymmetric split. Display headline "Billing that *thinks* for Indian business." (italic gold "thinks"). Subtext: "GST invoicing, live inventory, WhatsApp orders, and AI that flags what needs you. One system, not five." CTAs: **Start free** + Watch tour. Right: generated dashboard image in a SpotlightCard. Motion: word stagger-in + dashboard float/glow on load.
3. **Trust marquee** (the only marquee) — capability keywords scrolling, pause on hover. Not fake customer logos (none exist yet; do not fabricate).
4. **Feature A — AI assistant + GST filing** — split, image right. "Ask your books anything." Motion: reveal + chat bubbles type-in.
5. **Feature B — WhatsApp ordering** — phone-mock + vertical steps (new family). "Orders arrive on WhatsApp." Motion: messages cascade.
6. **Feature C — Market pricing alerts** — split reversed + SpotlightCard. "Know the moment your margin slips." Motion: toggles flip, alert card glows.
7. **Capabilities bento** — varied tiles (multi-godown inventory hero tile, purchase orders, credit/debit notes, public invoice links + QR, role dashboards, CSV import). Exact cell count = content. Motion: stagger reveal. At least 2–3 tiles carry a real image/gradient (not all text).
8. **Why different** — unnamed comparison matrix: columns "Legacy desktop tools" / "Basic invoice apps" / **InvoiceIQ** (gold, glowing). Rows: AI+GST filing, WhatsApp ordering, pricing alerts, cloud/anywhere, multi-godown+supply chain. Claims must be defensible. Motion: our column glows, checks draw in.
9. **How it works** — 3 steps (Add GSTIN → Import + connect WhatsApp → Bill & track). Motion: scroll progress line.
10. **Final CTA** — centered SpotlightCard. "Start billing smarter today." + Start free. Motion: gold glow pulse.
11. **Footer** — product/pricing/login + privacy/terms + GSTIN trust line. No version stamps.

Eyebrow budget: ≤ ceil(11/3) ≈ 3 total across the page. Layout-family repetition avoided (no 3 consecutive image+text splits — broken by phone-mock, bento, comparison, steps).

---

## 10. Component Integration Checklist (provided components)

| Component | Path | Deps | Notes |
|---|---|---|---|
| GlowCard (spotlight-card) | `src/components/ui/spotlight-card.tsx` | none new | tune to gold; wrap in `<SpotlightCard>`; shared style/listener; reduced-motion safe |
| Animated Switch | `src/components/ui/switch-animated.tsx` | **none** (drop `styled-components`; port to CSS module/styled-jsx) | recolor to gold; a11y + reduced-motion |
| MenuToggle | `src/components/ui/menu-toggle.tsx` | none (uses existing `cn`) | drives sidebar collapse + mobile drawer |

All three live in `src/components/ui` per `components.json` alias (`@/components/ui`) — already the configured path; no relocation needed.

---

## 11. Accessibility & Performance Guardrails

- WCAG AA contrast for all text on dark surfaces (verify gold-on-dark for small text; use gold mainly for ≥medium weight/large, or darken text-on-gold to `#1A1206`).
- Visible focus rings (gold) on all interactive elements; keyboard nav for sidebar, toggles, switches; tab order matches visual order.
- Icon-only buttons get `aria-label`. Switches are real checkboxes with labels. 44px touch targets.
- `prefers-reduced-motion` honored everywhere (§5). Animate only `transform`/`opacity`; `will-change` sparingly.
- Core Web Vitals: hero image `next/image priority`; lazy-load below-the-fold; reserve space (no CLS); keep framer-motion usage in isolated client leaves with `'use client'`.
- Z-index scale documented (sidebar, drawer/overlay, toasts, glow): use a small constants set, no `z-50` spam.

---

## 12. Files (created / modified)

**Created**
- `src/components/ui/spotlight-card.tsx`, `src/components/ui/switch-animated.tsx` (+ css module), `src/components/ui/menu-toggle.tsx`
- `src/components/sidebar.tsx`, `src/components/ui/spotlight-card-wrapper.tsx` (SpotlightCard)
- `src/components/motion/` (`reveal.tsx`, `reveal-stagger.tsx`, `marquee.tsx`, `page-transition.tsx`)
- `src/app/fonts/` (Clash Display woff2) ; landing section components under `src/components/landing/`
- `loading.tsx` for major routes

**Modified**
- `src/app/globals.css` (tokens), `tailwind.config.ts` (fonts + success color), `src/app/layout.tsx` (fonts + `class="dark"` + page transition)
- `src/app/(business)/layout.tsx` (sidebar), `src/components/nav-links.tsx`, `mobile-header.tsx`, `mobile-nav-drawer.tsx`
- `src/app/page.tsx` (landing rebuild)
- pricing-alerts `page.tsx` + `PricingAlertSettings`
- Status/badge components, KPI card, dashboards (palette + glow sweep in phase 5)

---

## 13. Risks / Open Questions
- **Clash Display licensing/self-host:** confirm Fontshare license permits self-hosting (it does under Fontshare's free license); fall back to a Google display face (e.g. Sora/Outfit) if not.
- **lucide-react version** in `package.json` is pinned oddly (`^1.14.0`); verify icon imports resolve at implementation; bump if needed.
- **GlowCard perf** with multiple instances — mitigated by shared listener/style and low instance count.
- **Gold-on-dark small-text contrast** — keep gold for large/medium-weight text and accents; body stays `foreground` off-white.
- Real landing images depend on an available image-gen tool; otherwise labeled placeholder slots ship and are filled later.
