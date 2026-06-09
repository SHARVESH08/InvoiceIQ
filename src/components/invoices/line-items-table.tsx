'use client'

import { Trash2 } from 'lucide-react'
import {
  type UseFormReturn,
  type FieldArrayWithId,
  useWatch,
} from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  FormField,
} from '@/components/ui/form'
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
import { cn } from '@/lib/utils'
import type { InvoiceInput } from '@/lib/schemas/invoice'

interface Product {
  id: string
  name: string
  selling_price: number
  tax_rate: number
  hsn_code: string | null
  unit: string | null
}

interface LineItemsTableProps {
  form: UseFormReturn<InvoiceInput>
  fields: FieldArrayWithId<InvoiceInput, 'line_items', 'id'>[]
  append: (item: {
    product_id: string
    description: string
    hsn_code: string
    qty: number
    rate: number
    discount_percent: number
    tax_rate: number
  }) => void
  remove: (index: number) => void
  products: Product[]
  onProductSelect: (index: number, productId: string) => void
}

// Per-row amount display
function RowAmount({ form, index }: { form: UseFormReturn<InvoiceInput>; index: number }) {
  const qty = useWatch({ control: form.control, name: `line_items.${index}.qty` })
  const rate = useWatch({ control: form.control, name: `line_items.${index}.rate` })
  const discount = useWatch({ control: form.control, name: `line_items.${index}.discount_percent` })

  const amount = (Number(qty) || 0) * (Number(rate) || 0) * (1 - (Number(discount) || 0) / 100)
  return <span>₹{amount.toFixed(2)}</span>
}

// Per-row component — needs hooks so must be a component, not inline in .map()
function LineItemRow({
  form,
  index,
  field,
  remove,
  products,
  onProductSelect,
  isLastRow,
}: {
  form: UseFormReturn<InvoiceInput>
  index: number
  field: FieldArrayWithId<InvoiceInput, 'line_items', 'id'>
  remove: (index: number) => void
  products: Product[]
  onProductSelect: (index: number, productId: string) => void
  isLastRow: boolean
}) {
  const productId = useWatch({ control: form.control, name: `line_items.${index}.product_id` })
  const isLocked = Boolean(productId)
  const lockedCls = 'bg-muted/60 cursor-default select-none'

  return (
    <TableRow key={field.id}>
      {/* Row number */}
      <TableCell className="text-center text-muted-foreground text-sm">{index + 1}</TableCell>

      {/* Product select */}
      <TableCell>
        <FormField
          control={form.control}
          name={`line_items.${index}.product_id`}
          render={({ field: f }) => (
            <Select
              value={f.value}
              onValueChange={(val) => {
                f.onChange(val)
                onProductSelect(index, val)
              }}
            >
              <SelectTrigger className="h-9 w-full min-w-[180px]">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </TableCell>

      {/* Description — auto-filled, editable */}
      <TableCell>
        <FormField
          control={form.control}
          name={`line_items.${index}.description`}
          render={({ field: f }) => (
            <Input
              {...f}
              className="h-9 min-w-[160px]"
              placeholder="Item description"
            />
          )}
        />
        {form.formState.errors.line_items?.[index]?.description && (
          <p className="text-xs text-destructive mt-1">
            {form.formState.errors.line_items[index]?.description?.message}
          </p>
        )}
      </TableCell>

      {/* HSN — locked when product selected */}
      <TableCell>
        <FormField
          control={form.control}
          name={`line_items.${index}.hsn_code`}
          render={({ field: f }) => (
            <Input
              {...f}
              readOnly={isLocked}
              className={cn('h-9 w-24', isLocked && lockedCls)}
              placeholder="HSN"
            />
          )}
        />
      </TableCell>

      {/* Qty — always editable */}
      <TableCell>
        <FormField
          control={form.control}
          name={`line_items.${index}.qty`}
          render={({ field: f }) => (
            <Input
              type="number"
              min="0.001"
              step="1"
              value={isNaN(f.value as number) ? '' : f.value}
              onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
              onBlur={f.onBlur}
              name={f.name}
              ref={f.ref}
              className="h-9 w-20 text-right"
            />
          )}
        />
        {form.formState.errors.line_items?.[index]?.qty && (
          <p className="text-xs text-destructive mt-1">
            {form.formState.errors.line_items[index]?.qty?.message}
          </p>
        )}
      </TableCell>

      {/* Rate — locked when product selected */}
      <TableCell>
        <FormField
          control={form.control}
          name={`line_items.${index}.rate`}
          render={({ field: f }) => (
            <Input
              type="number"
              min="0"
              step="0.01"
              readOnly={isLocked}
              value={isNaN(f.value as number) ? '' : f.value}
              onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
              onBlur={f.onBlur}
              name={f.name}
              ref={f.ref}
              className={cn('h-9 w-28 text-right', isLocked && lockedCls)}
            />
          )}
        />
      </TableCell>

      {/* Discount % — always editable */}
      <TableCell>
        <FormField
          control={form.control}
          name={`line_items.${index}.discount_percent`}
          render={({ field: f }) => (
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={isNaN(f.value as number) ? '' : f.value}
              onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
              onBlur={f.onBlur}
              name={f.name}
              ref={f.ref}
              className="h-9 w-20 text-right"
            />
          )}
        />
      </TableCell>

      {/* Tax % — locked when product selected */}
      <TableCell>
        <FormField
          control={form.control}
          name={`line_items.${index}.tax_rate`}
          render={({ field: f }) => (
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              readOnly={isLocked}
              value={isNaN(f.value as number) ? '' : f.value}
              onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
              onBlur={f.onBlur}
              name={f.name}
              ref={f.ref}
              className={cn('h-9 w-20 text-right', isLocked && lockedCls)}
            />
          )}
        />
      </TableCell>

      {/* Amount — computed, read-only */}
      <TableCell className="text-right text-sm font-medium w-28">
        <RowAmount form={form} index={index} />
      </TableCell>

      {/* Remove */}
      <TableCell className="w-10">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-destructive"
          onClick={() => remove(index)}
          disabled={isLastRow}
          aria-label="Remove line item"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function LineItemsTable({
  form,
  fields,
  remove,
  products,
  onProductSelect,
}: LineItemsTableProps) {
  if (fields.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No items added yet. Click &quot;+ Add Item&quot; to begin.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead className="min-w-[180px]">Product</TableHead>
            <TableHead className="min-w-[160px]">Description</TableHead>
            <TableHead className="w-24">HSN</TableHead>
            <TableHead className="w-20 text-right">Qty</TableHead>
            <TableHead className="w-28 text-right">Rate (₹)</TableHead>
            <TableHead className="w-20 text-right">Disc %</TableHead>
            <TableHead className="w-20 text-right">Tax %</TableHead>
            <TableHead className="w-28 text-right">Amount (₹)</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field, index) => (
            <LineItemRow
              key={field.id}
              form={form}
              index={index}
              field={field}
              remove={remove}
              products={products}
              onProductSelect={onProductSelect}
              isLastRow={fields.length === 1}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
