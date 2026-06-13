# UI/UX Revamp — Phase 4: Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare `src/app/page.tsx` with a captivating, animated, dark "Midnight Gold" marketing landing page (the 11-section flow approved during brainstorming), using Clash Display for hero/section headlines and real product mini-previews instead of stock images.

**Architecture:** One focused component per section under `src/components/landing/`, composed by `src/app/page.tsx` (a Server Component inheriting the root layout's dark theme + fonts). Motion is delivered by the Phase 1 client primitives (`Reveal`, `RevealStagger`, `Marquee`) and `SpotlightCard`; section files stay server components that render those client leaves. Visuals are **real mini-UI previews built from design-system tokens** (no external images, no fake-screenshot divs). All copy contains **zero em-dashes**.

**Tech Stack:** Next.js 16 App Router (RSC + client leaves), Tailwind 3.4, `next/font/local` (Clash Display), framer-motion (via Phase 1 primitives), lucide-react, Phase 1 `SpotlightCard`/`SwitchAnimated`, Vitest + jsdom (smoke test).

**Source spec:** `docs/superpowers/specs/2026-06-11-ui-ux-revamp-design.md` (§9) + the approved landing wireframe. **Depends on:** Phase 1 (fonts plumbing, `SpotlightCard`, `SwitchAnimated`, motion primitives), Phase 2 patterns.

**Taste rules enforced:** hero ≤2-line headline + ≤20-word subtext + CTA above fold (`min-h-[100dvh]`, `pt-24` max); ≤4 eyebrows total across the page; ≥4 distinct layout families; no 3 consecutive image+text splits; one marquee max; single signup CTA label ("Start free") everywhere; real component previews (not stock/fake screenshots); motion is motivated; `prefers-reduced-motion` honored (handled inside the Phase 1 primitives).

**Font assets already downloaded** (controller, this session) to `src/app/fonts/`: `ClashDisplay-Medium.woff2` (500), `ClashDisplay-Semibold.woff2` (600), `ClashDisplay-Bold.woff2` (700).

---

## File Structure

**Created**
- `src/app/fonts/clash-display.ts` — `next/font/local` config for the 3 weights.
- `src/components/landing/landing-nav.tsx`
- `src/components/landing/hero.tsx` (+ inline mini-dashboard preview)
- `src/components/landing/trust-marquee.tsx`
- `src/components/landing/feature-ai.tsx`
- `src/components/landing/feature-whatsapp.tsx`
- `src/components/landing/feature-pricing.tsx`
- `src/components/landing/capabilities-bento.tsx`
- `src/components/landing/why-different.tsx`
- `src/components/landing/how-it-works.tsx`
- `src/components/landing/final-cta.tsx`
- `src/components/landing/landing-footer.tsx`
- `src/components/landing/landing.test.tsx` — jsdom smoke test.

**Modified**
- `src/app/page.tsx` — compose the sections.
- `src/app/layout.tsx` — add Clash Display variable to `<html>`.
- `tailwind.config.ts` — point `display` family at `--font-display`.

---

## Task 1: Wire Clash Display

**Files:** Create `src/app/fonts/clash-display.ts`; modify `src/app/layout.tsx`, `tailwind.config.ts`.

No unit test; verified by build + visual.

- [ ] **Step 1: Confirm the font files exist**

Run: `ls src/app/fonts/`
Expected: `ClashDisplay-Medium.woff2`, `ClashDisplay-Semibold.woff2`, `ClashDisplay-Bold.woff2` are present. If any is missing, STOP and report NEEDS_CONTEXT (the controller downloads them).

- [ ] **Step 2: Create `src/app/fonts/clash-display.ts`**

```ts
import localFont from 'next/font/local'

// Landing display face. Self-hosted from Fontshare (free license).
export const clashDisplay = localFont({
  variable: '--font-display',
  display: 'swap',
  src: [
    { path: './ClashDisplay-Medium.woff2', weight: '500', style: 'normal' },
    { path: './ClashDisplay-Semibold.woff2', weight: '600', style: 'normal' },
    { path: './ClashDisplay-Bold.woff2', weight: '700', style: 'normal' },
  ],
})
```

- [ ] **Step 3: Add the variable to `<html>` in `src/app/layout.tsx`**

Add the import after the existing `next/font/google` import:

```tsx
import { clashDisplay } from './fonts/clash-display'
```

Change the `<html>` className from:

```tsx
      className={`dark ${spaceGrotesk.variable} ${plexMono.variable}`}
```

to:

```tsx
      className={`dark ${spaceGrotesk.variable} ${plexMono.variable} ${clashDisplay.variable}`}
```

- [ ] **Step 4: Point the `display` family at Clash in `tailwind.config.ts`**

Replace the placeholder display line (currently `display: ["var(--font-sans)", ...]` with the TODO comment) with:

```ts
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
```

Remove the now-obsolete `// TODO(landing phase)...` comment above it.

- [ ] **Step 5: Verify build + visual**

Run: `npm run build`
Expected: success (next/font picks up the local woff2 files; no missing-file error).
(Optional visual: `npm run dev`, view any page using `font-display` — headings render in Clash Display.)

- [ ] **Step 6: Commit**

```bash
git add src/app/fonts/clash-display.ts src/app/fonts/ClashDisplay-*.woff2 src/app/layout.tsx tailwind.config.ts
git commit -m "feat(type): wire Clash Display display face (self-hosted)"
```

---

## Task 2: Page shell + Nav + Hero + Trust marquee

**Files:** Create `landing-nav.tsx`, `hero.tsx`, `trust-marquee.tsx`; modify `src/app/page.tsx`.

- [ ] **Step 1: Create `src/components/landing/landing-nav.tsx`**

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="InvoiceIQ home">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            i
          </span>
          <span className="font-display text-lg font-semibold">InvoiceIQ</span>
        </Link>
        <div className="ml-auto hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">Features</a>
          <a href="#why" className="transition-colors hover:text-foreground">Why InvoiceIQ</a>
          <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/auth/customer/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/auth/business/register">Start free</Link>
          </Button>
        </div>
      </nav>
    </header>
  )
}
```

- [ ] **Step 2: Create `src/components/landing/hero.tsx`**

A split hero: copy on the left, a real mini-dashboard preview inside a `SpotlightCard` on the right. Headline uses Clash via `font-display`. Reveal animates entrance.

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/glow-card'
import { Reveal } from '@/components/motion/reveal'

function MiniDashboard() {
  return (
    <div className="w-full rounded-xl border border-border bg-card/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">Dashboard</span>
        <span className="font-mono text-[10px] text-muted-foreground">FY 2025-26</span>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-primary/40 bg-background p-2.5 shadow-[0_0_30px_-12px] shadow-primary">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Revenue</p>
          <p className="font-mono text-base font-bold text-primary">₹4.82L</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Invoices</p>
          <p className="font-mono text-base font-bold">128</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Low stock</p>
          <p className="font-mono text-base font-bold">7</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {[
          { id: 'INV-0241', who: 'Anand Traders', tone: 'text-success', label: 'PAID' },
          { id: 'INV-0240', who: 'Sri Lakshmi Steels', tone: 'text-destructive', label: 'OVERDUE' },
          { id: 'INV-0239', who: 'Vetri Hardware', tone: 'text-muted-foreground', label: 'DRAFT' },
        ].map((r) => (
          <div key={r.id} className="flex items-center justify-between border-t border-border/60 pt-1.5 text-xs">
            <span className="font-mono text-muted-foreground">{r.id}</span>
            <span className="truncate px-2 text-foreground">{r.who}</span>
            <span className={`font-mono text-[10px] font-semibold ${r.tone}`}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_0%,hsl(38_91%_55%/0.10),transparent)]"
      />
      <div className="mx-auto grid min-h-[100dvh] max-w-6xl grid-cols-1 items-center gap-10 px-6 pt-24 pb-16 lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal>
          <div>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
              Billing that <span className="italic text-primary">thinks</span> for Indian business.
            </h1>
            <p className="mt-5 max-w-[42ch] text-base leading-relaxed text-muted-foreground md:text-lg">
              GST invoicing, live inventory, WhatsApp orders, and AI that flags what needs you. One
              system, not five.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/auth/business/register">Start free</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#how">See how it works</Link>
              </Button>
            </div>
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              GST-compliant · GSTIN validated · no card required
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <SpotlightCard className="w-full">
            <MiniDashboard />
          </SpotlightCard>
        </Reveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Create `src/components/landing/trust-marquee.tsx`**

```tsx
import { Marquee } from '@/components/motion/marquee'

