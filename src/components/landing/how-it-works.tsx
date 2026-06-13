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
