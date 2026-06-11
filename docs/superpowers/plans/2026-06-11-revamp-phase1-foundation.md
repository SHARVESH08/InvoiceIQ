# UI/UX Revamp — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the dark-only "Midnight Gold" visual foundation — color tokens, typography, the three reusable UI components (GlowCard, animated Switch, MenuToggle), and motion/loading primitives — that every later phase depends on.

**Architecture:** Tokens live as HSL CSS variables in `globals.css` (shadcn pattern), the app is forced dark via `class="dark"` on `<html>`. Fonts load through `next/font` exposed as CSS variables consumed by Tailwind's `fontFamily`. Interactive components (Switch, MenuToggle, GlowCard) are self-contained client components in `src/components/ui`, unit-tested under jsdom. Motion primitives wrap `framer-motion` and honor `prefers-reduced-motion`.

**Tech Stack:** Next.js 16 (App Router), Tailwind 3.4, shadcn/ui (CSS variables), framer-motion 12, lucide-react, Vitest + @testing-library/react (jsdom), next/font.

**Source spec:** `docs/superpowers/specs/2026-06-11-ui-ux-revamp-design.md` (§3–6, §8.1, §10).

---

## File Structure

**Created**
- `tests/setup-dom.ts` — jsdom/jest-dom matcher registration (imported per-test or via pragma).
- `src/app/fonts/` — self-hosted Clash Display woff2 + `index.ts` (next/font/local config).
- `src/components/ui/spotlight-card.tsx` — GlowCard (cursor-tracked spotlight border).
- `src/components/ui/spotlight-card.test.tsx`
- `src/components/ui/glow-card.tsx` — `SpotlightCard` gold-locked wrapper + `.btn-glow` documented usage.
- `src/components/ui/switch-animated.tsx` + `switch-animated.module.css` + `switch-animated.test.tsx`
- `src/components/ui/menu-toggle.tsx` + `menu-toggle.test.tsx`
- `src/components/motion/reveal.tsx`, `reveal-stagger.tsx`, `marquee.tsx`, `page-transition.tsx`
- `src/components/motion/reveal.test.tsx`
- `src/components/ui/skeleton.tsx`

**Modified**
- `src/app/globals.css` — Midnight Gold tokens, `success` token, marquee keyframes.
- `tailwind.config.ts` — `success` color, `fontFamily` (sans/display/mono).
- `src/app/layout.tsx` — font wiring, `class="dark"`.
- `package.json` — add `jsdom` devDependency (via install).

---

## Task 1: Test infrastructure (jsdom for component tests)

**Files:**
- Create: `tests/setup-dom.ts`
- Test: `src/components/ui/smoke.test.tsx` (temporary, deleted at end of task)

- [ ] **Step 1: Install jsdom**

Run: `npm install -D jsdom`
Expected: `jsdom` appears in `package.json` devDependencies, install succeeds.

- [ ] **Step 2: Create the jest-dom matcher setup file**

Create `tests/setup-dom.ts`:

```ts
// Registers @testing-library/jest-dom matchers (toBeInTheDocument, toBeChecked, …)
// Imported by component test files that use the jsdom environment.
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Write a smoke test to prove jsdom + RTL work**

Create `src/components/ui/smoke.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import '../../../tests/setup-dom'

