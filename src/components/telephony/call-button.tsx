'use client'

import { useTransition } from 'react'
import { Loader2, Phone } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { initiateCall } from '@/lib/actions/telephony'

interface CallButtonProps {
  toNumber: string | null | undefined
  customerId?: string
  leadId?: string
  dealId?: string
  /** Compact icon-only rendering for table rows. */
  compact?: boolean
}

/**
 * CallButton — Exotel click-to-call. Rings the salesperson's phone first, then
 * bridges the customer; the StatusCallback webhook logs the call (and its
 * recording) to the timeline automatically.
 */
export function CallButton({ toNumber, customerId, leadId, dealId, compact = false }: CallButtonProps) {
  const [isPending, startTransition] = useTransition()

  if (!toNumber) return null

  function call() {
    startTransition(async () => {
      const result = await initiateCall({
        to_number: toNumber as string,
        customer_id: customerId,
        lead_id: leadId,
        deal_id: dealId,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Calling you now — pick up and we connect the customer.')
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={call}
      disabled={isPending}
      aria-label={`Call ${toNumber}`}
      className={compact ? 'h-8 w-8 p-0' : 'h-8 text-xs'}
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Phone className="size-3.5" />
      )}
      {!compact && <span className="ml-1">Call</span>}
    </Button>
  )
}
