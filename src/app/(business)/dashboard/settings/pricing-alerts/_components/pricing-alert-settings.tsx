'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'
import {
  addPricingCategory,
  removePricingCategory,
  toggleAllProductCategories,
} from '@/lib/actions/pricing-alerts'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
interface PricingCategory {
  id: string
  category: string
  created_at: string
}

interface PricingAlertSettingsProps {
  categories: PricingCategory[]
  /** Distinct product categories for this company (for the all-products toggle + dropdown). */
  productCategories: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// PricingAlertSettings (PRICING-01)
// - "Monitor all my product categories" Switch — one-click enable/disable for all.
// - Dropdown to add a single existing product category.
// - Free-text input for a custom category.
// ─────────────────────────────────────────────────────────────────────────────
export function PricingAlertSettings({
  categories: initialCategories,
  productCategories,
}: PricingAlertSettingsProps) {
  const [localCategories, setLocalCategories] = useState<PricingCategory[]>(initialCategories)
  const [newCategory, setNewCategory] = useState('')
  const [isPending, startTransition] = useTransition()

  const monitoredSet = new Set(localCategories.map((c) => c.category.toLowerCase()))
  const availableProductCategories = productCategories.filter(
    (pc) => !monitoredSet.has(pc.toLowerCase())
  )
  const allProductsMonitored =
    productCategories.length > 0 &&
    productCategories.every((pc) => monitoredSet.has(pc.toLowerCase()))

  function handleAdd(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return

    startTransition(async () => {
      const result = await addPricingCategory(trimmed)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setLocalCategories((prev) => {
        if (prev.some((c) => c.category.toLowerCase() === result.category.category.toLowerCase())) {
          return prev
        }
        return [result.category, ...prev]
      })
      setNewCategory('')
      toast.success(`"${trimmed}" added to monitoring`)
    })
  }

  function handleRemove(id: string, category: string) {
    startTransition(async () => {
      const result = await removePricingCategory(id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setLocalCategories((prev) => prev.filter((c) => c.id !== id))
      toast.success(`"${category}" removed from monitoring`)
    })
  }

  function handleToggleAll(enabled: boolean) {
    startTransition(async () => {
      const result = await toggleAllProductCategories(enabled)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setLocalCategories(result.categories)
      toast.success(
        enabled
          ? 'Monitoring enabled for all your product categories'
          : 'Monitoring disabled for your product categories'
      )
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">Monitored Categories</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {localCategories.length}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── All-products toggle ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="space-y-0.5 pr-3">
            <Label htmlFor="monitor-all" className="text-sm font-medium">
              Monitor all my product categories
            </Label>
            <p className="text-xs text-muted-foreground">
              {productCategories.length > 0
                ? `Enables alerts across all ${productCategories.length} of your product ${
                    productCategories.length === 1 ? 'category' : 'categories'
                  }.`
                : 'Set a category on your products first to use this.'}
            </p>
          </div>
          <Switch
            id="monitor-all"
            checked={allProductsMonitored}
            onCheckedChange={handleToggleAll}
            disabled={isPending || productCategories.length === 0}
          />
        </div>

        {/* ── Monitored list ──────────────────────────────────────────────── */}
        {localCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No categories monitored yet. Use the toggle above, or add one below.
          </p>
        ) : (
          <ul className="space-y-2">
            {localCategories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="text-sm">{cat.category}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(cat.id, cat.category)}
                  disabled={isPending}
                  aria-label={`Remove ${cat.category}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <CardFooter className="flex flex-col items-start gap-3 pt-0 pb-4 px-6">
        {/* ── Dropdown: add one of your product categories ────────────────── */}
        {availableProductCategories.length > 0 && (
          <div className="w-full space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Add one of your product categories
            </Label>
            <Select value="" onValueChange={handleAdd} disabled={isPending}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a product category" />
              </SelectTrigger>
              <SelectContent>
                {availableProductCategories.map((pc) => (
                  <SelectItem key={pc} value={pc}>
                    {pc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ── Free-text: custom category ──────────────────────────────────── */}
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            handleAdd(newCategory)
          }}
          className="flex w-full gap-2"
        >
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Or add a custom category"
            disabled={isPending}
            className="flex-1"
            aria-label="New category name"
            maxLength={100}
          />
          <Button type="submit" disabled={isPending || !newCategory.trim()}>
            Add
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Alerts are checked weekly. You will receive an email when market prices deviate more
          than 10% from your product prices.
        </p>
      </CardFooter>
    </Card>
  )
}
