/**
 * Tests for generateNightlySummary nightly AI summary generator
 * Covers: AI-03
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockAskGroq } = vi.hoisted(() => {
  const mockAskGroq = vi.fn()
  return { mockAskGroq }
})

vi.mock('@/lib/ai/groq', () => ({
  askGroq: mockAskGroq,
}))

import { generateNightlySummary } from '@/lib/ai/nightly-summary'
import type { DaySnapshot } from '@/lib/ai/groq'

const validSnapshot: DaySnapshot = {
  date: '2026-06-02',
  revenue: 100000,
  invoice_count: 5,
  top_product: 'Rice',
  pending_count: 2,
  pending_value: 50000,
}

describe('generateNightlySummary', () => {
  beforeEach(() => {
    mockAskGroq.mockReset()
  })

  it('calls askGroq with max_tokens=150 and returns the response string [AI-03]', async () => {
    mockAskGroq.mockResolvedValueOnce('Sales were strong yesterday.')
    const result = await generateNightlySummary(validSnapshot)
    expect(mockAskGroq).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      150
    )
    expect(result).toBe('Sales were strong yesterday.')
  })

  it('resolves to a non-empty string for valid day stats [AI-03]', async () => {
    mockAskGroq.mockResolvedValueOnce('5 invoices generated totalling ₹1000.00. Top product was Rice. 2 invoices pending worth ₹500.00.')
    const result = await generateNightlySummary(validSnapshot)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns "Summary unavailable." when askGroq throws — never rethrows [AI-03]', async () => {
    mockAskGroq.mockRejectedValueOnce(new Error('Groq API unavailable'))
    const result = await generateNightlySummary(validSnapshot)
    expect(result).toBe('Summary unavailable.')
  })
})
