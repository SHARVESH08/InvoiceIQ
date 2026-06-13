import { RevealStagger } from '@/components/motion/reveal-stagger'
import { Boxes, ShoppingCart, FileText, QrCode, LayoutGrid, Upload } from 'lucide-react'

const CELLS = [
  { icon: Boxes, title: 'Multi-godown inventory', body: 'Track stock across locations with reserved-quantity awareness.', span: 'sm:col-span-2 sm:row-span-2', tint: true },
  { icon: ShoppingCart, title: 'Purchase orders', body: 'OEM to distributor to retailer, end to end.' },
  { icon: FileText, title: 'Credit and debit notes', body: 'GST-correct adjustments in a click.' },
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
                  ? 'bg-card bg-[radial-gradient(120%_120%_at_0%_0%,hsl(var(--primary)/0.10),transparent)]'
                  : 'bg-card'
              }`}
            >
              <Icon className="h-6 w-6 text-primary" aria-hidden />
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
