'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import NavLinks, { type NavLinksProps } from '@/components/nav-links'
import { LogoutButton } from '@/components/logout-button'

interface Props extends NavLinksProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNavDrawer({ open, onOpenChange, ...navProps }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0">
        <nav className="flex flex-col gap-1 p-4 pt-8">
          <NavLinks {...navProps} />
          <div className="mt-2 border-t pt-2">
            <LogoutButton variant="mobile" />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
