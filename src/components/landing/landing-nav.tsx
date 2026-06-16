import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/ui/brand-mark'

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="InvoiceIQ home">
          <BrandMark size={28} priority />
          <span className="font-display text-lg font-semibold">InvoiceIQ</span>
        </Link>
        <div className="ml-auto hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">Features</a>
          <a href="#why" className="transition-colors hover:text-foreground">Why InvoiceIQ</a>
          <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
        </div>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <Button asChild size="sm">
            <Link href="/get-started">Get started</Link>
          </Button>
        </div>
      </nav>
    </header>
  )
}