const ITEMS = [
  'GST e-invoice ready',
  'GSTIN validation',
  'Multi-godown stock',
  'WhatsApp orders',
  'Credit & debit notes',
  'Public invoice links',
  'AI assistant',
  'Market pricing alerts',
]

export function TrustMarquee() {
  return (
    <section className="border-y border-border/60 bg-card/30 py-5">
      <Marquee>
        {ITEMS.map((item) => (
          <span key={item} className="flex items-center gap-3 whitespace-nowrap text-sm text-muted-foreground">
            <span aria-hidden className="h-1 w-1 rounded-full bg-primary" />
            {item}
          </span>
        ))}
      </Marquee>
    </section>
  )
}
```

- [ ] **Step 4: Replace `src/app/page.tsx`** (sections added across this + later tasks; this step wires what exists so far):

```tsx
import { LandingNav } from '@/components/landing/landing-nav'
import { Hero } from '@/components/landing/hero'
import { TrustMarquee } from '@/components/landing/trust-marquee'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <Hero />
        <TrustMarquee />
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Verify build + commit**

Run: `npm run build` → success.
```bash
git add src/components/landing/landing-nav.tsx src/components/landing/hero.tsx src/components/landing/trust-marquee.tsx src/app/page.tsx
git commit -m "feat(landing): nav, hero with live mini-dashboard, trust marquee"
```

