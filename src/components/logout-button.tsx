import { LogOut } from 'lucide-react'

import { cn } from '@/lib/utils'
import { signOut } from '@/lib/actions/auth-shared'

// ─────────────────────────────────────────────────────────────────────────────
// LogoutButton
// A <form> bound to the signOut server action (auth-shared.ts), which calls
// supabase.auth.signOut() then redirect('/'). No 'use client' needed — a form
// action pointed at a server action works in both Server Components (the
// business/customer layout headers) and Client Components (the mobile drawer).
//
// variant:
//   'inline'  — compact header item (desktop nav, right side)
//   'mobile'  — full-width 44px tap target for the hamburger drawer (Phase 13)
// ─────────────────────────────────────────────────────────────────────────────

export function LogoutButton({
  variant = 'inline',
}: {
  variant?: 'inline' | 'mobile'
}) {
  return (
    <form action={signOut} className={variant === 'mobile' ? 'w-full' : undefined}>
      <button
        type="submit"
        className={cn(
          'flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
          variant === 'mobile' && 'min-h-[44px] w-full px-2'
        )}
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </form>
  )
}
