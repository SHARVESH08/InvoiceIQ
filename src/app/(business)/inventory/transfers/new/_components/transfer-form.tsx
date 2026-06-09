'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ChevronLeft, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { CreateTransferSchema, type CreateTransferInput } from '@/lib/schemas/transfer'
import { createTransfer } from '@/lib/actions/transfers'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  unit: string
}

interface Godown {
  id: string
  name: string
}

interface InventoryRow {
  id: string
  product_id: string
  godown_id: string
  quantity: number
  reserved_qty: number
}

interface Props {
  products: Product[]
  godowns: Godown[]
  inventoryRows: InventoryRow[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransferForm({ products, godowns, inventoryRows }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreateTransferInput>({
    resolver: zodResolver(CreateTransferSchema),
    defaultValues: {
      product_id: '',
      from_godown_id: '',
      to_godown_id: '',
      qty: undefined,
      notes: '',
    },
  })

  // Watch reactive fields for available qty display and To Godown filter
  const watchedProductId = form.watch('product_id')
  const watchedFromGodownId = form.watch('from_godown_id')

  // Compute available qty for selected (product, from_godown) pair
  const availableQtyInfo = (() => {
    if (!watchedProductId || !watchedFromGodownId) return null
    const row = inventoryRows.find(
      (r) => r.product_id === watchedProductId && r.godown_id === watchedFromGodownId
    )
    if (!row) return { available: 0, noRecord: true }
    return { available: row.quantity - row.reserved_qty, noRecord: false }
  })()

  const selectedProduct = products.find((p) => p.id === watchedProductId)
  const selectedFromGodown = godowns.find((g) => g.id === watchedFromGodownId)

  // To Godown options exclude the currently selected From Godown
  const toGodownOptions = godowns.filter((g) => g.id !== watchedFromGodownId)

  async function onSubmit(data: CreateTransferInput) {
    setIsSubmitting(true)
    try {
      const result = await createTransfer(data)
      // If we get here (no redirect thrown), it's an error
      if (result && 'error' in result) {
        toast.error(result.error, { duration: 6000 })
      }
    } catch (err) {
      // redirect() throws a NEXT_REDIRECT error — this is expected on success
      // Re-throw so Next.js can handle the redirect
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/inventory/transfers"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Transfers
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Stock Transfer</CardTitle>
          <CardDescription>
            Request a stock transfer between godowns. A second team member must approve before
            stock moves.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Product */}
              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val)
                        // Reset from/to godown when product changes
                        form.setValue('from_godown_id', '')
                        form.setValue('to_godown_id', '')
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({p.unit})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* From Godown */}
              <FormField
                control={form.control}
                name="from_godown_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Godown</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val)
                        // Clear to_godown if it was the same as new from
                        const toVal = form.getValues('to_godown_id')
                        if (toVal === val) {
                          form.setValue('to_godown_id', '')
                        }
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source godown" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {godowns.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Available qty display */}
              {watchedProductId && watchedFromGodownId && (
                <div className="text-sm px-3 py-2 rounded-md bg-muted text-muted-foreground">
                  {availableQtyInfo?.noRecord ? (
                    <span className="text-destructive">
                      No stock record for this product in {selectedFromGodown?.name ?? 'this godown'}
                    </span>
                  ) : availableQtyInfo ? (
                    <>
                      Available in{' '}
                      <span className="font-medium text-foreground">
                        {selectedFromGodown?.name}
                      </span>
                      :{' '}
                      <span className="font-semibold text-foreground">
                        {availableQtyInfo.available}
                      </span>{' '}
                      {selectedProduct?.unit}
                    </>
                  ) : null}
                </div>
              )}

              {/* To Godown */}
              <FormField
                control={form.control}
                name="to_godown_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Godown</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination godown" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {toGodownOptions.length === 0 ? (
                          <SelectItem value="_none" disabled>
                            No other godowns available
                          </SelectItem>
                        ) : (
                          toGodownOptions.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantity */}
              <FormField
                control={form.control}
                name="qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0.001"
                        step="0.001"
                        placeholder="Enter quantity to transfer"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes (optional) */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Notes{' '}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Reason for transfer or any additional notes"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Transfer Request'
                  )}
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/inventory/transfers">Cancel</Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
