import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatRupees } from '@/lib/format'

interface PurchaseOrder {
  id: string
  company_id: string
  distributor_company_id: string | null
  supplier_id: string | null
  po_number: string
  status: string
  total_amount: number
  expected_delivery: string | null
  created_at: string
  updated_at: string
  notes: string | null
}

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

interface PoCardMobileProps {
  order: PurchaseOrder
}

export function PoCardMobile({ order }: PoCardMobileProps) {
  return (
    <Link href={`/dashboard/purchase-orders/${order.id}`}>
      <Card className="px-4 py-3 cursor-pointer min-h-[64px]">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">{order.po_number ?? '—'}</span>
          <span className="text-sm font-semibold">{formatRupees(order.total_amount)}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {new Date(order.created_at).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          <StatusBadge status={order.status} />
        </div>
      </Card>
    </Link>
  )
}
