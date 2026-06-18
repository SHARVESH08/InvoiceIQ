import Link from 'next/link'
import { Reveal } from '@/components/motion/reveal'
import { BrandMark } from '@/components/ui/brand-mark'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Reveal className="mb-6">
        <Link href="/" className="flex items-center gap-2" aria-label="InvoiceIQ home">
          <BrandMark size={32} priority />
          <span className="font-display text-2xl font-semibold tracking-tight">InvoiceIQ</span>
        </Link>
      </Reveal>
      <Reveal delay={0.1} className="w-full flex justify-center">
        {children}
      </Reveal>
    </div>
  )
}
