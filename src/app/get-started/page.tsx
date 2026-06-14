import Link from 'next/link'
import { Building2, FileText, ArrowRight } from 'lucide-react'
import { SpotlightCard } from '@/components/ui/glow-card'

export const metadata = {
  title: 'Get started — InvoiceIQ',
}

export default function GetStartedPage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 py-16">
      <Link href="/" className="mb-10 flex items-center gap-2" aria-label="InvoiceIQ home">
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground"
        >
          i
        </span>
        <span className="font-display text-xl font-semibold">InvoiceIQ</span>
      </Link>

      <h1 className="text-center font-display text-3xl font-semibold tracking-tight md:text-4xl">
        How do you want to continue?
      </h1>
      <p className="mt-3 max-w-[44ch] text-center text-sm text-muted-foreground">
        Run your business on InvoiceIQ, or open an invoice you received.
      </p>

      <div className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Business */}
        <Link href="/auth/business/register" className="group block">
          <SpotlightCard className="h-full">
            <div className="flex h-full flex-col p-6">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Building2 className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-semibold">Register your business</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                GST invoicing, inventory, WhatsApp orders, and AI. Free to start.
              </p>
              <span className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
                Create account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </SpotlightCard>
        </Link>

        {/* Customer */}
        <Link href="/auth/customer/login" className="group block">
          <SpotlightCard className="h-full">
            <div className="flex h-full flex-col p-6">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <FileText className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-semibold">View my invoices</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Received an invoice from a business? Sign in to view and pay it.
              </p>
              <span className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
                Continue
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </SpotlightCard>
        </Link>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Already have a business account?{' '}
        <Link href="/auth/business/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </main>
  )
}
