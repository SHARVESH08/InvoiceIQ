'use client'

import { useTransition } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { switchActiveCompany } from '@/lib/actions/franchise'

interface SwitchIntoCompanyButtonProps {
  companyId: string
  companyName: string
}

/** "Open" drill-down: switch the active company, then land on its dashboard. */
export function SwitchIntoCompanyButton({ companyId, companyName }: SwitchIntoCompanyButtonProps) {
  const [isPending, startTransition] = useTransition()

  function open() {
    startTransition(async () => {
      const result = await switchActiveCompany(companyId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      await createClient().auth.refreshSession()
      window.location.assign('/dashboard')
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={open}
      disabled={isPending}
      aria-label={`Open ${companyName} dashboard`}
      className="h-7 gap-1 px-2 text-xs text-primary hover:text-primary"
    >
      {isPending ? <Loader2 className="size-3 animate-spin" /> : 'Open'}
      {!isPending && <ArrowRight className="size-3" />}
    </Button>
  )
}
