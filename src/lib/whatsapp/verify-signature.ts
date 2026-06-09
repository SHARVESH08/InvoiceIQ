import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verifies Meta X-Hub-Signature-256 header using constant-time comparison.
 *
 * SEC-04 compliance: Uses `crypto.timingSafeEqual` — never `===` — to prevent
 * timing attacks where an attacker could determine valid bytes by measuring
 * comparison time. See RESEARCH.md §"Why NOT `===`" and STRIDE threat T-05-32.
 *
 * Length-mismatch guard: `timingSafeEqual` throws when buffer lengths differ.
 * The explicit length check short-circuits to `false` before any comparison is
 * attempted, preventing a DoS crash on short/malformed signatures (T-05-33).
 *
 * @param payload   - Raw request body (string or Buffer — webhook handlers
 *                    should pass req.text() result or raw Buffer)
 * @param signature - Value of X-Hub-Signature-256 header (format: "sha256={hex}")
 * @param secret    - WhatsApp app secret; Phase 9 webhook handler will pass
 *                    process.env.WHATSAPP_APP_SECRET here
 * @returns true iff the signature is a valid HMAC-SHA256 over the payload
 *          using the secret, false for any invalid/malformed/non-matching input
 */
export function verifyMetaSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  if (!signature.startsWith('sha256=')) return false

  const expectedHex = signature.slice(7) // strip 'sha256=' prefix

  const computedHex = createHmac('sha256', secret).update(payload).digest('hex')

  // CRITICAL guard — timingSafeEqual throws if buffer lengths differ (T-05-33)
  if (expectedHex.length !== computedHex.length) return false

  return timingSafeEqual(
    Buffer.from(computedHex, 'hex'),
    Buffer.from(expectedHex, 'hex'),
  )
}
