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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deleteProduct } from '@/lib/actions/products'
import { ProductCardMobile } from './product-card-mobile'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string
  name: string
  hsn_code: string | null
  category: string | null
  unit: string
  selling_price: number
  tax_rate: number
  purchase_price: number
  reorder_level: number
  description: string | null
  company_id: string
  created_at: string
  updated_at: string
}

interface ProductsTableProps {
  products: Product[]
  total: number
  page: number
  categories: string[]
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
export function ProductsTable({
  products,
  total,
  page,
  categories,
}: ProductsTableProps) {
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
    const imported = searchParams.get('imported')

    if (created === '1') {
      toast.success('Product created successfully')
      router.replace('/products')
    } else if (updated === '1') {
      toast.success('Product updated successfully')
      router.replace('/products')
    } else if (deleted === '1') {
      toast.success('Product deleted')
      router.replace('/products')
    } else if (imported !== null) {
      toast.success(`${imported} products imported successfully`)
      router.replace('/products')
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

  // ── Category filter ──────────────────────────────────────────────────────
  function handleCategoryChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== '__all__') {
      params.set('category', value)
    } else {
      params.delete('category')
    }
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}`)
  }

  // ── Pagination ───────────────────────────────────────────────────────────
  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    router.replace(`${pathname}?${params.toString()}`)
  }

  const start = total === 0 ? 0 : (page - 1) * 25 + 1
  const end = Math.min(page * 25, total)
  const hasMore = products.length === 25

  // ── Delete handler ───────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteId) return
    setIsDeleting(true)
    const result = await deleteProduct(deleteId)
    setIsDeleting(false)
    if (result?.error) {
      toast.error('Failed to delete product. Please try again.')
      setDeleteId(null)
      return
    }
    // deleteProduct redirects server-side on success — client code after this
    // line is unreachable on success; error case handled above.
  }

  const currentCategory = searchParams.get('category') ?? ''

  return (
    <main className="flex-1 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/products/import">Import Products</Link>
          </Button>
          <Button asChild>
            <Link href="/products/new">Add Product</Link>
          </Button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-2 mb-4">
        <Input
          placeholder="Search products…"
          className="max-w-xs"
          defaultValue={searchParams.get('q') ?? ''}
          onChange={(e) => handleSearchRef.current(e.target.value)}
        />
        <Select
          value={currentCategory || '__all__'}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table or empty state */}
      {products.length === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <h2 className="text-lg font-semibold mb-1">No products yet</h2>
          <p className="text-sm text-muted-foreground">
            Add your first product to start creating invoices.
          </p>
        </div>
      ) : (
        <>
        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="flex-1">Name</TableHead>
                <TableHead className="w-24">HSN</TableHead>
                <TableHead className="w-32">Category</TableHead>
                <TableHead className="w-20">Unit</TableHead>
                <TableHead className="w-28 text-right">Selling Price</TableHead>
                <TableHead className="w-20 text-right">Tax Rate</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.hsn_code ?? '—'}</TableCell>
                  <TableCell>{product.category ?? '—'}</TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell className="text-right">
                    ₹{Number(product.selling_price).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {product.tax_rate}%
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/products/${product.id}/edit`}>Edit</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(product.id)}
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
          {products.map((product) => (
            <ProductCardMobile key={product.id} product={product} />
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
      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete product?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={isDeleting}
            >
              Keep product
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete Product'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
