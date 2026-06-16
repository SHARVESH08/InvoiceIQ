'use client'

import { Boxes, ShoppingCart, FileText, QrCode, LayoutGrid, Upload } from 'lucide-react'
import { Reveal } from '@/components/motion/reveal'
import { RadialOrbitalTimeline, type OrbitItem } from '@/components/ui/radial-orbital-timeline'

const ITEMS: OrbitItem[] = [
  { id: 1, title: 'Multi-godown inventory', description: 'Track stock across locations with reserved-quantity awareness.', icon: Boxes },
  { id: 2, title: 'Purchase orders', description: 'OEM to distributor to retailer, end to end.', icon: ShoppingCart },
  { id: 3, title: 'Credit & debit notes', description: 'GST-correct adjustments in a click.', icon: FileText },
  { id: 4, title: 'Public invoice links', description: 'Share a link with QR pay and get paid faster.', icon: QrCode },
  { id: 5, title: 'Role dashboards', description: 'The right view for every company type.', icon: LayoutGrid },
  { id: 6, title: 'CSV import', description: 'Bring your catalog in minutes.', icon: Upload },
]

export function CapabilitiesOrbit() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <Reveal>
        <h2 className="mb-3 max-w-[18ch] font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Everything a growing business runs on.
        </h2>
        <p className="mb-4 max-w-[46ch] text-sm text-muted-foreground">
          Tap a node to explore. It all orbits one system.
        </p>
      </Reveal>
      <RadialOrbitalTimeline items={ITEMS} />
    </section>
  )
}
