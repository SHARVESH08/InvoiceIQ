/**
 * Brave Search integration (pricing monitor) — PRICING-02
 * Covers searchBrave (with mocked fetch), price extraction, and trimmed-mean averaging.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  searchBrave,
  extractPricesFromResults,
  computeAveragePrice,
  type BraveWebResult,
} from '@/lib/brave/search'

describe('searchBrave', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the web results array from the Brave API response [PRICING-02]', async () => {
    const fakeResults: BraveWebResult[] = [
      { title: 'Rice price', url: 'https://example.com', description: 'Rice ₹1,200 per bag' },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ web: { results: fakeResults } }),
      }),
    )

    const results = await searchBrave('rice wholesale price India')
    expect(Array.isArray(results)).toBe(true)
    expect(results).toEqual(fakeResults)
  })

  it('throws on a non-OK response [PRICING-02]', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    await expect(searchBrave('x')).rejects.toThrow('Brave Search error: 429')
  })
})

describe('extractPricesFromResults', () => {
  it('extracts numeric price from a result description with rupee symbol [PRICING-02]', () => {
    const results: BraveWebResult[] = [
      { title: 'Rice', url: 'https://example.com', description: 'Rice ₹1,200 per bag' },
    ]
    const prices = extractPricesFromResults(results)
    expect(prices).toEqual([1200])
  })
})

describe('computeAveragePrice', () => {
  it('returns null for an empty price array [PRICING-02]', () => {
    expect(computeAveragePrice([])).toBeNull()
  })

  it('returns a positive number (trimmed mean) for a valid price array [PRICING-02]', () => {
    const avg = computeAveragePrice([1000, 1200, 1100])
    expect(typeof avg).toBe('number')
    expect(avg).toBeGreaterThan(0)
  })
})
