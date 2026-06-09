/**
 * Tests for askGroq Groq API wrapper
 * Covers: AI-02
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockCreate, MockGroqConstructor } = vi.hoisted(() => {
  const mockCreate = vi.fn()
  const MockGroqConstructor = vi.fn(function () {
    return {
      chat: { completions: { create: mockCreate } },
    }
  })
  return { mockCreate, MockGroqConstructor }
})

vi.mock('groq-sdk', () => ({
  default: MockGroqConstructor,
}))

import { askGroq } from '@/lib/ai/groq'

describe('askGroq', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    MockGroqConstructor.mockReset()
    // Re-establish constructor behavior after reset (use regular function, not arrow)
    MockGroqConstructor.mockImplementation(function () {
      return { chat: { completions: { create: mockCreate } } }
    })
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Mocked response' } }],
    })
  })

  it('resolves to the content string returned by the SDK [AI-02]', async () => {
    const result = await askGroq('hello', 'company context string', 300)
    expect(result).toBe('Mocked response')
  })

  it('calls Groq constructor with { apiKey: process.env.GROQ_API_KEY } [AI-02]', async () => {
    process.env.GROQ_API_KEY = 'test-key-123'
    await askGroq('hello', 'ctx', 300)
    expect(MockGroqConstructor).toHaveBeenCalledWith({ apiKey: 'test-key-123' })
  })

  it('creates completion with model llama-3.3-70b-versatile and stream: false [AI-02]', async () => {
    await askGroq('hello', 'ctx', 300)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'llama-3.3-70b-versatile',
        stream: false,
      })
    )
  })

  it('returns empty string when choices[0]?.message?.content is undefined [AI-02]', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [] })
    const result = await askGroq('hello', 'ctx', 300)
    expect(result).toBe('')
  })

  it('passes maxTokens=150 as max_tokens to the SDK [AI-02]', async () => {
    await askGroq('hello', 'ctx', 150)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 150,
      })
    )
  })
})
