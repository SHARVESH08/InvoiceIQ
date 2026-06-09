'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { InvoiceTotalsFooter } from '@/components/invoices/invoice-totals'
import { RecordPaymentDialog } from '@/components/invoices/record-payment-dialog'
import { markAsSent, cancelInvoice } from '@/lib/actions/invoices'
import type { TaxType } from '@/components/invoices/tax-badge'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvoiceItem {
  id: string
  description: string
  hsn_code: string | null
  quantity: number
  unit_price: number
  discount_percent: number
  tax_rate: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
}

interface Payment {
  id: string
  amount: number
  payment_method: string
  payment_date: string
  reference_number: string | null
}

interface Customer {
  id: string
  name: string
  gstin: string | null
  phone: string | null
  email: string | null
  state_code: string | null
}

interface Supplier {
  id: string
  name: string
}

export interface InvoiceWithRelations {
  id: string
  invoice_number: string | null
  doc_type: 'sale' | 'purchase' | 'credit_note' | 'debit_note'
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  invoice_date: string
  due_date: string | null
  notes: string | null
  subtotal: number
  discount_amount: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  paid_amount: number
  pdf_url: string | null
  payment_link_url: string | null
  customers: Customer | Customer[] | null
  suppliers: Supplier | Supplier[] | null
  invoice_items: InvoiceItem[]
  payments: Payment[]
}

