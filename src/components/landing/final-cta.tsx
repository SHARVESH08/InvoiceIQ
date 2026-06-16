import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/glow-card'
import { Reveal } from '@/components/motion/reveal'

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <SpotlightCard className="w-full">
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
              Start billing smarter today.
            </h2>
            <p className="mt-4 max-w-[44ch] text-muted-foreground">
              Free to start. No card. Your data stays yours.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/get-started">Get started</Link>
            </Button>
          </div>
        </SpotlightCard>
      </Reveal>
    </section>
  )
}
