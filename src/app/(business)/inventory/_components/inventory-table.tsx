'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Package,
  CheckCircle,
  Plus,
  Loader2,
  X,
  ArrowLeftRight,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

import { SetStockLevelSchema, type SetStockLevelInput } from '@/lib/schemas/inventory'
import { setStockLevel } from '@/lib/actions/inventory'
import type { AggregatedInventoryRow, InventoryStatus } from '@/lib/actions/inventory'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GodownOption {
  id: string
  name: string
  is_default: boolean
}

interface ProductOption {
  id: string
  name: string
  unit: string
}

interface InventoryTableProps {
  rows: AggregatedInventoryRow[]
  godowns: GodownOption[]
  products: ProductOption[]
  searchParams: { q?: string; filter?: string; page?: string }
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

// ─── Status badge ─────────────────────────────────────────────────────────────

function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  if (status === 'out_of_stock') {
    return (
      <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30">
        Out of Stock
      </Badge>
    )
  }
  if (status === 'low_stock') {
    return (
      <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30">
        Low Stock
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-green-500/15 text-green-400 border-green-500/30">
      OK
    </Badge>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InventoryTable({
  rows,
  godowns,
  products,
  searchParams,
}: InventoryTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const urlSearchParams = useSearchParams()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<SetStockLevelInput>({
    resolver: zodResolver(SetStockLevelSchema),
    defaultValues: {
      product_id: '',
      godown_id: '',
      quantity: 0,
      reorder_level: 0,
    },
  })

  // ── Toast-on-arrival ─────────────────────────────────────────────────────
  useEffect(() => {
    const stockSet = urlSearchParams.get('stock_set')
    if (stockSet === '1') {
      toast.success('Stock level updated.')
      router.replace('/inventory')
    }
  }, [urlSearchParams, router])

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

  // ── Filter change ────────────────────────────────────────────────────────
  function handleFilterChange(value: string) {
    const params = new URLSearchParams(urlSearchParams.toString())
    if (value && value !== '__all__') {
      params.set('filter', value)
    } else {
      params.delete('filter')
    }
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}`)
  }

  function clearFilter() {
    const params = new URLSearchParams(urlSearchParams.toString())
    params.delete('filter')
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}`)
  }

  // ── Client-side search filter — applied BEFORE pagination so it matches
  //    across ALL products, not just the current page (bug fix). ────────────
  const q = searchParams.q?.toLowerCase().trim() ?? ''
  const searchedRows = q
    ? rows.filter((r) => r.product_name.toLowerCase().includes(q))
    : rows

  // ── Pagination (over the searched set) ─────────────────────────────────────
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const pageSize = 25
  const totalRows = searchedRows.length
  const start = totalRows === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalRows)
  const pagedRows = searchedRows.slice((page - 1) * pageSize, page * pageSize)
  const hasMore = end < totalRows

  function goToPage(newPage: number) {
    const params = new URLSearchParams(urlSearchParams.toString())
    params.set('page', String(newPage))
    router.replace(`${pathname}?${params.toString()}`)
  }

  // ── Set Stock Level submit ───────────────────────────────────────────────
  async function onSubmit(values: SetStockLevelInput) {
    setIsSubmitting(true)
    const result = await setStockLevel(values)
    setIsSubmitting(false)

    if ('error' in result) {
      toast.error(result.error, { duration: 6000 })
      return
    }

    toast.success('Stock level updated.')
    setDialogOpen(false)
    form.reset()
    router.refresh()
  }

  const activeFilter = urlSearchParams.get('filter') ?? ''

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Stock levels across all godowns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/inventory/transfers">
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Transfers
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Stock
          </Button>
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search products..."
            className="max-w-sm"
            defaultValue={searchParams.q ?? ''}
            onChange={(e) => handleSearchRef.current(e.target.value)}
          />
          <Select
            value={activeFilter || '__all__'}
            onValueChange={handleFilterChange}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All products</SelectItem>
              <SelectItem value="low_stock">Low Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active filter chip */}
        {activeFilter === 'low_stock' && (
          <Badge
            variant="outline"
            className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 cursor-pointer"
            onClick={clearFilter}
          >
            Showing: Low Stock &amp; Out of Stock
            <X className="h-3 w-3" />
          </Badge>
        )}
        {activeFilter === 'out_of_stock' && (
          <Badge
            variant="outline"
            className="bg-red-500/15 text-red-400 border-red-500/30 gap-1 cursor-pointer"
            onClick={clearFilter}
          >
            Showing: Out of Stock only
            <X className="h-3 w-3" />
          </Badge>
        )}
      </div>

      {/* ── Empty states ─────────────────────────────────────────────────── */}
      {rows.length === 0 && !activeFilter && (
        <div className="text-center py-16">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-base font-semibold">No inventory records yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add stock to your products to track levels across godowns.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Stock
          </Button>
        </div>
      )}

      {rows.length === 0 && activeFilter && (
        <div className="text-center py-16">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
          <p className="text-base font-semibold">All products are sufficiently stocked</p>
          <p className="text-sm text-muted-foreground mt-1">
            No products are at or below their reorder level.
          </p>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Product</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Total Qty</TableHead>
                <TableHead className="text-right">Reorder Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Godowns</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map((row) => (
                <TableRow
                  key={row.product_id}
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() => router.push(`/inventory/${row.product_id}`)}
                >
                  <TableCell className="font-medium">
                    {row.product_name}
                    {row.total_reserved > 0 && (
                      <span className="text-muted-foreground text-xs ml-2">
                        ({row.total_reserved} reserved)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.unit}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.total_qty}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.reorder_level}
                  </TableCell>
                  <TableCell>
                    <InventoryStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.godown_count} godown(s)
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link href={`/inventory/${row.product_id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {pagedRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    No products match &ldquo;{q}&rdquo;.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalRows > pageSize && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {start}–{end} of {totalRows}
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

      {/* ── Set Stock Level Dialog ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); form.reset() } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Stock Level</DialogTitle>
            <DialogDescription>
              Initialize or update stock quantity for a product in a godown.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="godown_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Godown <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a godown" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {godowns.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}{g.is_default ? ' (Default)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reorder_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder Level</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Alert fires when qty drops to or below this level.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => { setDialogOpen(false); form.reset() }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Set Stock Level'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
