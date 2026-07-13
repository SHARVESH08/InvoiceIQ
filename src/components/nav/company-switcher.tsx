'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { Building2, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { switchActiveCompany, type Membership } from '@/lib/actions/franchise'

interface CompanySwitcherProps {
  memberships: Membership[]
  collapsed?: boolean
}

/**
 * CompanySwitcher — sidebar dropdown for users who belong to more than one
 * company (franchise owners after invite acceptance, invited staff).
 *
 * Switching: server action persists app_metadata.active_company_id, then the
 * client refreshes the session so the auth hook re-issues the JWT with the new
 * company_id claim, then hard-navigates so every server component re-reads it.
 */
export function CompanySwitcher({ memberships, collapsed = false }: CompanySwitcherProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  // Nothing to switch between — keep the sidebar clean.
  if (memberships.length < 2) return null

  const active = memberships.find((m) => m.is_active) ?? memberships[0]

  function pick(companyId: string) {
    if (companyId === active.company_id) {
      setOpen(false)
      return
    }
    startTransition(async () => {
      const result = await switchActiveCompany(companyId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      // New JWT with the switched company_id claim, then full reload so all
      // server components and RLS-scoped queries see the new company.
      await createClient().auth.refreshSession()
      window.location.assign('/dashboard')
    })
  }

  return (
    <div ref={rootRef} className="relative px-2 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active company: ${active.company_name}. Switch company`}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-left',
          'transition-colors hover:border-primary/40 hover:bg-muted/70 cursor-pointer',
          collapsed && 'justify-center px-1.5',
        )}
      >
        {isPending ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        ) : (
          <Building2 className="size-4 shrink-0 text-primary" />
        )}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {active.company_name}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Companies"
          className={cn(
            'absolute left-2 right-2 z-50 mt-1.5 overflow-hidden rounded-lg border border-border bg-popover shadow-lg',
            collapsed && 'left-full ml-2 w-52 right-auto',
          )}
        >
          {memberships.map((m) => (
            <li key={m.company_id} role="option" aria-selected={m.is_active}>
              <button
                type="button"
                onClick={() => pick(m.company_id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted cursor-pointer"
              >
                <span className="min-w-0 flex-1 truncate">{m.company_name}</span>
                <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                  {m.role}
                </span>
                {m.is_active && <Check className="size-3.5 shrink-0 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
