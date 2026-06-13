import Link from 'next/link'

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            i
          </span>
          <span className="font-display font-semibold text-foreground">InvoiceIQ</span>
          <span className="ml-2">GST billing &amp; inventory</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/auth/business/register" className="transition-colors hover:text-foreground">Start free</Link>
          <Link href="/auth/business/login" className="transition-colors hover:text-foreground">Log in</Link>
          <Link href="/auth/customer/login" className="transition-colors hover:text-foreground">View my invoices</Link>
          <a href="#features" className="transition-colors hover:text-foreground">Features</a>
        </div>
      </div>
    </footer>
  )
}
