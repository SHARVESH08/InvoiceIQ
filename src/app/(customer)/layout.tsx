import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/logout-button'

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b px-6 h-14 flex items-center gap-4 shrink-0">
        <span className="font-bold text-sm">InvoiceIQ</span>
        <Link
          href="/my"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          My Invoices
        </Link>
        <Link
          href="/my/settings"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Settings
        </Link>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{user?.email ?? ''}</span>
          <LogoutButton />
        </div>
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