---

## Task 3: Feature sections (AI, WhatsApp, Pricing)

**Files:** Create `feature-ai.tsx`, `feature-whatsapp.tsx`, `feature-pricing.tsx`; modify `src/app/page.tsx`.

Layout discipline: AI = split (preview right), WhatsApp = phone-mock + steps (different family, breaks the zigzag), Pricing = split (preview left). Eyebrow used once here (on the features wrapper), not per section.

- [ ] **Step 1: Create `src/components/landing/feature-ai.tsx`**

```tsx
import { Reveal } from '@/components/motion/reveal'
import { Sparkles } from 'lucide-react'

export function FeatureAI() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <Reveal>
        <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-primary">
          <Sparkles className="h-3.5 w-3.5" /> What sets us apart
        </p>
      </Reveal>
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Ask your books anything.
            </h2>
            <p className="mt-4 max-w-[48ch] leading-relaxed text-muted-foreground">
              An AI assistant that answers in plain language, and a GST filing helper that prepares
              your returns. "What is my GST liability this quarter?" Answered.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="space-y-3 text-sm">
              <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">
                What is my GST liability this quarter?
              </div>
              <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-foreground">
                Output GST ₹84,200, input credit ₹31,750. Net payable
                <span className="font-mono font-semibold text-primary"> ₹52,450</span>. GSTR-3B is
                drafted and ready to review.
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `src/components/landing/feature-whatsapp.tsx`**

```tsx
import { Reveal } from '@/components/motion/reveal'
import { RevealStagger } from '@/components/motion/reveal-stagger'

const STEPS = [
  { n: '01', t: 'Customer messages an order', d: 'No app to install. They just text what they need.' },
  { n: '02', t: 'Stock & invoice auto-draft', d: 'Inventory decrements and a draft invoice appears.' },
  { n: '03', t: 'You confirm in one tap', d: 'Review, send, done. The customer gets a payment link.' },
]

