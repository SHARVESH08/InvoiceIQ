'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'
import { addPricingCategory, removePricingCategory } from '@/lib/actions/pricing-alerts'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface PricingCategory {
  id: string
  category: string
  created_at: string
}

interface PricingAlertSettingsProps {
  categories: PricingCategory[]
}

// ─────────────────────────────────────────────────────────────────────────────
// PricingAlertSettings — client component
// PRICING-01: add/remove monitored categories for pricing alerts.
// T-11-23: server action validates non-empty + max 100 chars.
// T-11-24: server action verifies company_id on delete.
// ─────────────────────────────────────────────────────────────────────────────
export function PricingAlertSettings({ categories: initialCategories }: PricingAlertSettingsProps) {
  const [localCategories, setLocalCategories] = useState<PricingCategory[]>(initialCategories)
  const [newCategory, setNewCategory] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    const trimmed = newCategory.trim()
    if (!trimmed) return

    startTransition(async () => {
      const result = await addPricingCategory(trimmed)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setLocalCategories((prev) => [result.category, ...prev])
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

      <CardContent>
        {localCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No categories added yet. Add a product category to start monitoring market prices.
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
        <form onSubmit={handleAdd} className="flex w-full gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="e.g. Basmati Rice, Cooking Oil"
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
          Alerts are checked weekly. You will receive email alerts when market prices deviate more
          than 10% from your product prices.
        </p>
      </CardFooter>
    </Card>
  )
}
