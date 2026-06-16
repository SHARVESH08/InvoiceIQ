import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listPurchaseOrders } from '@/lib/actions/purchase-orders'
import { formatRupees } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PoCardMobile } from './_components/po-card-mobile'

// ─────────────────────────────────────────────────────────────────────────────
// PurchaseOrdersPage — RSC, role-aware
// OEM sees outgoing POs (company_id = their company).
// Distributor sees incoming POs (distributor_company_id = their company).
// No 'use client' — company context resolved server-side from get_company_context().
// ─────────────────────────────────────────────────────────────────────────────

interface CompanyContext {
  company_id: string
  company_name: string
  company_type: string
  user_role: string
}

// Status badge color map — matches UI-SPEC Screen A exactly
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary">draft</Badge>
    case 'sent':
      return (
        <Badge variant="outline" className="text-blue-400 border-blue-500/30">
          sent
        </Badge>
      )
    case 'confirmed':
      return (
        <Badge className="bg-green-500/15 text-green-400 hover:bg-green-500/15">
          confirmed
        </Badge>
      )
    case 'rejected':
      return <Badge variant="destructive">rejected</Badge>
    case 'dispatched':
      return (
        <Badge className="bg-orange-500/15 text-orange-400 hover:bg-orange-500/15">
          dispatched
        </Badge>
      )
    case 'received':
      return (
        <Badge className="bg-green-500/15 text-green-400 hover:bg-green-500/15">
          received
        </Badge>
      )
    case 'partial':
      return (
        <Badge className="bg-orange-500/15 text-orange-400 hover:bg-orange-500/15">
          partial
        </Badge>
      )
    case 'cancelled':
      return <Badge variant="destructive">cancelled</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default async function PurchaseOrdersPage() {
  const supabase = await createClient()

  const { data: ctx } = await supabase.rpc('get_company_context')
  if (!ctx) redirect('/login')

  const companyCtx = ctx as CompanyContext
  const companyType = companyCtx.company_type

  const result = await listPurchaseOrders()
  const orders = 'error' in result ? [] : result.orders

  const isOEM = companyType === 'OEM'
  const isDistributor = companyType === 'Distributor'

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold leading-tight">Purchase Orders</h1>
          {isOEM && (
            <p className="text-sm text-muted-foreground mt-1">
              Outgoing orders to distributors
            </p>
          )}
          {isDistributor && (
            <p className="text-sm text-muted-foreground mt-1">
              Incoming orders from OEMs
            </p>
          )}
        </div>
        {isOEM && (
          <Button asChild>
            <Link href="/dashboard/purchase-orders/new">
              Create Purchase Order
            </Link>
          </Button>
        )}
      </div>

      {/* PO list table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>{isDistributor ? 'OEM' : 'Distributor'}</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="py-12 text-center">
                    {isDistributor ? (
                      <>
                        <p className="font-medium text-sm">No incoming orders</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Purchase orders from OEMs will appear here.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-sm">
                          No purchase orders yet
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Create your first PO to send to a distributor.
                        </p>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/purchase-orders/${order.id}`}
                      className="block w-full"
                    >
                      {order.po_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/purchase-orders/${order.id}`}
                      className="block w-full text-muted-foreground"
                    >
                      {/* Company name resolved on detail page; list uses PO number + status */}
                      —
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/purchase-orders/${order.id}`}
                      className="block w-full text-sm"
                    >
                      {new Date(order.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/purchase-orders/${order.id}`}
                      className="block w-full text-sm"
                    >
                      {order.purchase_order_items?.length ?? 0}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/purchase-orders/${order.id}`}
                      className="block w-full text-sm"
                    >
                      {formatRupees(order.total_amount)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/purchase-orders/${order.id}`}
                      className="block w-full"
                    >
                      <StatusBadge status={order.status} />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/purchase-orders/${order.id}`}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      View →
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="block md:hidden space-y-2">
        {orders.map((order) => (
          <PoCardMobile key={order.id} order={order} />
        ))}
      </div>
    </div>
  )
}
