'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SidebarNav } from '@/components/nav/sidebar-nav'
import { getNavItems, type NavContext } from '@/components/nav/nav-items'
import { LogoutButton } from '@/components/logout-button'

interface Props extends NavContext {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNavDrawer({ open, onOpenChange, ...ctx }: Props) {
  const { main, footer } = getNavItems(ctx)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] bg-card p-0">
        <div className="flex flex-col gap-3 p-4 pt-8">
          <SidebarNav items={main} onNavigate={() => onOpenChange(false)} />
          <div className="border-t border-border pt-3">
            <SidebarNav items={footer} onNavigate={() => onOpenChange(false)} />
          </div>
          <div className="mt-1 border-t border-border pt-3">
            <LogoutButton variant="mobile" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
