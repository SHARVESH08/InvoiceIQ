import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/glow-card'
import { Reveal } from '@/components/motion/reveal'
import { RotatingText } from '@/components/ui/rotating-text'
import { BorderBeam } from '@/components/ui/border-beam'
import { NumberTicker } from '@/components/ui/number-ticker'

function MiniDashboard() {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-card/80 p-4">
      <BorderBeam size={140} duration={8} />
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">Dashboard</span>
        <span className="font-mono text-[10px] text-muted-foreground">FY 2025-26</span>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-primary/40 bg-background p-2.5 shadow-[0_0_30px_-12px] shadow-primary">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Revenue</p>
          <p className="font-mono text-base font-bold text-primary">
            <NumberTicker value={4.82} decimalPlaces={2} prefix="₹" suffix="L" />
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Invoices</p>
          <p className="font-mono text-base font-bold"><NumberTicker value={128} /></p>
        </div>
        <div className="rounded-lg border border-border bg-background p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Low stock</p>
          <p className="font-mono text-base font-bold"><NumberTicker value={7} /></p>
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
      <video
        aria-hidden
        autoPlay
        muted
        loop
        playsInline
        poster="/brand/banner.jpeg"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
      >
        <source src="/brand/banner-animation.mp4" type="video/mp4" />
      </video>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-background/70"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_0%,hsl(var(--primary)/0.10),transparent)]"
      />
      <div className="relative z-10 mx-auto grid min-h-[100dvh] max-w-6xl grid-cols-1 items-center gap-10 px-6 pt-24 pb-16 lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal>
          <div>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
              Billing that{' '}
              <RotatingText
                words={['thinks', 'learns', 'forecasts', 'reconciles', 'adapts']}
                className="italic text-primary"
              />{' '}
              for Indian business.
            </h1>
            <p className="mt-5 max-w-[42ch] text-base leading-relaxed text-muted-foreground md:text-lg">
              GST invoicing, live inventory, WhatsApp orders, and AI that flags what needs you. One
              system, not five.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/get-started">Get started</Link>
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
