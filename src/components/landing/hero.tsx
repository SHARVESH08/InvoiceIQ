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
          <p className="font-mono text-base font-bold text-primary">Rs.4.82L</p>
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
