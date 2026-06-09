export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-6 text-center">
        <span className="text-2xl font-bold tracking-tight">InvoiceIQ</span>
      </div>
      {children}
    </div>
  )
}