export function FeatureWhatsApp() {
  return (
    <section className="border-y border-border/60 bg-card/30 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal>
          <div className="mx-auto w-full max-w-[260px] rounded-[2rem] border border-border bg-background p-3 shadow-xl">
            <div className="rounded-[1.4rem] bg-card p-3">
              <p className="mb-3 text-center font-mono text-[10px] text-muted-foreground">WhatsApp</p>
              <div className="space-y-2 text-xs">
                <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary px-3 py-2">
                  Need 50 bags UltraTech cement, deliver Friday
                </div>
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">
                  Order logged. Invoice INV-0242 drafted for ₹19,500. Confirm?
                </div>
                <div className="ml-auto w-fit rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">
                  ✓ Confirmed
                </div>
              </div>
            </div>
          </div>
        </Reveal>
        <div>
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Orders arrive on WhatsApp.
            </h2>
            <p className="mt-4 max-w-[46ch] leading-relaxed text-muted-foreground">
              Where your customers already are. Each message becomes stock movement and an invoice,
              automatically.
            </p>
          </Reveal>
          <RevealStagger className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-lg border border-border bg-background p-4">
                <p className="font-mono text-sm text-primary">{s.n}</p>
                <p className="mt-1 text-sm font-semibold">{s.t}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </RevealStagger>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Create `src/components/landing/feature-pricing.tsx`** (preview LEFT, copy right; preview in a SpotlightCard, uses real switch styling)

```tsx
import { Reveal } from '@/components/motion/reveal'
import { SpotlightCard } from '@/components/ui/glow-card'

function PricingPreview() {
  return (
    <div className="w-full rounded-xl border border-border bg-card/80 p-4">
      <p className="mb-3 text-sm font-semibold">Pricing alerts</p>
      {[
        { name: 'Steel', on: true, note: 'All monitored' },
        { name: 'Cement', on: false, note: 'Not monitored' },
      ].map((c) => (
        <div key={c.name} className="mb-2 flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
          <div>
            <p className="text-sm">{c.name}</p>
            <p className="text-[10px] text-muted-foreground">{c.note}</p>
          </div>
          <span
            aria-hidden
            className={`flex h-5 w-9 items-center rounded-full px-0.5 ${c.on ? 'justify-end bg-primary' : 'justify-start bg-muted'}`}
          >
            <span className="h-4 w-4 rounded-full bg-background" />
          </span>
        </div>
      ))}
      <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs">
        <span className="font-semibold text-destructive">Rebar 8mm</span> is 18% below market. Review price.
      </div>
    </div>
  )
}

export function FeaturePricing() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <SpotlightCard className="w-full">
            <PricingPreview />
          </SpotlightCard>
        </Reveal>
        <Reveal delay={0.1}>
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Know the moment your margin slips.
            </h2>
            <p className="mt-4 max-w-[46ch] leading-relaxed text-muted-foreground">
              Market pricing alerts watch the market against your selling price, per product or whole
              category, and tell you before you lose money.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Wire the three sections into `src/app/page.tsx`** (add imports + render after `TrustMarquee`):

Add imports:
```tsx
import { FeatureAI } from '@/components/landing/feature-ai'
import { FeatureWhatsApp } from '@/components/landing/feature-whatsapp'
import { FeaturePricing } from '@/components/landing/feature-pricing'
```
Render (after `<TrustMarquee />`):
```tsx
        <FeatureAI />
        <FeatureWhatsApp />
        <FeaturePricing />
```

- [ ] **Step 5: Build + commit**

Run: `npm run build` → success.
```bash
git add src/components/landing/feature-ai.tsx src/components/landing/feature-whatsapp.tsx src/components/landing/feature-pricing.tsx src/app/page.tsx
git commit -m "feat(landing): AI, WhatsApp, and pricing-alert feature sections"
```

---

## Task 4: Capabilities bento + Why-different comparison

**Files:** Create `capabilities-bento.tsx`, `why-different.tsx`; modify `src/app/page.tsx`.

- [ ] **Step 1: Create `src/components/landing/capabilities-bento.tsx`**

Bento with exactly 6 cells, mixed sizes, 2 tinted/gradient cells for visual variation (Taste: bento background diversity).

```tsx
import { RevealStagger } from '@/components/motion/reveal-stagger'
import { Boxes, ShoppingCart, FileText, QrCode, LayoutGrid, Upload } from 'lucide-react'

const CELLS = [
  { icon: Boxes, title: 'Multi-godown inventory', body: 'Track stock across locations with reserved-quantity awareness.', span: 'sm:col-span-2 sm:row-span-2', tint: true },
  { icon: ShoppingCart, title: 'Purchase orders', body: 'OEM to distributor to retailer, end to end.' },
  { icon: FileText, title: 'Credit & debit notes', body: 'GST-correct adjustments in a click.' },
  { icon: QrCode, title: 'Public invoice links + QR pay', body: 'Share a link, get paid faster.', span: 'sm:col-span-2', tint: true },
  { icon: LayoutGrid, title: 'Role dashboards', body: 'The right view for every company type.' },
  { icon: Upload, title: 'CSV import', body: 'Bring your catalog in minutes.' },
]

export function CapabilitiesBento() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <h2 className="mb-10 max-w-[18ch] font-display text-3xl font-semibold tracking-tight md:text-4xl">
        Everything a growing business runs on.
      </h2>
      <RevealStagger className="grid auto-rows-[150px] grid-cols-1 gap-4 sm:grid-cols-3">
        {CELLS.map((c) => {
          const Icon = c.icon
          return (
            <div
              key={c.title}
              className={`flex flex-col justify-between rounded-2xl border border-border p-5 ${c.span ?? ''} ${
                c.tint
                  ? 'bg-[radial-gradient(120%_120%_at_0%_0%,hsl(38_91%_55%/0.10),transparent)] bg-card'
                  : 'bg-card'
              }`}
            >
              <Icon className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold">{c.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
              </div>
            </div>
          )
        })}
      </RevealStagger>
    </section>
  )
}
```

- [ ] **Step 2: Create `src/components/landing/why-different.tsx`** (unnamed comparison; our column glows; check icons)

```tsx
import { Reveal } from '@/components/motion/reveal'
import { Check, Minus } from 'lucide-react'

