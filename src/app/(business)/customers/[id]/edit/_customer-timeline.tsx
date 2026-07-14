import {
  FileText,
  IndianRupee,
  MessageSquare,
  Phone,
  Mail,
  Footprints,
  StickyNote,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatRupees } from '@/lib/format'
import type { InteractionType } from '@/lib/actions/crm'

interface TimelineEvent {
  id: string
  at: string
  kind: 'invoice' | 'payment' | InteractionType
  text: string
  amount?: number
  /** crm_calls id when this event has a playable recording. */
  recordingCallId?: string
}

const INTERACTION_ICONS: Record<InteractionType, typeof Phone> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageSquare,
  visit: Footprints,
  note: StickyNote,
}

/**
 * CustomerTimeline — merged chronological view of invoices, payments, and CRM
 * interactions for one customer. Server component; RLS scopes every query.
 */
export async function CustomerTimeline({ customerId }: { customerId: string }) {
  const supabase = await createClient()

  const [invoicesRes, paymentsRes, interactionsRes, callsRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, created_at, status')
      .eq('customer_id', customerId)
      .not('status', 'in', '(draft,cancelled)')
      .order('created_at', { ascending: false })
      .limit(20),
    // payments carry no customer_id — reach the customer through the invoice
    supabase
      .from('payments')
      .select('id, amount, payment_method, created_at, invoices!inner(invoice_number, customer_id)')
      .eq('invoices.customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('crm_interactions')
      .select('id, type, content, occurred_at')
      .eq('customer_id', customerId)
      .order('occurred_at', { ascending: false })
      .limit(20),
    // Calls with recordings — matched to their interaction row for playback.
    supabase
      .from('crm_calls')
      .select('id, interaction_id')
      .eq('customer_id', customerId)
      .not('recording_url', 'is', null)
      .limit(40),
  ])

  const recordingByInteraction = new Map(
    (callsRes.data ?? [])
      .filter((c) => c.interaction_id)
      .map((c) => [c.interaction_id as string, c.id as string])
  )

  const events: TimelineEvent[] = [
    ...(invoicesRes.data ?? []).map((inv) => ({
      id: `inv-${inv.id}`,
      at: inv.created_at as string,
      kind: 'invoice' as const,
      text: `Invoice ${inv.invoice_number} issued`,
      amount: Number(inv.total_amount),
    })),
    ...(paymentsRes.data ?? []).map((p) => {
      const invoice = p.invoices as unknown as { invoice_number: string } | null
      return {
        id: `pay-${p.id}`,
        at: p.created_at as string,
        kind: 'payment' as const,
        text: `Payment received${invoice ? ` for ${invoice.invoice_number}` : ''} (${p.payment_method})`,
        amount: Number(p.amount),
      }
    }),
    ...(interactionsRes.data ?? []).map((i) => ({
      id: `int-${i.id}`,
      at: i.occurred_at as string,
      kind: i.type as InteractionType,
      text: i.content as string,
      recordingCallId: recordingByInteraction.get(i.id as string),
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 30)

  if (events.length === 0) return null

  return (
    <Card className="mt-8">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l border-border pl-5">
          {events.map((event) => {
            const Icon =
              event.kind === 'invoice'
                ? FileText
                : event.kind === 'payment'
                  ? IndianRupee
                  : INTERACTION_ICONS[event.kind]
            return (
              <li key={event.id} className="relative">
                <span className="absolute -left-[27px] flex size-4 items-center justify-center rounded-full border border-border bg-card">
                  <Icon className="size-2.5 text-primary" />
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm">{event.text}</p>
                  {event.amount !== undefined && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatRupees(event.amount)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(event.at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
                {event.recordingCallId && (
                  <audio
                    controls
                    preload="none"
                    src={`/api/telephony/recording/${event.recordingCallId}`}
                    className="mt-2 h-9 w-full max-w-md"
                  />
                )}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
