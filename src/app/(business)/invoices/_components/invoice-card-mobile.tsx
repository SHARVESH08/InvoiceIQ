'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'

interface Invoice {
  id: string
  invoice_number: string | null
  invoice_date: string
  due_date: string | null
  doc_type: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  total_amount: number
  paid_amount: number
  customer_id: string | null
  supplier_id: string | null
  customers: { name: string } | { name: string }[] | null
  suppliers: { name: string } | { name: string }[] | null
}

interface InvoiceCardMobileProps {
  inv: Invoice
}

export function InvoiceCardMobile({ inv }: InvoiceCardMobileProps) {
  const customerName =
    (Array.isArray(inv.customers) ? inv.customers[0]?.name : inv.customers?.name) ??
    (Array.isArray(inv.suppliers) ? inv.suppliers[0]?.name : inv.suppliers?.name) ??
    '—'

  return (
    <Link href={`/invoices/${inv.id}`}>
      <Card className="px-4 py-3 cursor-pointer active:bg-secondary min-h-[64px] active:scale-[0.99] transition-transform">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">{customerName}</span>
          <span className="text-sm font-semibold">₹{Number(inv.total_amount).toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">{inv.invoice_number ?? '—'}</span>
          <InvoiceStatusBadge status={inv.status} />
        </div>
      </Card>
    </Link>
  )
}
