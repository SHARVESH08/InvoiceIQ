import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { MobileHeader } from '@/components/mobile-header'
import { Sidebar } from '@/components/sidebar'
import { PageTransition } from '@/components/motion/page-transition'

// Customer portal shell. Reuses the business app's Sidebar / MobileHeader
// (variant="customer") so the revamped Midnight Gold look + collapsible rail
// are consistent across both audiences. The customer nav is cross-tenant
// (My Invoices + Settings) — see getCustomerNavItems.
export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const cookieStore = await cookies()
  const defaultCollapsed = cookieStore.get('sidebar_collapsed')?.value === '1'

  return (
    <div className="flex min-h-screen">
      <Sidebar
        variant="customer"
        userEmail={user?.email ?? ''}
        defaultCollapsed={defaultCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader variant="customer" />
        <main className="flex-1 p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  )
}
