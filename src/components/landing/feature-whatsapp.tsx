import { Reveal } from '@/components/motion/reveal'
import { RevealStagger } from '@/components/motion/reveal-stagger'

const STEPS = [
  { n: '01', t: 'Customer messages an order', d: 'No app to install. They just text what they need.' },
  { n: '02', t: 'Stock and invoice auto-draft', d: 'Inventory decrements and a draft invoice appears.' },
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
