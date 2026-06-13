'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SwitchAnimated } from '@/components/ui/switch-animated'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  categoryMonitorState,
  filterProducts,
  type ProductRow,
} from '@/lib/pricing/category-state'
import { toggleProductAlert, toggleCategoryAlert } from '@/lib/actions/pricing-monitor'

export function ProductAlertManager({
  products,
  initialMonitoredIds,
}: {
  products: ProductRow[]
  initialMonitoredIds: string[]
}) {
  const [monitored, setMonitored] = useState<Set<string>>(() => new Set(initialMonitoredIds))
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  const visible = useMemo(() => filterProducts(products, query), [products, query])

  const groups = useMemo(() => {
    const map = new Map<string, ProductRow[]>()
    for (const p of visible) {
      const arr = map.get(p.category) ?? []
      arr.push(p)
      map.set(p.category, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [visible])

  function setProduct(id: string, enabled: boolean) {
    setMonitored((prev) => {
      const next = new Set(prev)
      if (enabled) next.add(id)
      else next.delete(id)
      return next
    })
    startTransition(async () => {
      const res = await toggleProductAlert(id, enabled)
      if ('error' in res) {
        toast.error(res.error)
        setMonitored((prev) => {
          const next = new Set(prev)
          if (enabled) next.delete(id)
          else next.add(id)
          return next
        })
      }
    })
  }

  function setCategory(category: string, enabled: boolean) {
    const ids = products.filter((p) => p.category === category).map((p) => p.id)
    // Snapshot inside the functional updater so a concurrent in-flight product
    // toggle isn't lost if this category write needs to roll back.
    let prevSnapshot: Set<string> | null = null
    setMonitored((prev) => {
      prevSnapshot = new Set(prev)
      const next = new Set(prev)
      for (const id of ids) {
        if (enabled) next.add(id)
        else next.delete(id)
      }
      return next
    })
    startTransition(async () => {
      const res = await toggleCategoryAlert(category, enabled)
      if ('error' in res) {
        toast.error(res.error)
        if (prevSnapshot) setMonitored(prevSnapshot)
      } else {
        toast.success(enabled ? `Monitoring all of ${category}` : `Stopped monitoring ${category}`)
      }
    })
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No categorized products yet. Add a category to your products to monitor their prices.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Input
        type="search"
        role="searchbox"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products or categories…"
        aria-label="Search products"
        className="max-w-sm"
      />

      {groups.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No products match &ldquo;{query}&rdquo;.</p>
      ) : (
        groups.map(([category, rows]) => {
          const state = categoryMonitorState(products, category, monitored)
          return (
            <Card key={category}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{category}</p>
                    <p className="text-xs text-muted-foreground">
                      {state === 'all'
                        ? 'All monitored'
                        : state === 'some'
                          ? 'Partially monitored'
                          : 'Not monitored'}
                    </p>
                  </div>
                  <SwitchAnimated
                    checked={state === 'all'}
                    onCheckedChange={(v) => setCategory(category, v)}
                    disabled={isPending}
                    aria-label={
                      state === 'all' ? `Stop monitoring all ${category}` : `Monitor all ${category}`
                    }
                  />
                </div>
                <ul className="divide-y divide-border">
                  {rows.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{p.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          ₹{p.selling_price.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <SwitchAnimated
                        checked={monitored.has(p.id)}
                        onCheckedChange={(v) => setProduct(p.id, v)}
                        disabled={isPending}
                        aria-label={`Monitor ${p.name}`}
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
