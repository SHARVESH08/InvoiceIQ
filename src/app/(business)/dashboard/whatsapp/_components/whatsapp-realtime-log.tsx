'use client'

import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRupees } from '@/lib/format'

// No server-side filter on postgres_changes: column filters silently drop
// subscriptions when Realtime can't resolve the filter (Phase 7/8 silent-drop bug).
// RLS scopes events to rows the user can SELECT.
// Client-side company_id guard in callback below is the additional check (D-13).

interface SessionRow {
  id: string
  customer_phone: string
  state: string
  cart: unknown
  expires_at: string | null
  created_at: string
  company_id: string
}

interface WhatsAppRealtimeLogProps {
  companyId: string
  initialRows: SessionRow[]
}

// Status badge mapping per UI-SPEC Copywriting + Color
const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  invoice_sent: { label: 'Order Placed', className: 'bg-green-500/15 text-green-400 hover:bg-green-500/15' },
  cart_review: { label: 'Confirming', className: 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/15' },
  item_selection: { label: 'Browsing', className: 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/15' },
  catalog_sent: { label: 'Started', className: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/15' },
  greeted: { label: 'Started', className: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/15' },
  idle: { label: 'Expired', className: 'bg-muted text-muted-foreground hover:bg-muted' },
}

function getStatusBadge(state: string) {
  return STATUS_BADGE[state] ?? { label: 'Expired', className: 'bg-muted text-muted-foreground hover:bg-muted' }
}

function formatTime(createdAt: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(createdAt))
}

type CartItem = { name?: string; quantity?: number; price?: number }

function formatCart(cart: unknown): string {
  if (!cart || !Array.isArray(cart)) return '—'
  const items = cart as CartItem[]
  if (items.length === 0) return '—'
  const first = items[0]?.name ?? 'Item'
  const truncated = first.length > 20 ? first.slice(0, 20) + '…' : first
  return items.length > 1 ? `${truncated} +${items.length - 1}` : truncated
}

function getCartTotal(cart: unknown): number {
  if (!cart || !Array.isArray(cart)) return 0
  const items = cart as CartItem[]
  return items.reduce((sum, item) => sum + ((item.price ?? 0) * (item.quantity ?? 1)), 0)
}

export function WhatsAppRealtimeLog({ companyId, initialRows }: WhatsAppRealtimeLogProps) {
  const [rows, setRows] = useState<SessionRow[]>(initialRows)
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`whatsapp-sessions-${companyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_sessions' },
        (payload) => {
          if (payload.new.company_id !== companyId) return  // client-side guard (D-13)
          // Prepend to local state — no router.refresh() needed (UI-SPEC Interaction Contract)
          setRows(prev => [payload.new as SessionRow, ...prev].slice(0, 50))
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [companyId])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-xl font-bold leading-tight">Incoming Orders</CardTitle>
          {/* Live pulse indicator per UI-SPEC Interaction Contract */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-muted-foreground">Live</span>
          <MessageCircle className="h-4 w-4" style={{ color: '#25D366' }} />
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-foreground">No orders yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Share your bot code with customers. Orders placed via WhatsApp will appear here live.
            </p>
          </div>
        ) : (
          <div aria-live="polite">
            <Table>
              <TableCaption className="sr-only">
                Incoming WhatsApp orders, newest first
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Items</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Total</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const badge = getStatusBadge(row.state)
                  return (
                    <TableRow key={row.id} className="min-h-[48px]">
                      <TableCell className="text-sm py-3">
                        {formatTime(row.created_at)}
                      </TableCell>
                      <TableCell className="text-sm py-3">
                        {row.customer_phone}
                      </TableCell>
                      <TableCell className="text-sm py-3 hidden md:table-cell">
                        {formatCart(row.cart)}
                      </TableCell>
                      <TableCell className="text-sm py-3 hidden md:table-cell">
                        {formatRupees(getCartTotal(row.cart))}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
