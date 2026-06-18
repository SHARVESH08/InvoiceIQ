'use client'

import Link from 'next/link'
import { Download, ExternalLink } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatRupees } from '@/lib/format'

interface InvoiceRow {
  id: string
  public_id: string
  invoice_date: string
  invoice_number: string | null
  total_amount: number
  status: string
  payment_status: string
  payment_link_url: string | null
  companies: { name: string } | { name: string }[] | null
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
  cancelled: 'Cancelled',
  sent: 'Sent',
}

interface Props {
  invoices: InvoiceRow[]
  total: number
  page: number
}

const STATUS_CLASSES: Record<string, string> = {
  paid: 'bg-green-500/15 text-green-400',
  partial: 'bg-amber-500/15 text-amber-400',
  unpaid: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-muted text-muted-foreground border-border',
  sent: 'bg-blue-500/15 text-blue-400',
}

export function CustomerInvoiceTable({ invoices, total, page }: Props) {
  const pageSize = 20
  const totalPages = Math.ceil(total / pageSize)

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-semibold">No invoices yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Invoices sent to your email address will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const businessName = Array.isArray(invoice.companies)
                ? invoice.companies[0]?.name ?? 'Unknown'
                : invoice.companies?.name ?? 'Unknown'

              // A cancelled invoice is void — show its status, not the stale
              // payment_status (which stays 'unpaid'/'partial' after cancelling).
              const isCancelled = invoice.status === 'cancelled'
              const displayStatus = isCancelled ? 'cancelled' : invoice.payment_status

              return (
                <TableRow key={invoice.id}>
                  <TableCell>
                    {new Date(invoice.invoice_date).toLocaleDateString('en-IN')}
                  </TableCell>
                  <TableCell>{businessName}</TableCell>
                  <TableCell>{formatRupees(invoice.total_amount)}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        STATUS_CLASSES[displayStatus] ??
                        'bg-muted text-muted-foreground border-border'
                      }
                    >
                      {STATUS_LABELS[displayStatus] ?? displayStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/invoice/${invoice.public_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Download size={16} />
                        Download PDF
                      </a>
                      {invoice.payment_link_url &&
                        invoice.payment_status !== 'paid' &&
                        !isCancelled && (
                          <a
                            href={invoice.payment_link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <ExternalLink size={16} />
                            Pay Now
                          </a>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} asChild>
              <Link href={`?page=${page - 1}`} aria-label="Previous page">
                Prev
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * pageSize >= total}
              asChild
            >
              <Link href={`?page=${page + 1}`} aria-label="Next page">
                Next
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
