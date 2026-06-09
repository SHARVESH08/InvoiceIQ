/**
 * RED stubs — Tavily search integration (pricing monitor)
 * Covers: PRICING-02
 * Deviation: switched from Brave Search to Tavily API (TAVILY_API_KEY).
 * These will fail with "Cannot find module '@/lib/search/search'" until implemented.
 */

import { searchTavily, extractPricesFromResults, computeAveragePrice } from '@/lib/search/search'

describe('searchTavily', () => {
  it('resolves to an array of results for a commodity price query [PRICING-02]', async () => {
    const results = await searchTavily('rice wholesale price India')
    expect(Array.isArray(results)).toBe(true)
  })
})

describe('extractPricesFromResults', () => {
  it('extracts numeric price from result content with rupee symbol [PRICING-02]', () => {
    const results = [{ content: 'Rice ₹1,200 per bag', url: 'example.com' }]
    const prices = extractPricesFromResults(results)
    expect(prices).toEqual([1200])
  })
})

describe('computeAveragePrice', () => {
  it('returns null for an empty price array [PRICING-02]', () => {
    const avg = computeAveragePrice([])
    expect(avg).toBeNull()
  })

  it('returns a number (trimmed mean) for a valid price array [PRICING-02]', () => {
    const avg = computeAveragePrice([1000, 1200, 1100])
    expect(typeof avg).toBe('number')
    expect(avg).toBeGreaterThan(0)
  })
})
