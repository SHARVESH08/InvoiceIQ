'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Phone } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { initiateCall } from '@/lib/actions/telephony'
import { logInteraction } from '@/lib/actions/crm'

interface CallButtonProps {
  toNumber: string | null | undefined
  customerId?: string
  leadId?: string
  dealId?: string
  /**
   * Provider (Exotel) calling available for this company. When false the
   * button falls back to the FREE path: opens the device dialer via tel: and
   * offers one-tap call logging. No recording in free mode.
   */
  telephonyEnabled?: boolean
  /** Compact icon-only rendering for table rows. */
  compact?: boolean
}

/**
 * CallButton — two modes:
 *  - Exotel mode: server bridges agent + customer, webhook logs the call and
 *    its recording to the timeline automatically.
 *  - Free mode (no provider configured): tel: link opens the phone dialer;
 *    a toast action logs the call as a timeline interaction.
 */
export function CallButton({
  toNumber,
  customerId,
  leadId,
  dealId,
  telephonyEnabled = false,
  compact = false,
}: CallButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (!toNumber) return null
  const number = toNumber

  function logManualCall() {
    startTransition(async () => {
      const result = await logInteraction({
        type: 'call',
        content: `Called ${number} (logged manually)`,
        customer_id: customerId,
        lead_id: leadId,
        deal_id: dealId,
      })
      if ('error' in result) toast.error(result.error)
      else {
        toast.success('Call logged to the timeline')
        router.refresh()
      }
    })
  }

  function providerCall() {
    startTransition(async () => {
      const result = await initiateCall({
        to_number: number,
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

  function freeCall() {
    // Open the device dialer, then offer to log the call.
    window.location.href = `tel:${number.replace(/[\s\-()]/g, '')}`
    toast('Calling from your phone', {
      description: 'Want this call on the timeline?',
      action: { label: 'Log call', onClick: logManualCall },
      duration: 15000,
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={telephonyEnabled ? providerCall : freeCall}
      disabled={isPending}
      aria-label={`Call ${number}`}
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
