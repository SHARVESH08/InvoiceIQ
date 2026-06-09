import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">InvoiceIQ</h1>
        <p className="text-muted-foreground text-sm">
          GST-compliant invoicing for Indian businesses
        </p>
      </div>
      <div className="flex gap-4">
        <Button asChild size="lg">
          <Link href="/auth/business/register">Register your business</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/auth/customer/login">View my invoices</Link>
        </Button>
      </div>
    </main>
  )
}
