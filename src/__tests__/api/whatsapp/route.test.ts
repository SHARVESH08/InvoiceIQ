/**
 * WhatsApp Webhook Route Handler Tests
 * Covers: WA-01 (HMAC signature verification) + WA-02 (GET challenge)
 * Wave 1 (Plan 09-02) — real implementation under test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

// --- helpers for constructing signed requests ---

function buildSignature(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
}

function buildGetRequest(token: string): Request {
  const url = new URL('http://localhost/api/whatsapp')
  url.searchParams.set('hub.mode', 'subscribe')
  url.searchParams.set('hub.verify_token', token)
  url.searchParams.set('hub.challenge', 'challenge_value_abc')
  return new Request(url.toString(), { method: 'GET' })
}

function buildPostRequest(body: string, signature: string): Request {
  return new Request('http://localhost/api/whatsapp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature,
    },
    body,
  })
}

// --- environment setup ---

beforeEach(() => {
  vi.resetAllMocks()
  process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token'
  process.env.WHATSAPP_APP_SECRET = 'test-app-secret'
  process.env.WHATSAPP_EDGE_FN_URL = 'https://example.supabase.co/functions/v1/whatsapp-bot'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
})

// --- WA-02: GET challenge verification ---

describe('GET /api/whatsapp (WA-02)', () => {
  it('GET with correct verify_token returns hub.challenge value', async () => {
    // stub: implement in Wave 1 (Plan 09-02)
    // Wave 1 must: return Response(challenge, { status: 200 }) when token matches
    const { GET } = await import('@/app/api/whatsapp/route')
    const req = buildGetRequest('test-verify-token')
    // Wave 1 implementation must return the challenge string
    const response = await GET(req)
    expect(response?.status).toBe(200)
    const text = await response?.text()
    expect(text).toBe('challenge_value_abc')
  })

  it('GET with wrong verify_token returns 403', async () => {
    // stub: implement in Wave 1 (Plan 09-02)
    // Wave 1 must: return Response('Forbidden', { status: 403 }) when token mismatch
    const { GET } = await import('@/app/api/whatsapp/route')
    const req = buildGetRequest('wrong-token')
    const response = await GET(req)
    expect(response?.status).toBe(403)
  })
})

// --- WA-01: POST signature verification ---

describe('POST /api/whatsapp (WA-01)', () => {
  it('POST with invalid X-Hub-Signature-256 returns 403 and does NOT fetch the Edge Function', async () => {
    // stub: implement in Wave 1 (Plan 09-02)
    // Wave 1 must: verify HMAC; invalid sig → 403; no fire-and-forget fetch
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('OK', { status: 200 })
    )
    const { POST } = await import('@/app/api/whatsapp/route')
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
    const req = buildPostRequest(body, 'sha256=invalidsignature')
    const response = await POST(req)
    expect(response?.status).toBe(403)
    // Edge Function must NOT be called when signature is invalid
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('POST with valid signature returns 200 within 5s and fires fetch to WHATSAPP_EDGE_FN_URL (no await)', async () => {
    // stub: implement in Wave 1 (Plan 09-02)
    // Wave 1 must: verify HMAC; valid sig → 200 immediately; fire-and-forget to WHATSAPP_EDGE_FN_URL
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('OK', { status: 200 })
    )
    const { POST } = await import('@/app/api/whatsapp/route')
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
    const sig = buildSignature(body, 'test-app-secret')
    const req = buildPostRequest(body, sig)

    const start = Date.now()
    const response = await POST(req)
    const elapsed = Date.now() - start

    expect(response?.status).toBe(200)
    expect(elapsed).toBeLessThan(5000)
    // Fire-and-forget: fetch must be called with edge fn URL
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/whatsapp-bot',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
