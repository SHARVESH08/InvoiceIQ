import { Marquee } from '@/components/motion/marquee'

const ITEMS = [
  'GST e-invoice ready',
  'GSTIN validation',
  'Multi-godown stock',
  'WhatsApp orders',
  'Credit and debit notes',
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
