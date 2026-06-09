import { createAdminClient } from '@/lib/supabase/admin'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { rupeesToWords } from '@/lib/pdf/number-to-words'
import { Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ─── Types ────────────────────────────────────────────────────────────────────

type PublicInvoiceItem = {
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

type PublicInvoice = {
  public_id: string
  invoice_number: string | null
  invoice_date: string
  due_date: string | null
  doc_type: 'sale' | 'purchase' | 'credit_note' | 'debit_note'
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  subtotal: number
  discount_amount: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  customer_email: string | null
  pdf_url: string | null
  payment_link_url: string | null
  invoice_items: PublicInvoiceItem[]
  customers: { name: string } | null
  companies:
    | { name: string; gstin: string | null; address: string | null }
    | { name: string; gstin: string | null; address: string | null }[]
    | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const formatINR = (n: number) =>
  `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: { public_id: string } }) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('public_id', params.public_id)
    .single()
  return {
    title: data?.invoice_number ? `Invoice ${data.invoice_number}` : 'Invoice',
    robots: 'noindex',
  }
}

// ─── Not-found block ──────────────────────────────────────────────────────────

function NotFound() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-lg font-semibold">Invoice not found</p>
        <p className="text-sm text-muted-foreground">
          This link may be invalid or the invoice has been removed.
        </p>
      </div>
    </main>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicInvoicePage({ params }: { params: { public_id: string } }) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('invoices')
    .select(
      `public_id, invoice_number, invoice_date, due_date, doc_type, status,
       subtotal, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount,
       customer_email,
       pdf_url, payment_link_url,
       customers(name),
       invoice_items(description, hsn_code, quantity, unit_price, discount_percent, tax_rate, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount),
       companies(name, gstin, address)`
    )
    .eq('public_id', params.public_id)
    .single()

  if (error || !data) {
    return <NotFound />
  }

  const invoice = data as unknown as PublicInvoice
  const company = Array.isArray(invoice.companies)
    ? invoice.companies[0] ?? null
    : invoice.companies

  if (!company) {
    return <NotFound />
  }

  const companyInitials =
    company.name
      .split(' ')
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() ?? '')
      .join('') || company.name.slice(0, 2).toUpperCase()

  const taxType: 'intra' | 'inter' = invoice.cgst_amount > 0 ? 'intra' : 'inter'
  const totalInWords = rupeesToWords(Math.round(Number(invoice.total_amount) * 100))

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* [A] Page header bar */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-5 border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {companyInitials}
            </div>
            <div>
              <p className="text-base font-semibold">{company.name}</p>
              {company.gstin && (
                <p className="text-xs text-muted-foreground">GSTIN: {company.gstin}</p>
              )}
              {company.address && (
                <p className="text-xs text-muted-foreground">{company.address}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tax Invoice
            </p>
            <p className="text-xl font-bold">{invoice.invoice_number ?? 'Draft Invoice'}</p>
          </div>
        </div>

        {/* [B] Invoice meta card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Invoice Date</p>
                <p className="text-sm font-medium">{formatDate(invoice.invoice_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="text-sm font-medium">
                  {invoice.due_date ? formatDate(invoice.due_date) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <InvoiceStatusBadge status={invoice.status} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tax Type</p>
                <p className="text-sm font-medium">
                  {taxType === 'intra' ? 'CGST + SGST' : 'IGST'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* [C] Parties card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Bill From
                </p>
                <p className="text-sm font-semibold">{company.name}</p>
                {company.gstin && (
                  <p className="text-xs text-muted-foreground">GSTIN: {company.gstin}</p>
                )}
                {company.address && (
                  <p className="text-xs text-muted-foreground">{company.address}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Bill To
                </p>
                <p className="text-sm font-semibold">{invoice.customers?.name ?? '—'}</p>
                {invoice.customer_email && (
                  <p className="text-xs text-muted-foreground">{invoice.customer_email}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* [D] Line items card */}
        <Card>
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
                    <TableRow key={index}>
                      <TableCell className="text-center text-muted-foreground text-sm">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-sm">{item.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.hsn_code ?? '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatINR(Number(item.unit_price))}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {Number(item.discount_percent).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {Number(item.tax_rate).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatINR(Number(item.total_amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* [E] Tax summary card — rendered inline; InvoiceTotalsFooter is a client component so we replicate the layout here */}
        <Card>
          <CardContent className="pt-6">
            <div className="max-w-sm ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatINR(Number(invoice.subtotal))}</span>
              </div>
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">−{formatINR(Number(invoice.discount_amount))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxable Amount</span>
                <span>{formatINR(Number(invoice.taxable_amount))}</span>
              </div>
              {taxType === 'intra' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CGST</span>
                    <span>{formatINR(Number(invoice.cgst_amount))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">SGST</span>
                    <span>{formatINR(Number(invoice.sgst_amount))}</span>
                  </div>
                </>
              )}
              {taxType === 'inter' && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IGST</span>
                  <span>{formatINR(Number(invoice.igst_amount))}</span>
                </div>
              )}
              <div className="border-t pt-2">
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>{formatINR(Number(invoice.total_amount))}</span>
                </div>
              </div>
            </div>
            <p className="text-xs italic text-muted-foreground mt-1 text-right">{totalInWords}</p>
          </CardContent>
        </Card>

        {/* [F] Action buttons — status × pdf_url matrix */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          {(invoice.status === 'sent' || invoice.status === 'overdue') &&
            invoice.payment_link_url && (
              <a
                href={invoice.payment_link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-11 px-6 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Pay Now →
              </a>
            )}
          {invoice.pdf_url && invoice.status !== 'draft' && (
            <a
              href={`/api/invoice/${invoice.public_id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-11 px-6 rounded-md border border-input bg-background font-semibold text-sm hover:bg-muted transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </a>
          )}
        </div>

        {/* [G] Footer */}
        <p className="text-center text-xs text-muted-foreground pt-4 border-t">
          Powered by InvoiceIQ
        </p>

      </div>
    </main>
  )
}
