import { describe, it, expect } from 'vitest'
import { categoryMonitorState, filterProducts, type ProductRow } from './category-state'

const rows: ProductRow[] = [
  { id: 'a', name: 'Rebar 8mm', category: 'Steel', selling_price: 100 },
  { id: 'b', name: 'Rebar 10mm', category: 'Steel', selling_price: 120 },
  { id: 'c', name: 'Cement Bag', category: 'Cement', selling_price: 400 },
]

describe('categoryMonitorState', () => {
  it('returns "all" when every product in the category is monitored', () => {
    expect(categoryMonitorState(rows, 'Steel', new Set(['a', 'b']))).toBe('all')
  })
  it('returns "some" when partially monitored', () => {
    expect(categoryMonitorState(rows, 'Steel', new Set(['a']))).toBe('some')
  })
  it('returns "none" when nothing in the category is monitored', () => {
    expect(categoryMonitorState(rows, 'Steel', new Set(['c']))).toBe('none')
  })
})

describe('filterProducts', () => {
  it('matches by product name (case-insensitive)', () => {
    expect(filterProducts(rows, 'rebar').map((r) => r.id)).toEqual(['a', 'b'])
  })
  it('matches by category', () => {
    expect(filterProducts(rows, 'cement').map((r) => r.id)).toEqual(['c'])
  })
  it('returns all rows for empty query', () => {
    expect(filterProducts(rows, '   ')).toHaveLength(3)
  })
})
