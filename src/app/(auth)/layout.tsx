import { Reveal } from '@/components/motion/reveal'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Reveal className="mb-6 text-center">
        <span className="text-2xl font-bold tracking-tight">InvoiceIQ</span>
      </Reveal>
      <Reveal delay={0.1} className="w-full flex justify-center">
        {children}
      </Reveal>
    </div>
  )
}
