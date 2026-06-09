'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { InvoiceCardMobile } from './invoice-card-mobile'

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface InvoiceSearchParams {
  page?: string
  q?: string
  status?: string
  from_date?: string
  to_date?: string
}

interface InvoicesTableProps {
  invoices: Invoice[]
  total: number
  page: number
  searchParams: InvoiceSearchParams
}

// ─── Inline debounce ─────────────────────────────────────────────────────────
function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
}

// ─── Date formatter ───────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────
export function InvoicesTable({
  invoices,
  total,
  page,
  searchParams,
}: InvoicesTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const urlSearchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.q ?? '')
  const [statusFilter, setStatusFilter] = useState(searchParams.status ?? 'all')
  const [fromDate, setFromDate] = useState(searchParams.from_date ?? '')
  const [toDate, setToDate] = useState(searchParams.to_date ?? '')

  // ── Toast-on-arrival effect ──────────────────────────────────────────────
  useEffect(() => {
    const created = urlSearchParams.get('created')
    const sent = urlSearchParams.get('sent')
    const payment = urlSearchParams.get('payment')
    const deleted = urlSearchParams.get('deleted')
    const cancelled = urlSearchParams.get('cancelled')
    const updated = urlSearchParams.get('updated')

    if (created === '1') {
      toast.success('Invoice created')
      router.replace(pathname)
    } else if (sent === '1') {
      toast.success('Invoice sent')
      router.replace(pathname)
    } else if (payment === '1') {
      toast.success('Payment recorded')
      router.replace(pathname)
    } else if (deleted === '1') {
      toast.success('Invoice deleted')
      router.replace(pathname)
    } else if (cancelled === '1') {
      toast.success('Invoice cancelled')
      router.replace(pathname)
    } else if (updated === '1') {
      toast.success('Invoice updated')
      router.replace(pathname)
    }
  }, [urlSearchParams, router, pathname])

  // ── Search (debounced 300ms) ─────────────────────────────────────────────
  const handleSearchRef = useRef(
    debounce((value: string) => {
      const params = new URLSearchParams(urlSearchParams.toString())
      if (value) {
        params.set('q', value)
      } else {
        params.delete('q')
      }
      params.delete('page')
      router.replace(`${pathname}?${params.toString()}`)
    }, 300)
  )

  // ── Status filter ────────────────────────────────────────────────────────
  function handleStatusFilter(value: string) {
    const params = new URLSearchParams(urlSearchParams.toString())
    if (value && value !== 'all') {
      params.set('status', value)
    } else {
      params.delete('status')
    }
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}`)
  }

  // ── Date filter ──────────────────────────────────────────────────────────
  function handleDateFilter(from: string, to: string) {
    const params = new URLSearchParams(urlSearchParams.toString())
    if (from) {
      params.set('from_date', from)
    } else {
      params.delete('from_date')
    }
    if (to) {
      params.set('to_date', to)
    } else {
      params.delete('to_date')
    }
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}`)
  }

  // ── Pagination ───────────────────────────────────────────────────────────
  function goToPage(newPage: number) {
    const params = new URLSearchParams(urlSearchParams.toString())
    params.set('page', String(newPage))
    router.replace(`${pathname}?${params.toString()}`)
  }

  const start = total === 0 ? 0 : (page - 1) * 25 + 1
  const end = Math.min(page * 25, total)
  const hasMore = invoices.length === 25

  // ── Empty state detection ────────────────────────────────────────────────
  const hasActiveFilters = Boolean(
    searchParams.q ||
      searchParams.status ||
      searchParams.from_date ||
      searchParams.to_date
  )

  return (
    <main className="flex-1 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <Button asChild>
          <Link href="/invoices/new">
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Link>
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Input
          placeholder="Search invoices…"
          className="max-w-xs"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            handleSearchRef.current(e.target.value)
          }}
        />
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value)
            handleStatusFilter(value)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="w-40"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value)
            handleDateFilter(e.target.value, toDate)
          }}
        />
        <Input
          type="date"
          className="w-40"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value)
            handleDateFilter(fromDate, e.target.value)
          }}
        />
      </div>

      {/* Table or empty state */}
      {total === 0 ? (
        <div className="rounded-md border p-12 text-center">
          {hasActiveFilters ? (
            <p className="text-sm text-muted-foreground">
              No invoices match your filters. Try changing the status or date range.
            </p>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-1">No invoices yet</h2>
              <p className="text-sm text-muted-foreground">
                Create your first invoice to start billing customers.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Invoice #</TableHead>
                <TableHead>Customer / Supplier</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-28">Due Date</TableHead>
                <TableHead className="w-28 text-right">Amount</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-24 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm">
                    {inv.invoice_number ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(Array.isArray(inv.customers) ? inv.customers[0]?.name : inv.customers?.name) ??
                      (Array.isArray(inv.suppliers) ? inv.suppliers[0]?.name : inv.suppliers?.name) ??
                      '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(inv.invoice_date)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {inv.due_date ? (
                      formatDate(inv.due_date)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₹{Number(inv.total_amount).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/invoices/${inv.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="block md:hidden space-y-2">
          {invoices.map((inv) => (
            <InvoiceCardMobile key={inv.id} inv={inv} />
          ))}
        </div>
        </>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {start}–{end} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
