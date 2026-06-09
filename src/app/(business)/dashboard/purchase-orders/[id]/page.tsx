'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  confirmPO,
  dispatchPO,
  receivePO,
  rejectPO,
  getPurchaseOrder,
  type PurchaseOrderDetail,
} from '@/lib/actions/purchase-orders'
import { formatRupees } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ─────────────────────────────────────────────────────────────────────────────
// PO Detail page — Client Component (hybrid approach)
// Fetches PO and company context client-side using server actions + supabase client.
// Realtime subscription on purchase_orders table — router.refresh() on relevant changes.
// ─────────────────────────────────────────────────────────────────────────────

// Status badge color map — same as list page (Screen A)
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary">draft</Badge>
    case 'sent':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300">
          sent
        </Badge>
      )
    case 'confirmed':
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          confirmed
        </Badge>
      )
    case 'rejected':
      return <Badge variant="destructive">rejected</Badge>
    case 'dispatched':
      return (
        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
          dispatched
        </Badge>
      )
    case 'received':
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          received
        </Badge>
      )
    case 'partial':
      return (
        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
          partial
        </Badge>
      )
    case 'cancelled':
      return <Badge variant="destructive">cancelled</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

interface CompanyContext {
  company_id: string
  company_name: string
  company_type: string
  user_role: string
}

