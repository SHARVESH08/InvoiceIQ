'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

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
import { deleteSupplier } from '@/lib/actions/suppliers'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Supplier {
  id: string
  name: string
  gstin: string | null
  phone: string | null
  email: string | null
  state_code: string | null
  address: { street: string; city: string; pincode: string } | null
  company_id: string
  created_at: string
  updated_at: string
}

interface SuppliersTableProps {
  suppliers: Supplier[]
  total: number
  page: number
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
export function SuppliersTable({ suppliers, total, page }: SuppliersTableProps) {
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

    if (created === '1') {
      toast.success('Supplier created successfully')
      router.replace('/suppliers')
    } else if (updated === '1') {
      toast.success('Supplier updated successfully')
      router.replace('/suppliers')
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
  const hasMore = suppliers.length === 25

  // ── Delete handler ───────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteId) return
    setIsDeleting(true)
    const result = await deleteSupplier(deleteId)
    setIsDeleting(false)
    if ('error' in result) {
      toast.error('Failed to delete supplier. Please try again.')
      return
    }
    setDeleteId(null)
    toast.success('Supplier deleted')
    router.refresh()
  }

  return (
    <main className="flex-1 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/suppliers/new">Add Supplier</Link>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <Input
          placeholder="Search suppliers…"
          className="max-w-xs"
          defaultValue={searchParams.get('q') ?? ''}
          onChange={(e) => handleSearchRef.current(e.target.value)}
        />
      </div>

      {/* Table or empty state */}
      {suppliers.length === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <h2 className="text-lg font-semibold mb-1">No suppliers yet</h2>
          <p className="text-sm text-muted-foreground">
            Add your first supplier to create purchase invoices.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="flex-1">Name</TableHead>
                <TableHead className="w-40">GSTIN</TableHead>
                <TableHead className="w-32">Phone</TableHead>
                <TableHead className="w-20">State</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.gstin ?? '—'}</TableCell>
                  <TableCell>{supplier.phone ?? '—'}</TableCell>
                  <TableCell>{supplier.state_code ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/suppliers/${supplier.id}/edit`}>Edit</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(supplier.id)}
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
            <DialogTitle>Delete supplier?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={isDeleting}
            >
              Keep supplier
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete Supplier'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
