'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MobileNavDrawer } from '@/components/mobile-nav-drawer'
import type { NavContext } from '@/components/nav/nav-items'

export function MobileHeader(props: NavContext) {
  const [open, setOpen] = useState(false)
  return (
    <header className="flex md:hidden sticky top-0 z-50 h-14 items-center border-b bg-background px-4">
      <Button
        variant="ghost"
        size="icon"
        className="min-h-[44px] min-w-[44px]"
        aria-label="Open navigation menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-6 w-6" />
      </Button>
      <span className="flex-1 text-center text-base font-semibold">InvoiceIQ</span>
      <div className="w-10" aria-hidden />
      <MobileNavDrawer open={open} onOpenChange={setOpen} {...props} />
    </header>
  )
}