interface InvoiceDetailProps {
  invoice: InvoiceWithRelations
  sellerStateCode: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const DOC_TYPE_LABELS: Record<string, string> = {
  sale: 'Sale Invoice',
  purchase: 'Purchase Invoice',
  credit_note: 'Credit Note',
  debit_note: 'Debit Note',
}

// ─── InvoiceDetail ────────────────────────────────────────────────────────────

export function InvoiceDetail({ invoice, sellerStateCode: _sellerStateCode }: InvoiceDetailProps) {
  const router = useRouter()

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [isActioning, setIsActioning] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  // Normalise Supabase join returns (object | array | null) → single value or null
  const customer: Customer | null = invoice.customers
    ? Array.isArray(invoice.customers)
      ? invoice.customers[0] ?? null
      : invoice.customers
    : null

  const supplier: Supplier | null = invoice.suppliers
    ? Array.isArray(invoice.suppliers)
      ? invoice.suppliers[0] ?? null
      : invoice.suppliers
    : null

  const partyName = customer?.name ?? supplier?.name ?? '—'
  const docTypeLabel = DOC_TYPE_LABELS[invoice.doc_type] ?? invoice.doc_type
  const customerEmail = customer?.email ?? null

  // Tax type from stored amounts — cgst > 0 means intra-state was used
  const taxType: TaxType = invoice.cgst_amount > 0 ? 'intra' : 'inter'

  // Outstanding = total - paid
  const outstandingAmount = Number(invoice.total_amount) - Number(invoice.paid_amount)

  async function handleMarkAsSent() {
    setIsActioning(true)
    try {
      const result = await markAsSent(invoice.id)
      if ('error' in result) {
        toast.error(result.error)
        setIsActioning(false)
        return
      }
      if (result.emailFailed) {
        toast.warning('Invoice sent. Email delivery failed — share the invoice link manually.')
      } else {
        const target = customerEmail ?? 'the customer'
        toast.success(`Invoice sent. Payment link emailed to ${target}.`)
      }
      router.refresh()
    } catch {
      toast.error('Failed to send invoice. Please try again.')
      setIsActioning(false)
    }
  }

  async function handleCancelInvoice() {
    setIsCancelling(true)
    try {
      const result = await cancelInvoice(invoice.id)
      if (result?.error) {
        toast.error(result.error)
        setIsCancelling(false)
        setCancelOpen(false)
        return
      }
      // On success cancelInvoice redirects server-side
      router.refresh()
      setCancelOpen(false)
    } catch {
      setIsCancelling(false)
      setCancelOpen(false)
    }
  }

  return (
    <main className="flex-1 p-6 max-w-5xl mx-auto">
      {/* Back link */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/invoices">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Invoices
          </Link>
        </Button>

        {/* Header: invoice number + status + actions */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {invoice.invoice_number ?? 'Draft Invoice'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {docTypeLabel} · {formatDate(invoice.invoice_date)}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <InvoiceStatusBadge status={invoice.status} />

            {/* Status-conditional action buttons per D-10 */}
            {invoice.status === 'draft' && (
              <>
                <Button onClick={handleMarkAsSent} disabled={isActioning} size="sm">
                  {isActioning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending…
                    </>
                  ) : (
                    'Send Invoice'
                  )}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/invoices/${invoice.id}/edit`}>Edit</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel Invoice
                </Button>
              </>
            )}

            {invoice.status === 'sent' && (
              <>
                <Button size="sm" onClick={() => setPaymentOpen(true)} disabled={isActioning}>
                  Record Payment
                </Button>
                {invoice.pdf_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/invoices/${invoice.id}/credit-note`}>Credit Note</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/invoices/${invoice.id}/debit-note`}>Debit Note</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel Invoice
                </Button>
              </>
            )}

            {invoice.status === 'paid' && (
              <>
                {invoice.pdf_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </a>
                  </Button>
                )}
                <p className="text-sm text-muted-foreground italic">Paid</p>
              </>
            )}

            {invoice.status === 'overdue' && (
              <>
                <Button size="sm" onClick={() => setPaymentOpen(true)} disabled={isActioning}>
                  Record Payment
                </Button>
                {invoice.pdf_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel Invoice
                </Button>
              </>
            )}

            {invoice.status === 'cancelled' && (
              <>
                {invoice.pdf_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </a>
                  </Button>
                )}
                <p className="text-sm text-muted-foreground italic">Cancelled</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Metadata Card */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {customer ? 'Customer' : 'Supplier'}
              </p>
              <p className="text-sm font-medium">{partyName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Invoice Date</p>
              <p className="text-sm">{formatDate(invoice.invoice_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due Date</p>
              <p className="text-sm">
                {invoice.due_date ? formatDate(invoice.due_date) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tax Type</p>
              <p className="text-sm">
                {invoice.cgst_amount > 0 ? 'CGST + SGST' : 'IGST'}
              </p>
            </div>
            {invoice.notes && (
              <div className="col-span-full">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm">{invoice.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Line Items — read-only */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base font-bold">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead className="min-w-[160px]">Description</TableHead>
                  <TableHead className="w-24">HSN</TableHead>
                  <TableHead className="w-20 text-right">Qty</TableHead>
                  <TableHead className="w-28 text-right">Rate (₹)</TableHead>
                  <TableHead className="w-20 text-right">Disc %</TableHead>
                  <TableHead className="w-20 text-right">Tax %</TableHead>
                  <TableHead className="w-28 text-right">Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.invoice_items.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center text-muted-foreground text-sm">
                      {index + 1}
                    </TableCell>
                    <TableCell className="text-sm">{item.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.hsn_code ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                    <TableCell className="text-right text-sm">
                      ₹{Number(item.unit_price).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {Number(item.discount_percent).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {Number(item.tax_rate).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      ₹{Number(item.total_amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <InvoiceTotalsFooter
            totals={{
              subtotal: Number(invoice.subtotal),
              discount_amount: Number(invoice.discount_amount),
              taxable_amount: Number(invoice.taxable_amount),
              cgst_amount: Number(invoice.cgst_amount),
              sgst_amount: Number(invoice.sgst_amount),
              igst_amount: Number(invoice.igst_amount),
              total_amount: Number(invoice.total_amount),
            }}
            taxType={taxType}
          />
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoice_number}
        outstandingAmount={outstandingAmount > 0 ? outstandingAmount : 0}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />

      {/* Cancel Invoice Confirmation Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Invoice?</DialogTitle>
            <DialogDescription>
              This will cancel Invoice {invoice.invoice_number ?? 'Draft'}. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep Invoice
            </Button>
            <Button
              variant="destructive"
              disabled={isCancelling}
              onClick={handleCancelInvoice}
            >
              {isCancelling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cancel Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
