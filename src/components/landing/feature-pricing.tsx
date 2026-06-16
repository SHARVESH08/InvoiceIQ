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
