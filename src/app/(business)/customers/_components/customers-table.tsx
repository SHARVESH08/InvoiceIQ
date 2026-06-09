'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deleteCustomer } from '@/lib/actions/customers'
import { CustomerCardMobile } from './customer-card-mobile'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  id: string
  name: string
  customer_type: string
  gstin: string | null
  phone: string | null
  email: string | null
  state_code: string | null
  credit_limit: number
  billing_address: { street: string; city: string; pincode: string } | null
  shipping_address: { street: string; city: string; pincode: string } | null
  customer_profile_id: string | null
  company_id: string
  created_at: string
  updated_at: string
}

interface CustomersTableProps {
  customers: Customer[]
  total: number
  page: number
  balanceMap: Record<string, number>
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

// ─── Component ────────────────────────────────────────────────────────────────
export function CustomersTable({
  customers,
  total,
  page,
  balanceMap,
}: CustomersTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Delete dialog state
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ── Toast-on-arrival effect ──────────────────────────────────────────────
  useEffect(() => {
    const created = searchParams.get('created')
    const updated = searchParams.get('updated')
    const deleted = searchParams.get('deleted')

    if (created === '1') {
      toast.success('Customer created successfully')
      router.replace('/customers')
    } else if (updated === '1') {
      toast.success('Customer updated successfully')
      router.replace('/customers')
    } else if (deleted === '1') {
      toast.success('Customer deleted')
      router.replace('/customers')
    }
  }, [searchParams, router])

  // ── Search (debounced 300ms) ─────────────────────────────────────────────
  const handleSearchRef = useRef(
    debounce((value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('q', value)
      } else {
        params.delete('q')
      }
      params.delete('page')
      router.replace(`${pathname}?${params.toString()}`)
    }, 300)
  )

  // ── Pagination ───────────────────────────────────────────────────────────
  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    router.replace(`${pathname}?${params.toString()}`)
  }

  const start = total === 0 ? 0 : (page - 1) * 25 + 1
  const end = Math.min(page * 25, total)
  const hasMore = customers.length === 25

  // ── Delete handler ───────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteId) return
    setIsDeleting(true)
    const result = await deleteCustomer(deleteId)
    setIsDeleting(false)
    if (result?.error) {
      toast.error('Failed to delete customer. Please try again.')
      setDeleteId(null)
      return
    }
    // deleteCustomer redirects server-side on success — client code after this
    // line is unreachable on success; error case handled above.
  }

  return (
    <main className="flex-1 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/customers/new">Add Customer</Link>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <Input
          placeholder="Search customers…"
          className="max-w-xs"
          defaultValue={searchParams.get('q') ?? ''}
          onChange={(e) => handleSearchRef.current(e.target.value)}
        />
      </div>

      {/* Table or empty state */}
      {customers.length === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <h2 className="text-lg font-semibold mb-1">No customers yet</h2>
          <p className="text-sm text-muted-foreground">
            Add your first customer to start creating invoices.
          </p>
        </div>
      ) : (
        <>
        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="flex-1">Name</TableHead>
                <TableHead className="w-16">Type</TableHead>
                <TableHead className="w-32">Phone</TableHead>
                <TableHead className="w-20">State</TableHead>
                <TableHead className="w-28 text-right">Outstanding</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>
                    {customer.customer_type === 'b2b' ? (
                      <Badge>B2B</Badge>
                    ) : (
                      <Badge variant="secondary">B2C</Badge>
                    )}
                  </TableCell>
                  <TableCell>{customer.phone ?? '—'}</TableCell>
                  <TableCell>{customer.state_code ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    ₹{(balanceMap[customer.id] ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/customers/${customer.id}/edit`}>Edit</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(customer.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="block md:hidden space-y-2">
          {customers.map((customer) => (
            <CustomerCardMobile key={customer.id} customer={customer} />
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

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete customer?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={isDeleting}
            >
              Keep customer
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete Customer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