describe('jsdom smoke', () => {
  it('renders into the DOM', () => {
    render(<button>Hello</button>)
    expect(screen.getByRole('button', { name: 'Hello' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run the smoke test**

Run: `npm test -- src/components/ui/smoke.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Delete the smoke test and commit**

```bash
rm "src/components/ui/smoke.test.tsx"
git add package.json package-lock.json tests/setup-dom.ts
git commit -m "test: enable jsdom + jest-dom for component tests"
```

---

## Task 2: Midnight Gold color tokens

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `src/app/layout.tsx:19` (add `dark` class)

No unit test (pure CSS/visual); verified by build + dev server.

- [ ] **Step 1: Replace the token blocks in `src/app/globals.css`**

Replace the entire `@layer base { :root { … } .dark { … } }` block (lines 5–50) with the dark-only Midnight Gold tokens (identical values in `:root` and `.dark` so the theme is locked):

```css
@layer base {
  :root,
  .dark {
    --background: 30 6% 6%;
    --foreground: 40 22% 90%;
    --card: 30 6% 9%;
    --card-foreground: 40 22% 90%;
    --popover: 30 5% 13%;
    --popover-foreground: 40 22% 90%;
    --primary: 38 91% 55%;
    --primary-foreground: 34 62% 6%;
    --secondary: 30 5% 13%;
    --secondary-foreground: 40 22% 90%;
    --muted: 30 5% 13%;
    --muted-foreground: 36 8% 58%;
    --accent: 30 5% 13%;
    --accent-foreground: 40 22% 90%;
    --destructive: 3 85% 62%;
    --destructive-foreground: 40 22% 95%;
    --success: 151 62% 46%;
    --success-foreground: 151 40% 8%;
    --border: 28 6% 17%;
    --input: 28 6% 17%;
    --ring: 38 91% 55%;
    --radius: 0.625rem;
  }
}
```

- [ ] **Step 2: Append marquee keyframes to `src/app/globals.css`**

Add at the end of the file:

```css
@layer utilities {
  @keyframes marquee-x {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  .animate-marquee { animation: marquee-x 28s linear infinite; }
  @media (prefers-reduced-motion: reduce) {
    .animate-marquee { animation: none; }
  }
}
```

- [ ] **Step 3: Add `success` color to `tailwind.config.ts`**

In `tailwind.config.ts`, inside `theme.extend.colors`, after the `destructive` block (around line 42), add:

```ts
      success: {
        DEFAULT: "hsl(var(--success))",
        foreground: "hsl(var(--success-foreground))",
      },
```

- [ ] **Step 4: Force dark mode in `src/app/layout.tsx`**

Change line 19 from:

```tsx
    <html lang="en" className={inter.className}>
```

to (temporary — fonts replace this in Task 3; keep `dark` here):

```tsx
    <html lang="en" className={`dark ${inter.className}`}>
```

- [ ] **Step 5: Verify build compiles**

Run: `npm run build`
Expected: build succeeds with no CSS/Tailwind errors.

- [ ] **Step 6: Visual check + commit**

Run `npm run dev`, open `http://localhost:3000`. Expected: background is warm near-black, text is warm off-white, buttons render gold. Then:

```bash
git add src/app/globals.css tailwind.config.ts src/app/layout.tsx
git commit -m "feat(theme): Midnight Gold dark-only tokens + success color + marquee keyframes"
```

---

## Task 3: Typography (Space Grotesk + IBM Plex Mono + Clash Display)

**Files:**
- Create: `src/app/fonts/index.ts`, `src/app/fonts/ClashDisplay-Variable.woff2`
- Modify: `src/app/layout.tsx`
- Modify: `tailwind.config.ts`

No unit test; verified by build + visual.

- [ ] **Step 1: Acquire the Clash Display font file**

Download `ClashDisplay-Variable.woff2` from Fontshare (https://www.fontshare.com/fonts/clash-display — "Download Family", use the variable woff2) and place it at `src/app/fonts/ClashDisplay-Variable.woff2`.
Fallback if unavailable: skip Clash, and in Step 3 set `--font-display` to the Space Grotesk variable (the app still works; landing display face degrades to Space Grotesk). Note this in the commit if the fallback is taken.

- [ ] **Step 2: Create the local-font config**

Create `src/app/fonts/index.ts`:

```ts
import localFont from 'next/font/local'

// Landing display face. Self-hosted from Fontshare (free license).
export const clashDisplay = localFont({
  src: './ClashDisplay-Variable.woff2',
  variable: '--font-display',
  weight: '400 700',
  display: 'swap',
})
```

- [ ] **Step 3: Wire all three fonts in `src/app/layout.tsx`**

Replace the top of `src/app/layout.tsx` (imports + `inter` const + the `<html>` line) with:

```tsx
import type { Metadata } from 'next'
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { clashDisplay } from './fonts'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'InvoiceIQ',
  description: 'GST-compliant invoicing for Indian businesses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`dark ${spaceGrotesk.variable} ${plexMono.variable} ${clashDisplay.variable}`}
    >
      <body className="font-sans antialiased">
        <Toaster position="top-right" richColors theme="dark" />
        {children}
      </body>
    </html>
  )
}
```

(If the Step-1 fallback was taken, change `clashDisplay` import to reuse `spaceGrotesk.variable` for `--font-display`, or set it in CSS.)

- [ ] **Step 4: Register font families in `tailwind.config.ts`**

In `theme.extend`, add a `fontFamily` block (sibling of `colors`):

```ts
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
```

- [ ] **Step 5: Verify build + visual + commit**

Run: `npm run build` (Expected: success).
Run `npm run dev`, confirm body text renders in Space Grotesk. Then:

```bash
git add src/app/fonts src/app/layout.tsx tailwind.config.ts
git commit -m "feat(type): Space Grotesk (UI) + IBM Plex Mono (numbers) + Clash Display (display)"
```

---

## Task 4: GlowCard (spotlight-card) + gold SpotlightCard wrapper

**Files:**
- Create: `src/components/ui/spotlight-card.tsx`
- Create: `src/components/ui/glow-card.tsx`
- Test: `src/components/ui/spotlight-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/spotlight-card.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import '../../../tests/setup-dom'
import { GlowCard } from './spotlight-card'

describe('GlowCard', () => {
  it('renders children', () => {
    render(<GlowCard><span>Inside</span></GlowCard>)
    expect(screen.getByText('Inside')).toBeInTheDocument()
  })

  it('applies the size class when not customSize', () => {
    const { container } = render(<GlowCard size="lg">x</GlowCard>)
    const card = container.querySelector('[data-glow]') as HTMLElement
    expect(card.className).toContain('w-80')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ui/spotlight-card.test.tsx`
Expected: FAIL ("Cannot find module './spotlight-card'").

- [ ] **Step 3: Create `src/components/ui/spotlight-card.tsx`**

Adapted from the supplied component: inject the shared `<style>` once (module guard), and disable cursor tracking under reduced motion.

```tsx
'use client'

import React, { useEffect, useRef, ReactNode } from 'react'

interface GlowCardProps {
  children: ReactNode
  className?: string
  glowColor?: 'blue' | 'purple' | 'green' | 'red' | 'orange' | 'gold'
  size?: 'sm' | 'md' | 'lg'
  width?: string | number
  height?: string | number
  customSize?: boolean
}

const glowColorMap = {
  blue: { base: 220, spread: 200 },
  purple: { base: 280, spread: 300 },
  green: { base: 120, spread: 200 },
  red: { base: 0, spread: 200 },
  orange: { base: 30, spread: 200 },
  gold: { base: 38, spread: 60 }, // Midnight Gold accent, narrow spread = stays gold
}

const sizeMap = { sm: 'w-48 h-64', md: 'w-64 h-80', lg: 'w-80 h-96' }

let stylesInjected = false

const beforeAfterStyles = `
  [data-glow]::before,[data-glow]::after{pointer-events:none;content:"";position:absolute;inset:calc(var(--border-size) * -1);border:var(--border-size) solid transparent;border-radius:calc(var(--radius) * 1px);background-attachment:fixed;background-size:calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)));background-repeat:no-repeat;background-position:50% 50%;mask:linear-gradient(transparent,transparent),linear-gradient(white,white);mask-clip:padding-box,border-box;mask-composite:intersect;}
  [data-glow]::before{background-image:radial-gradient(calc(var(--spotlight-size) * 0.75) calc(var(--spotlight-size) * 0.75) at calc(var(--x,0) * 1px) calc(var(--y,0) * 1px),hsl(var(--hue,210) calc(var(--saturation,100) * 1%) calc(var(--lightness,50) * 1%) / var(--border-spot-opacity,1)),transparent 100%);filter:brightness(2);}
  [data-glow]::after{background-image:radial-gradient(calc(var(--spotlight-size) * 0.5) calc(var(--spotlight-size) * 0.5) at calc(var(--x,0) * 1px) calc(var(--y,0) * 1px),hsl(0 100% 100% / var(--border-light-opacity,1)),transparent 100%);}
  [data-glow] [data-glow]{position:absolute;inset:0;will-change:filter;opacity:var(--outer,1);border-radius:calc(var(--radius) * 1px);border-width:calc(var(--border-size) * 20);filter:blur(calc(var(--border-size) * 10));background:none;pointer-events:none;border:none;}
  [data-glow] > [data-glow]::before{inset:-10px;border-width:10px;}
`

const GlowCard: React.FC<GlowCardProps> = ({
  children, className = '', glowColor = 'gold', size = 'md', width, height, customSize = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!stylesInjected) {
      const el = document.createElement('style')
      el.dataset.glowStyles = 'true'
      el.innerHTML = beforeAfterStyles
      document.head.appendChild(el)
      stylesInjected = true
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const syncPointer = (e: PointerEvent) => {
      const { clientX: x, clientY: y } = e
      const c = cardRef.current
      if (!c) return
      c.style.setProperty('--x', x.toFixed(2))
      c.style.setProperty('--xp', (x / window.innerWidth).toFixed(2))
      c.style.setProperty('--y', y.toFixed(2))
      c.style.setProperty('--yp', (y / window.innerHeight).toFixed(2))
    }
    document.addEventListener('pointermove', syncPointer)
    return () => document.removeEventListener('pointermove', syncPointer)
  }, [])

  const { base, spread } = glowColorMap[glowColor]
  const getSizeClasses = () => (customSize ? '' : sizeMap[size])

  const getInlineStyles = (): React.CSSProperties => {
    const s: Record<string, string | number> = {
      '--base': base,
      '--spread': spread,
      '--radius': '12',
      '--border': '2',
      '--backdrop': 'hsl(30 6% 9% / 0.6)',
      '--backup-border': 'var(--backdrop)',
      '--size': '200',
      '--outer': '1',
      '--border-size': 'calc(var(--border, 2) * 1px)',
      '--spotlight-size': 'calc(var(--size, 150) * 1px)',
      '--hue': 'calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))',
      backgroundImage: `radial-gradient(var(--spotlight-size) var(--spotlight-size) at calc(var(--x,0) * 1px) calc(var(--y,0) * 1px), hsl(var(--hue,210) calc(var(--saturation,100) * 1%) calc(var(--lightness,70) * 1%) / var(--bg-spot-opacity,0.1)), transparent)`,
      backgroundColor: 'var(--backdrop, transparent)',
      backgroundSize: 'calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))',
      backgroundPosition: '50% 50%',
      backgroundAttachment: 'fixed',
      border: 'var(--border-size) solid var(--backup-border)',
      position: 'relative',
      touchAction: 'none',
    }
    if (width !== undefined) s.width = typeof width === 'number' ? `${width}px` : width
    if (height !== undefined) s.height = typeof height === 'number' ? `${height}px` : height
    return s as React.CSSProperties
  }

  return (
    <div
      ref={cardRef}
      data-glow
      style={getInlineStyles()}
      className={`${getSizeClasses()} ${!customSize ? 'aspect-[3/4]' : ''} rounded-xl relative grid grid-rows-[1fr_auto] shadow-[0_1rem_2rem_-1rem_black] p-4 gap-4 backdrop-blur-[5px] ${className}`}
    >
      <div ref={innerRef} data-glow></div>
      {children}
    </div>
  )
}

export { GlowCard }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ui/spotlight-card.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Create the gold-locked wrapper `src/components/ui/glow-card.tsx`**

```tsx
'use client'

import { ReactNode } from 'react'
import { GlowCard } from './spotlight-card'

/**
 * SpotlightCard — project-standard gold spotlight container.
 * Use sparingly: dashboard hero KPI, landing hero/feature panels, final CTA.
 */
export function SpotlightCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <GlowCard glowColor="gold" customSize className={className}>
      {children}
    </GlowCard>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/spotlight-card.tsx src/components/ui/spotlight-card.test.tsx src/components/ui/glow-card.tsx
git commit -m "feat(ui): gold-tuned GlowCard spotlight + SpotlightCard wrapper"
```

---

## Task 5: Animated Switch (styled-components removed)

**Files:**
- Create: `src/components/ui/switch-animated.tsx`
- Create: `src/components/ui/switch-animated.module.css`
- Test: `src/components/ui/switch-animated.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/switch-animated.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import '../../../tests/setup-dom'
import { SwitchAnimated } from './switch-animated'

function Harness() {
  const [on, setOn] = useState(false)
  return <SwitchAnimated checked={on} onCheckedChange={setOn} aria-label="alerts" />
}

describe('SwitchAnimated', () => {
  it('exposes an accessible checkbox', () => {
    render(<SwitchAnimated checked={false} onCheckedChange={() => {}} aria-label="alerts" />)
    expect(screen.getByRole('checkbox', { name: 'alerts' })).toBeInTheDocument()
  })

  it('toggles checked state on click', async () => {
    render(<Harness />)
    const box = screen.getByRole('checkbox', { name: 'alerts' })
    expect(box).not.toBeChecked()
    await userEvent.click(box)
    expect(box).toBeChecked()
  })
})
```

- [ ] **Step 2: Verify it fails**

Run: `npm test -- src/components/ui/switch-animated.test.tsx`
Expected: FAIL ("Cannot find module './switch-animated'"). If `@testing-library/user-event` is missing, install it: `npm install -D @testing-library/user-event`.

- [ ] **Step 3: Create the CSS module `src/components/ui/switch-animated.module.css`**

Ported from the supplied styled-components, recolored to gold (`#F5A623`) with neutral off-track.

```css
.wrap { display: inline-flex; }
.input { opacity: 0; width: 0; height: 0; position: absolute; }
.switch {
  --a: 0.5s ease-out;
  cursor: pointer;
  position: relative;
  display: inline-flex;
  height: 1.6em;
  border-radius: 2em;
  box-shadow: 0 0 0 0.5em hsl(28 6% 26%);
  aspect-ratio: 212.4992 / 84.4688;
  background-color: hsl(28 6% 26%);
  transition: background-color var(--a), box-shadow var(--a);
}
.switch svg { height: 100%; }
.switch svg path {
  color: hsl(40 22% 90%);
  stroke-width: 16;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 136 224;
  transition: all var(--a), 0s transform;
  transform-origin: center;
}
.input:checked ~ .switch { background-color: hsl(38 91% 55%); box-shadow: 0 0 0 0.5em hsl(38 91% 55%); }
.input:checked ~ .switch svg path { stroke-dashoffset: 180; transform: scaleY(-1); color: hsl(34 62% 6%); }
.input:focus-visible ~ .switch { outline: 2px solid hsl(38 91% 55%); outline-offset: 4px; }
@media (prefers-reduced-motion: reduce) {
  .switch, .switch svg path { transition: none; }
}
```

- [ ] **Step 4: Create the component `src/components/ui/switch-animated.tsx`**

```tsx
'use client'

import React, { useId } from 'react'
import styles from './switch-animated.module.css'

interface SwitchAnimatedProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
  id?: string
}

export function SwitchAnimated({
  checked,
  onCheckedChange,
  disabled,
  id,
  ...rest
}: SwitchAnimatedProps) {
  const reactId = useId()
  const inputId = id ?? reactId
  return (
    <span className={styles.wrap}>
      <input
        id={inputId}
        className={styles.input}
        type="checkbox"
        role="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        aria-label={rest['aria-label']}
      />
      <label className={styles.switch} htmlFor={inputId} aria-hidden="true">
        <svg viewBox="0 0 212.4992 84.4688" overflow="visible">
          <path
            pathLength={360}
            fill="none"
            stroke="currentColor"
            d="M 42.2496 0 A 42.24 42.24 90 0 0 0 42.2496 A 42.24 42.24 90 0 0 42.2496 84.4688 A 42.24 42.24 90 0 0 84.4992 42.2496 A 42.24 42.24 90 0 0 42.2496 0 A 42.24 42.24 90 0 0 0 42.2496 A 42.24 42.24 90 0 0 42.2496 84.4688 L 170.2496 84.4688 A 42.24 42.24 90 0 0 212.4992 42.2496 A 42.24 42.24 90 0 0 170.2496 0 A 42.24 42.24 90 0 0 128 42.2496 A 42.24 42.24 90 0 0 170.2496 84.4688 A 42.24 42.24 90 0 0 212.4992 42.2496 A 42.24 42.24 90 0 0 170.2496 0 L 42.2496 0"
          />
        </svg>
      </label>
    </span>
  )
}
```

- [ ] **Step 5: Verify the test passes**

Run: `npm test -- src/components/ui/switch-animated.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/switch-animated.tsx src/components/ui/switch-animated.module.css src/components/ui/switch-animated.test.tsx package.json package-lock.json
git commit -m "feat(ui): animated gold Switch (no styled-components)"
```

---

## Task 6: MenuToggle

**Files:**
- Create: `src/components/ui/menu-toggle.tsx`
- Test: `src/components/ui/menu-toggle.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/menu-toggle.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import '../../../tests/setup-dom'
import { MenuToggle } from './menu-toggle'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <MenuToggle open={open} onOpenChange={setOpen} />
      <span>{open ? 'OPEN' : 'CLOSED'}</span>
    </>
  )
}

describe('MenuToggle', () => {
  it('calls onOpenChange with the toggled value', async () => {
    render(<Harness />)
    expect(screen.getByText('CLOSED')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByText('OPEN')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Verify it fails**

Run: `npm test -- src/components/ui/menu-toggle.test.tsx`
Expected: FAIL ("Cannot find module './menu-toggle'").

- [ ] **Step 3: Create `src/components/ui/menu-toggle.tsx`**

Supplied component verbatim (uses existing `@/lib/utils` `cn`):

```tsx
'use client'
import React from 'react'
import { cn } from '@/lib/utils'

type MenuToggleProps = React.ComponentProps<'svg'> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MenuToggle({
  open,
  onOpenChange,
  className,
  fill = 'none',
  stroke = 'currentColor',
  strokeWidth = 2,
  strokeLinecap = 'round',
  strokeLinejoin = 'round',
  ...props
}: MenuToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-center">
      <input
        className="hidden"
        type="checkbox"
        onChange={() => onOpenChange(!open)}
        checked={open}
      />
      <svg
        strokeWidth={strokeWidth}
        fill={fill}
        stroke={stroke}
        viewBox="0 0 32 32"
        strokeLinecap={strokeLinecap}
        strokeLinejoin={strokeLinejoin}
        className={cn('size-4 transition-transform duration-500 ease-out', open && '-rotate-45', className)}
        {...props}
      >
        <path
          className={cn(
            'transition-all duration-500 ease-out',
            open ? '[stroke-dasharray:20_300] [stroke-dashoffset:-32.42px]' : '[stroke-dasharray:12_63]',
          )}
          d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"
        />
        <path d="M7 16 27 16" />
      </svg>
    </label>
  )
}
```

- [ ] **Step 4: Verify the test passes**

Run: `npm test -- src/components/ui/menu-toggle.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/menu-toggle.tsx src/components/ui/menu-toggle.test.tsx
git commit -m "feat(ui): animated MenuToggle"
```

---

## Task 7: Motion primitives

**Files:**
- Create: `src/components/motion/reveal.tsx`, `reveal-stagger.tsx`, `marquee.tsx`, `page-transition.tsx`
- Test: `src/components/motion/reveal.test.tsx`

- [ ] **Step 1: Write the failing test (Reveal renders children)**

Create `src/components/motion/reveal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import '../../../tests/setup-dom'
import { Reveal } from './reveal'

describe('Reveal', () => {
  it('renders its children', () => {
    render(<Reveal><p>Revealed content</p></Reveal>)
    expect(screen.getByText('Revealed content')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Verify it fails**

Run: `npm test -- src/components/motion/reveal.test.tsx`
Expected: FAIL ("Cannot find module './reveal'").

- [ ] **Step 3: Create `src/components/motion/reveal.tsx`**

```tsx
'use client'

import { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 4: Verify the test passes**

Run: `npm test -- src/components/motion/reveal.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Create `src/components/motion/reveal-stagger.tsx`**

```tsx
'use client'

import { ReactNode, Children } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export function RevealStagger({
  children,
  className = '',
  step = 0.06,
}: {
  children: ReactNode
  className?: string
  step?: number
}) {
  const reduce = useReducedMotion()
  return (
    <div className={className}>
      {Children.map(children, (child, i) => (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: i * step, ease: [0.16, 1, 0.3, 1] }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create `src/components/motion/marquee.tsx`**

Uses the `.animate-marquee` keyframes added in Task 2 (CSS handles reduced-motion).

```tsx
import { ReactNode } from 'react'

export function Marquee({ children }: { children: ReactNode }) {
  return (
    <div className="group relative flex overflow-hidden">
      <div className="flex shrink-0 animate-marquee gap-8 pr-8 group-hover:[animation-play-state:paused]">
        {children}
      </div>
      <div
        aria-hidden="true"
        className="flex shrink-0 animate-marquee gap-8 pr-8 group-hover:[animation-play-state:paused]"
      >
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create `src/components/motion/page-transition.tsx`**

```tsx
'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/motion
git commit -m "feat(motion): Reveal, RevealStagger, Marquee, PageTransition primitives"
```

---

## Task 8: Skeleton primitive

**Files:**
- Create: `src/components/ui/skeleton.tsx`
- Test: `src/components/ui/skeleton.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/skeleton.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render } from '@testing-library/react'
import '../../../tests/setup-dom'
import { Skeleton } from './skeleton'

describe('Skeleton', () => {
  it('merges custom classes onto the pulse base', () => {
    const { container } = render(<Skeleton className="h-8 w-32" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('animate-pulse')
    expect(el.className).toContain('h-8')
  })
})
```

- [ ] **Step 2: Verify it fails**

Run: `npm test -- src/components/ui/skeleton.test.tsx`
Expected: FAIL ("Cannot find module './skeleton'").

- [ ] **Step 3: Create `src/components/ui/skeleton.tsx`**

```tsx
import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}
```

- [ ] **Step 4: Verify the test passes**

Run: `npm test -- src/components/ui/skeleton.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Run the full test suite + final build**

Run: `npm test`
Expected: all Phase 1 tests pass.
Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/skeleton.tsx src/components/ui/skeleton.test.tsx
git commit -m "feat(ui): Skeleton loading primitive"
```

---

## Self-Review Notes (coverage vs spec)

- Spec §3 color tokens → Task 2. §4 typography → Task 3. §5 motion + skeleton → Tasks 7, 8. §6 GlowCard → Task 4. §8.1 animated Switch → Task 5. §10 component integration (3 components) → Tasks 4, 5, 6.
- GlowCard perf refactor (shared style/listener, reduced-motion) → Task 4 Step 3.
- styled-components dropped → Task 5 (CSS module).
- **Deferred to later phases (not this plan):** sidebar assembly (Phase 2), pricing-alerts page (Phase 3), landing page (Phase 4), global page sweep + `loading.tsx` per route + dashboard glow application (Phases 2–5). These consume the primitives built here.
- Pure-visual tasks (tokens, fonts, marquee CSS) are verified by build + dev-server visual check rather than unit tests, by nature.
```
