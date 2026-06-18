import Link from 'next/link'
import { BrandMark } from '@/components/ui/brand-mark'

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-4">
      <Link href="/" className="flex items-center gap-2" aria-label="InvoiceIQ home">
        <BrandMark size={32} priority />
        <span className="font-display text-2xl font-semibold tracking-tight">InvoiceIQ</span>
      </Link>
      <div className="w-full max-w-[480px]">{children}</div>
    </div>
  )
}
