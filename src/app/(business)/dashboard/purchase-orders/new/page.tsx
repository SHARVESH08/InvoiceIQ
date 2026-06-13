'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, Plus, X, Search } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  lookupDistributorByGstin,
  createPurchaseOrder,
} from '@/lib/actions/purchase-orders'
import { formatRupees } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

// ─────────────────────────────────────────────────────────────────────────────
// CreatePOPage — Client Component
// OEM-only page for creating a new Purchase Order.
// Flow:
//   1. Look up Distributor by GSTIN (confirmation card before proceeding)
//   2. Add line items (product + qty + unit price)
//   3. Save as Draft or Send to Distributor
// ─────────────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  hsn_code: string | null
  selling_price?: number
}

interface LineItem {
  product_id: string
  quantity_ordered: number
  unit_price: number
  description?: string
}

type LookupState = 'idle' | 'loading' | 'found' | 'not_found'

export default function CreatePOPage() {
  const router = useRouter()

  // GSTIN lookup state
  const [gstin, setGstin] = useState('')
  const [lookupState, setLookupState] = useState<LookupState>('idle')
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [foundDistributor, setFoundDistributor] = useState<{
    id: string
    name: string
  } | null>(null)
  const [distributorConfirmed, setDistributorConfirmed] = useState(false)

  // Line items state
  const [items, setItems] = useState<LineItem[]>([
    { product_id: '', quantity_ordered: 1, unit_price: 0 },
  ])
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Summary
  const [expectedDelivery, setExpectedDelivery] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Fetch products on mount
  useEffect(() => {
    async function fetchProducts() {
      setLoadingProducts(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('products')
          .select('id, name, hsn_code, selling_price')
          .order('name', { ascending: true })
        setProducts((data as Product[]) ?? [])
      } catch {
        // Non-blocking — user can still type product IDs if needed
      } finally {
        setLoadingProducts(false)
      }
    }
    fetchProducts()
  }, [])

  // GSTIN lookup handler
  async function handleLookup() {
    if (!gstin.trim()) return
    setLookupState('loading')
    setLookupError(null)
    setFoundDistributor(null)

    const result = await lookupDistributorByGstin(gstin.trim())

    if ('error' in result) {
      setLookupState('not_found')
      setLookupError(result.error)
    } else {
      setLookupState('found')
      setFoundDistributor(result.company)
    }
  }

  function handleSearchAgain() {
    setLookupState('idle')
    setLookupError(null)
    setFoundDistributor(null)
    setDistributorConfirmed(false)
    setGstin('')
  }

  function handleUseDistributor() {
    setDistributorConfirmed(true)
  }

  // Line item handlers
  function addItem() {
    setItems((prev) => [
      ...prev,
      { product_id: '', quantity_ordered: 1, unit_price: 0 },
    ])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    )
  }

  function handleProductSelect(index: number, productId: string) {
    const product = products.find((p) => p.id === productId)
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              product_id: productId,
              unit_price: product?.selling_price ?? 0,
            }
          : item
      )
    )
  }

  // Total amount computed from items
  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity_ordered * item.unit_price,
    0
  )

  // Submit handler
  async function handleSubmit(isDraft: boolean) {
    if (!foundDistributor || !distributorConfirmed) {
      toast.error('Please confirm the distributor before submitting.')
      return
    }

    const validItems = items.filter(
      (item) => item.product_id && item.quantity_ordered > 0
    )
    if (validItems.length === 0) {
      toast.error('Please add at least one line item.')
      return
    }

    setSubmitting(true)
    try {
      // Note: createPurchaseOrder always sets status='sent'.
      // For draft, we use a workaround: pass status flag via notes field.
      // The server action does not support isDraft natively, so we create
      // with status='sent' for "Send to Distributor" and status='draft'
      // via a direct insert for "Save as Draft".
      // Since Plan 02 createPurchaseOrder hardcodes status='sent', we handle draft
      // by using a separate direct Supabase insert for draft (no notification sent).
      const supabase = createClient()

      if (isDraft) {
        // Draft: insert directly without triggering email/notifications
        const poNumber = 'PO-' + Date.now()
        const { data: ctx } = await supabase.rpc('get_company_context')
        const companyId = (ctx as { company_id?: string })?.company_id

        if (!companyId) {
          toast.error('Action failed. Please try again.')
          return
        }

        const { data: poRow, error: poError } = await supabase
          .from('purchase_orders')
          .insert({
            company_id: companyId,
            distributor_company_id: foundDistributor.id,
            supplier_id: null,
            status: 'draft',
            total_amount: totalAmount,
            expected_delivery: expectedDelivery || null,
            notes: null,
            po_number: poNumber,
          })
          .select('id')
          .single()

        if (poError || !poRow) {
          toast.error('Action failed. Please try again.')
          return
        }

        const itemRows = validItems.map((item) => ({
          po_id: poRow.id,
          product_id: item.product_id,
          company_id: companyId,
          quantity_ordered: item.quantity_ordered,
          quantity_received: 0,
          unit_price: item.unit_price,
          total_amount: item.quantity_ordered * item.unit_price,
        }))

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(itemRows)

        if (itemsError) {
          await supabase.from('purchase_orders').delete().eq('id', poRow.id)
          toast.error('Action failed. Please try again.')
          return
        }

        toast.success('Draft saved.')
        router.push('/dashboard/purchase-orders')
        return
      }

      // Send to Distributor — use server action (sends email notification)
      const result = await createPurchaseOrder({
        distributor_company_id: foundDistributor.id,
        expected_delivery: expectedDelivery || undefined,
        items: validItems.map((item) => ({
          product_id: item.product_id,
          quantity_ordered: item.quantity_ordered,
          unit_price: item.unit_price,
          description: item.description,
        })),
      })

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success('Purchase order sent to distributor.')
      router.push('/dashboard/purchase-orders')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/purchase-orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Purchase Orders
      </Link>

      <h1 className="text-xl font-bold leading-tight">New Purchase Order</h1>

      {/* Section 1: Distributor Lookup */}
      <Card>
        <CardHeader>
          <CardTitle>Find Distributor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input row */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Enter distributor GSTIN"
              className="max-w-xs"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !submitting && lookupState !== 'loading') {
                  handleLookup()
                }
              }}
              disabled={distributorConfirmed || lookupState === 'loading'}
            />
            {!distributorConfirmed && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLookup}
                disabled={lookupState === 'loading' || !gstin.trim()}
              >
                {lookupState === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-1" />
                    Search
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Found: confirmation card */}
          {lookupState === 'found' && foundDistributor && !distributorConfirmed && (
            <div className="rounded-md border p-4 space-y-3 bg-muted/30">
              <div className="space-y-1">
                <p className="font-medium">{foundDistributor.name}</p>
                <Badge variant="secondary">Distributor</Badge>
                <p className="text-xs text-muted-foreground">{gstin.toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="default" size="sm" onClick={handleUseDistributor}>
                  Use this distributor
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSearchAgain}>
                  Search again
                </Button>
              </div>
            </div>
          )}

          {/* Confirmed distributor banner */}
          {distributorConfirmed && foundDistributor && (
            <div className="flex items-center justify-between rounded-md border px-4 py-3 bg-green-500/15">
              <div>
                <p className="font-medium text-sm">{foundDistributor.name}</p>
                <p className="text-xs text-muted-foreground">{gstin.toUpperCase()}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSearchAgain}
                disabled={submitting}
              >
                Change
              </Button>
            </div>
          )}

          {/* Not found / wrong type error */}
          {lookupState === 'not_found' && lookupError && (
            <p className="text-sm text-destructive">{lookupError}</p>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Line Items (shown after distributor confirmed) */}
      {distributorConfirmed && (
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Product</TableHead>
                    <TableHead className="w-[15%]">Qty</TableHead>
                    <TableHead className="w-[20%]">Unit Price (₹)</TableHead>
                    <TableHead className="w-[15%]">Total</TableHead>
                    <TableHead className="w-[10%] sr-only">Remove</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={item.product_id}
                          onValueChange={(val) => handleProductSelect(index, val)}
                          disabled={submitting || loadingProducts}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                                {product.hsn_code ? ` (HSN: ${product.hsn_code})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity_ordered}
                          onChange={(e) =>
                            updateItem(index, 'quantity_ordered', Number(e.target.value))
                          }
                          className="h-8 w-20"
                          disabled={submitting}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(index, 'unit_price', Number(e.target.value))
                          }
                          className="h-8 w-28"
                          disabled={submitting}
                        />
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatRupees(item.quantity_ordered * item.unit_price)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => removeItem(index)}
                          disabled={submitting || items.length === 1}
                          aria-label="Remove item"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={addItem}
              disabled={submitting}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>

            {/* Section 3: Summary */}
            <div className="space-y-3 pt-4 border-t">
              {/* Expected delivery */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium w-40 shrink-0">
                  Expected delivery
                </label>
                <Input
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  className="max-w-[200px]"
                  disabled={submitting}
                />
                <span className="text-xs text-muted-foreground">(optional)</span>
              </div>

              {/* Total */}
              <div className="flex items-center justify-end">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total amount</p>
                  <p className="text-lg font-semibold">{formatRupees(totalAmount)}</p>
                </div>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => handleSubmit(true)}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save as Draft
              </Button>
              <Button
                variant="default"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Send to Distributor
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