interface GodownRow {
  id: string
}

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const poId = params.id

  // Data state
  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null)
  const [companyCtx, setCompanyCtx] = useState<CompanyContext | null>(null)
  const [defaultGodownId, setDefaultGodownId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Action state
  const [actionLoading, setActionLoading] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // Load PO data + company context
  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const supabase = createClient()

        const [poResult, { data: ctx }] = await Promise.all([
          getPurchaseOrder(poId),
          supabase.rpc('get_company_context'),
        ])

        if ('error' in poResult) {
          setLoadError(poResult.error)
          return
        }

        const ctxTyped = ctx as CompanyContext | null
        setOrder(poResult.order)
        setCompanyCtx(ctxTyped)

        // Fetch default godown for Distributor's receivePO call
        if (ctxTyped?.company_type === 'Distributor' && ctxTyped.company_id) {
          const { data: godown } = await supabase
            .from('godowns')
            .select('id')
            .eq('company_id', ctxTyped.company_id)
            .eq('is_default', true)
            .maybeSingle<GodownRow>()
          setDefaultGodownId(godown?.id ?? null)
        }
      } catch {
        setLoadError('Failed to load purchase order.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [poId])

  // Realtime subscription — refresh on relevant purchase_orders changes
  useEffect(() => {
    if (!companyCtx?.company_id) return

    const supabase = createClient()
    const companyId = companyCtx.company_id

    const channel = supabase
      .channel(`po-realtime-${companyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_orders' },
        (payload) => {
          const newRow = payload.new as {
            company_id?: string
            distributor_company_id?: string
            id?: string
          } | null
          const isRelevant =
            newRow?.company_id === companyId ||
            newRow?.distributor_company_id === companyId
          if (!isRelevant) return
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyCtx?.company_id, router])

  // Action handlers
  async function handleConfirm() {
    setActionLoading(true)
    try {
      const result = await confirmPO(poId)
      if ('error' in result) {
        toast.error('Action failed. Please try again.')
      } else {
        toast.success('Order confirmed. OEM has been notified.')
        router.refresh()
      }
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRejectConfirm() {
    setActionLoading(true)
    try {
      const result = await rejectPO(poId, rejectReason || undefined)
      if ('error' in result) {
        toast.error('Action failed. Please try again.')
      } else {
        toast.success('Order rejected.')
        setRejecting(false)
        setRejectReason('')
        router.refresh()
      }
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDispatch() {
    setActionLoading(true)
    try {
      const result = await dispatchPO(poId)
      if ('error' in result) {
        toast.error('Action failed. Please try again.')
      } else {
        toast.success(`Dispatched — Invoice ${result.invoiceNumber} created`)
        router.refresh()
      }
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReceive() {
    if (!defaultGodownId) {
      toast.error(
        'No default godown found. Please create a godown in Settings first.'
      )
      return
    }
    setActionLoading(true)
    try {
      const result = await receivePO(poId, defaultGodownId)
      if ('error' in result) {
        toast.error('Action failed. Please try again.')
      } else {
        toast.success(
          `Received — Purchase invoice ${result.invoiceNumber} created and inventory updated`
        )
        router.refresh()
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Loading / error states
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError || !order || !companyCtx) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/purchase-orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Purchase Orders
        </Link>
        <p className="text-sm text-destructive">
          {loadError ?? 'Purchase order not found.'}
        </p>
      </div>
    )
  }

  const companyType = companyCtx.company_type
  const status = order.status

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/purchase-orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Purchase Orders
      </Link>

      {/* Page heading with status badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold leading-tight">{order.po_number}</h1>
        <StatusBadge status={status} />
      </div>

      {/* Detail card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">OEM</p>
                <p className="text-sm font-medium">
                  {companyType === 'OEM'
                    ? companyCtx.company_name
                    : 'See PO details'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Distributor</p>
                <p className="text-sm font-medium">
                  {companyType === 'Distributor'
                    ? companyCtx.company_name
                    : 'See PO details'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">
                  {new Date(order.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              {order.expected_delivery && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    Expected delivery
                  </p>
                  <p className="text-sm">
                    {new Date(order.expected_delivery).toLocaleDateString(
                      'en-IN',
                      { day: '2-digit', month: 'short', year: 'numeric' }
                    )}
                  </p>
                </div>
              )}
              {order.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm">{order.notes}</p>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Total amount</p>
                <p className="text-2xl font-bold">
                  {formatRupees(order.total_amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge status={status} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line items table */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>HSN</TableHead>
                  <TableHead className="text-right">Qty Ordered</TableHead>
                  <TableHead className="text-right">Qty Received</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.purchase_order_items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.products?.name ?? item.product_id}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.products?.hsn_code ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity_ordered}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity_received != null && item.quantity_received > 0
                        ? item.quantity_received
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupees(item.unit_price)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatRupees(item.total_amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Contextual action card */}
      {/* Rendered based on companyType + status per UI-SPEC Screen C */}
      {(() => {
        // OEM actions
        if (companyType === 'OEM') {
          if (status === 'draft') {
            return (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Button variant="outline" disabled={actionLoading} asChild>
                      <Link href={`/dashboard/purchase-orders/${poId}/edit`}>
                        Edit PO
                      </Link>
                    </Button>
                    <Button variant="default" disabled={actionLoading}>
                      {actionLoading && (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Send to Distributor
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (status === 'confirmed') {
            return (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <Button
                      variant="default"
                      className="min-h-[44px]"
                      onClick={handleDispatch}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Mark Dispatched
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      This will auto-generate a sale invoice.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          // OEM: read-only statuses
          if (['sent', 'rejected', 'dispatched', 'received', 'cancelled'].includes(status)) {
            return (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    {status === 'sent' && 'Awaiting distributor confirmation.'}
                    {status === 'rejected' && 'This order was rejected by the distributor.'}
                    {status === 'dispatched' && 'Order dispatched. Awaiting receipt confirmation.'}
                    {status === 'received' && 'Order received by distributor.'}
                    {status === 'cancelled' && 'This order has been cancelled.'}
                  </p>
                </CardContent>
              </Card>
            )
          }
        }

        // Distributor actions
        if (companyType === 'Distributor') {
          if (status === 'sent') {
            return (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {!rejecting ? (
                    <div className="flex items-center gap-3">
                      <Button
                        variant="default"
                        onClick={handleConfirm}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Confirm Order
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setRejecting(true)}
                        disabled={actionLoading}
                      >
                        Reject Order
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Reason for rejection (optional)"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="max-w-md"
                        disabled={actionLoading}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          variant="destructive"
                          onClick={handleRejectConfirm}
                          disabled={actionLoading}
                        >
                          {actionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Confirm Rejection
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setRejecting(false)
                            setRejectReason('')
                          }}
                          disabled={actionLoading}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (status === 'dispatched') {
            return (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <Button
                      variant="default"
                      className="min-h-[44px]"
                      onClick={handleReceive}
                      disabled={actionLoading || !defaultGodownId}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Mark Received
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      This will create a purchase invoice and update your
                      inventory.
                    </p>
                    {!defaultGodownId && (
                      <p className="text-xs text-destructive">
                        No default godown found. Please create one in Settings.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          }
        }

        return null
      })()}

    </div>
  )
}
