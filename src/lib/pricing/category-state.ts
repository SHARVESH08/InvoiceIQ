export interface ProductRow {
  id: string
  name: string
  category: string
  selling_price: number
}

export type CategoryState = 'all' | 'some' | 'none'

/** Aggregate monitor state of one category given the set of monitored ids. */
export function categoryMonitorState(
  products: ProductRow[],
  category: string,
  monitored: Set<string>,
): CategoryState {
  const inCat = products.filter((p) => p.category === category)
  if (inCat.length === 0) return 'none'
  const on = inCat.filter((p) => monitored.has(p.id)).length
  if (on === 0) return 'none'
  if (on === inCat.length) return 'all'
  return 'some'
}

/** Case-insensitive filter over product name + category. */
export function filterProducts(products: ProductRow[], query: string): ProductRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return products
  return products.filter(
    (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
  )
}
