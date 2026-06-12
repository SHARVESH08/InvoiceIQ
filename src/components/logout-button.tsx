import { LogOut } from 'lucide-react'

import { cn } from '@/lib/utils'
import { signOut } from '@/lib/actions/auth-shared'

// LogoutButton: a <form> bound to the signOut server action.
// variant: 'inline' (header item) | 'mobile' (full-width 44px drawer item)
// iconOnly: collapsed-sidebar rendering — icon only, label moved to title/sr-only.
export function LogoutButton({
  variant = 'inline',
  iconOnly = false,
}: {
  variant?: 'inline' | 'mobile'
  iconOnly?: boolean
}) {
  return (
    <form action={signOut} className={variant === 'mobile' ? 'w-full' : undefined}>
      <button
        type="submit"
        title={iconOnly ? 'Log out' : undefined}
        aria-label={iconOnly ? 'Log out' : undefined}
        className={cn(
          'flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
          variant === 'mobile' && 'min-h-[44px] w-full px-2',
          iconOnly && 'w-full justify-center',
        )}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {iconOnly ? <span className="sr-only">Log out</span> : 'Log out'}
      </button>
    </form>
  )
}