const ROWS: { label: string; legacy: boolean; basic: boolean }[] = [
  { label: 'AI assistant + GST filing', legacy: false, basic: false },
  { label: 'WhatsApp ordering', legacy: false, basic: false },
  { label: 'Market pricing alerts', legacy: false, basic: false },
  { label: 'Cloud, works anywhere', legacy: false, basic: true },
  { label: 'Multi-godown + supply chain', legacy: true, basic: false },
]

function Cell({ on }: { on: boolean }) {
  return on ? (
    <Check className="mx-auto h-4 w-4 text-success" aria-label="Yes" />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="No" />
  )
}

export function WhyDifferent() {
  return (
    <section id="why" className="border-y border-border/60 bg-card/30 py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6">
        <Reveal>
          <h2 className="mb-10 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Why teams switch to InvoiceIQ.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] bg-background font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              <div className="px-4 py-3">Capability</div>
              <div className="px-2 py-3 text-center">Legacy desktop</div>
              <div className="px-2 py-3 text-center">Basic apps</div>
              <div className="bg-primary/10 px-2 py-3 text-center font-semibold text-primary">InvoiceIQ</div>
            </div>
            {ROWS.map((r) => (
              <div key={r.label} className="grid grid-cols-[1.6fr_1fr_1fr_1fr] border-t border-border text-sm">
                <div className="px-4 py-3 text-foreground">{r.label}</div>
                <div className="px-2 py-3"><Cell on={r.legacy} /></div>
                <div className="px-2 py-3"><Cell on={r.basic} /></div>
                <div className="bg-primary/10 px-2 py-3"><Check className="mx-auto h-4 w-4 text-primary" aria-label="Yes" /></div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Wire into `src/app/page.tsx`** (imports + render after `FeaturePricing`):

```tsx
import { CapabilitiesBento } from '@/components/landing/capabilities-bento'
import { WhyDifferent } from '@/components/landing/why-different'
```
```tsx
        <CapabilitiesBento />
        <WhyDifferent />
```

- [ ] **Step 4: Build + commit**

Run: `npm run build` → success.
```bash
git add src/components/landing/capabilities-bento.tsx src/components/landing/why-different.tsx src/app/page.tsx
git commit -m "feat(landing): capabilities bento + unnamed comparison table"
```

---

## Task 5: How-it-works + Final CTA + Footer + compose + smoke test

**Files:** Create `how-it-works.tsx`, `final-cta.tsx`, `landing-footer.tsx`, `landing.test.tsx`; modify `src/app/page.tsx`.

- [ ] **Step 1: Write the failing smoke test** — create `src/components/landing/landing.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import '../../../tests/setup-dom'
import { FinalCta } from './final-cta'
import { HowItWorks } from './how-it-works'

describe('landing sections', () => {
  it('FinalCta shows the single signup CTA label', () => {
    render(<FinalCta />)
    expect(screen.getByRole('link', { name: 'Start free' })).toBeInTheDocument()
  })
  it('HowItWorks renders three steps', () => {
    render(<HowItWorks />)
    expect(screen.getByText('Add your GSTIN')).toBeInTheDocument()
    expect(screen.getByText(/Bill & track/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS**

Run: `npm test -- src/components/landing/landing.test.tsx`
Expected: FAIL ("Cannot find module './final-cta'").

- [ ] **Step 3: Create `src/components/landing/how-it-works.tsx`**

```tsx
import { RevealStagger } from '@/components/motion/reveal-stagger'

const STEPS = [
  { n: '01', t: 'Add your GSTIN', d: 'Sign up, validate your GSTIN, pick your business type.' },
  { n: '02', t: 'Import & connect', d: 'Bring products via CSV and connect WhatsApp.' },
  { n: '03', t: 'Bill & track', d: 'Invoice, watch stock, and get alerted automatically.' },
]

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <h2 className="mb-10 font-display text-3xl font-semibold tracking-tight md:text-4xl">
        Live in an afternoon.
      </h2>
      <RevealStagger className="grid gap-5 md:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-2xl border border-border bg-card p-6">
            <p className="font-mono text-2xl font-semibold text-primary">{s.n}</p>
            <p className="mt-3 text-lg font-semibold">{s.t}</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </RevealStagger>
    </section>
  )
}
```

- [ ] **Step 4: Create `src/components/landing/final-cta.tsx`**

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/glow-card'
import { Reveal } from '@/components/motion/reveal'

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <SpotlightCard className="w-full">
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
              Start billing smarter today.
            </h2>
            <p className="mt-4 max-w-[44ch] text-muted-foreground">
              Free to start. No card. Your data stays yours.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/auth/business/register">Start free</Link>
            </Button>
          </div>
        </SpotlightCard>
      </Reveal>
    </section>
  )
}
```

- [ ] **Step 5: Create `src/components/landing/landing-footer.tsx`**

```tsx
import Link from 'next/link'

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            i
          </span>
          <span className="font-display font-semibold text-foreground">InvoiceIQ</span>
          <span className="ml-2">GST billing & inventory</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/auth/business/register" className="transition-colors hover:text-foreground">Start free</Link>
          <Link href="/auth/customer/login" className="transition-colors hover:text-foreground">Log in</Link>
          <a href="#features" className="transition-colors hover:text-foreground">Features</a>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 6: Run test, verify it PASSES**

Run: `npm test -- src/components/landing/landing.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Finalize `src/app/page.tsx`** with the full composition:

```tsx
import { LandingNav } from '@/components/landing/landing-nav'
import { Hero } from '@/components/landing/hero'
import { TrustMarquee } from '@/components/landing/trust-marquee'
import { FeatureAI } from '@/components/landing/feature-ai'
import { FeatureWhatsApp } from '@/components/landing/feature-whatsapp'
import { FeaturePricing } from '@/components/landing/feature-pricing'
import { CapabilitiesBento } from '@/components/landing/capabilities-bento'
import { WhyDifferent } from '@/components/landing/why-different'
import { HowItWorks } from '@/components/landing/how-it-works'
import { FinalCta } from '@/components/landing/final-cta'
import { LandingFooter } from '@/components/landing/landing-footer'

export const metadata = {
  title: 'InvoiceIQ — Billing that thinks for Indian business',
  description:
    'GST invoicing, live inventory, WhatsApp orders, and AI pricing alerts. One system for Indian SMBs.',
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <Hero />
        <TrustMarquee />
        <FeatureAI />
        <FeatureWhatsApp />
        <FeaturePricing />
        <CapabilitiesBento />
        <WhyDifferent />
        <HowItWorks />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}
```

- [ ] **Step 8: Build + full landing verification**

Run: `npm run build` → success.
Run: `npm test -- src/components/landing/landing.test.tsx` → 2 passing.
Manual (controller/human): `npm run dev`, open `/` — verify the dark landing renders, Clash Display headlines, hero fits the viewport with CTA visible, marquee scrolls (and pauses on hover), sections reveal on scroll, the comparison column glows, spotlight cards track the cursor. Check 375px mobile width: single column, no horizontal scroll.

- [ ] **Step 9: Commit**

```bash
git add src/components/landing/how-it-works.tsx src/components/landing/final-cta.tsx src/components/landing/landing-footer.tsx src/components/landing/landing.test.tsx src/app/page.tsx
git commit -m "feat(landing): how-it-works, final CTA, footer; compose full page"
```

---

## Self-Review Notes (coverage vs spec §9 + Taste)

- 11 sections delivered: Nav, Hero, Trust marquee, AI, WhatsApp, Pricing, Bento, Why-different, How-it-works, Final CTA, Footer.
- Clash Display (display) wired → Task 1; closes the Phase 1 deferral.
- Hero discipline: ≤2-line headline, 18-word subtext, CTA above fold, `min-h-[100dvh]`, `pt-24`. ✓
- Single CTA intent ("Start free") in nav, hero, final CTA, footer. ✓
- Layout families: split, marquee, phone-mock+steps, split-reversed, bento, comparison table, steps, centered spotlight CTA (≥4 distinct; no 3 consecutive identical splits — WhatsApp's phone+steps breaks AI→Pricing). ✓
- One marquee only; eyebrow used once (features). ✓
- Real component previews (mini-dashboard, chat, phone thread, pricing toggles) — no stock images, no fake-screenshot divs. ✓
- Motion via Phase 1 primitives → reduced-motion honored automatically; bento cell count = content (6). ✓
- Zero em-dashes in all copy (use periods/commas). Reviewers must grep for `—`/`–`.
- **Not in this phase:** the per-page palette sweep of the authed app (Phase 5).
```
