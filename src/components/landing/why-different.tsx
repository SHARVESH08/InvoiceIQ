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
