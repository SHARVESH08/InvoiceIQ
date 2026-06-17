'use client'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { SidebarNav } from '@/components/nav/sidebar-nav'
import { getNavItems, getCustomerNavItems, type NavContext } from '@/components/nav/nav-items'
import { LogoutButton } from '@/components/logout-button'

interface Props extends NavContext {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant?: 'business' | 'customer'
}

export function MobileNavDrawer({ open, onOpenChange, variant = 'business', ...ctx }: Props) {
  const { main, footer } = variant === 'customer' ? getCustomerNavItems() : getNavItems(ctx)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] bg-card p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex flex-col gap-3 p-4 pt-8">
          <SidebarNav items={main} ariaLabel="Primary" onNavigate={() => onOpenChange(false)} />
          <div className="border-t border-border pt-3">
            <SidebarNav items={footer} ariaLabel="Account" onNavigate={() => onOpenChange(false)} />
          </div>
          <div className="mt-1 border-t border-border pt-3">
            <LogoutButton variant="mobile" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
