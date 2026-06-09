/**
 * WhatsApp Webhook Route Handler
 * WA-01: POST — HMAC-SHA256 verification + fire-and-forget to Edge Function
 * WA-02: GET  — Meta one-time webhook challenge verification
 *
 * MUST NOT import Supabase. MUST NOT touch DB. All bot logic lives in the Edge Function.
 */

import { createHmac, timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// GET /api/whatsapp — Meta webhook subscription challenge (WA-02)
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (!verifyToken) {
    return new Response('Forbidden', { status: 403 })
  }

  if (mode === 'subscribe' && token === verifyToken) {
    return new Response(challenge ?? '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return new Response('Forbidden', { status: 403 })
}

// ---------------------------------------------------------------------------
// POST /api/whatsapp — Receive Meta webhook events (WA-01, SEC-04, D-01)
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  // Read raw body BEFORE any parsing — HMAC must cover exact bytes Meta sent
  const rawBody = await request.text()

  const sigHeader = request.headers.get('x-hub-signature-256') ?? ''
  const appSecret = process.env.WHATSAPP_APP_SECRET

  if (!appSecret) {
    // Missing secret — reject rather than bypass security
    return new Response('Forbidden', { status: 403 })
  }

  // Build expected signature
  const expectedSig =
    'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')

  // timingSafeEqual requires equal-length buffers; length pre-check prevents throw
  let sigValid = false
  if (sigHeader.length === expectedSig.length) {
    sigValid = timingSafeEqual(
      Buffer.from(sigHeader, 'utf8'),
      Buffer.from(expectedSig, 'utf8')
    )
  }

  if (!sigValid) {
    // T-9-05: log tag only — never log raw body, expected HMAC, or app secret
    console.error('[whatsapp] sig mismatch')
    return new Response('Forbidden', { status: 403 })
  }

  // Valid signature — fire-and-forget to Supabase Edge Function (D-01)
  const edgeFnUrl = process.env.WHATSAPP_EDGE_FN_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (edgeFnUrl) {
    fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (serviceRoleKey ?? ''),
      },
      body: rawBody,
    }).catch((err: unknown) =>
      console.error('[whatsapp] edge fn fetch failed', err)
    )
  }

  // Return 200 immediately — DO NOT await the Edge Function call (D-01, WA-01)
  return new Response('OK', { status: 200 })
}
