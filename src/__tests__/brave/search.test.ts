/**
 * Tests for Brave Search price extraction utilities
 * Covers: PRICING-02
 * Pure functions — no HTTP mocking needed.
 */

import { describe, it, expect } from 'vitest'
import { extractPricesFromResults, computeAveragePrice } from '@/lib/brave/search'
import type { BraveWebResult } from '@/lib/brave/search'

describe('extractPricesFromResults', () => {
  it('extracts ₹ and Rs. prices from description and extra_snippets [PRICING-02]', () => {
    const results: BraveWebResult[] = [
      {
        title: '',
        url: '',
        description: 'Rice ₹1,200 per bag',
        extra_snippets: ['Rs. 1100'],
      },
    ]
    const prices = extractPricesFromResults(results)
    expect(prices).toContain(1200)
    expect(prices).toContain(1100)
  })

  it('extracts INR prices from description [PRICING-02]', () => {
    const results: BraveWebResult[] = [
      {
        title: '',
        url: '',
        description: 'INR 2500 wholesale',
        extra_snippets: [],
      },
    ]
    const prices = extractPricesFromResults(results)
    expect(prices).toContain(2500)
  })

  it('returns empty array for empty results [PRICING-02]', () => {
    expect(extractPricesFromResults([])).toEqual([])
  })
})

describe('computeAveragePrice', () => {
  it('returns null for empty array [PRICING-02]', () => {
    expect(computeAveragePrice([])).toBeNull()
  })

  it('returns trimmed mean excluding top+bottom 20% [PRICING-02]', () => {
    // [100,200,300,400,500] → trim 1 from each end → [200,300,400] → avg 300
    const result = computeAveragePrice([100, 200, 300, 400, 500])
    expect(result).toBe(300)
  })

  it('returns single value when array has one element (no trimming) [PRICING-02]', () => {
    expect(computeAveragePrice([100])).toBe(100)
  })
})
