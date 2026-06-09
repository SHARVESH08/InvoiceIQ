import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { verifyMetaSignature } from '@/lib/whatsapp/verify-signature'

const SECRET = 'test-app-secret'
const PAYLOAD = '{"object":"whatsapp_business_account","entry":[]}'

describe('verify-meta-signature', () => {
  it('SEC-04: valid sha256 signature passes verifyMetaSignature', () => {
    const validHex = createHmac('sha256', SECRET).update(PAYLOAD).digest('hex')
    expect(verifyMetaSignature(PAYLOAD, `sha256=${validHex}`, SECRET)).toBe(true)
  })

  it('SEC-04: wrong-hex signature is rejected', () => {
    // 64 'a' chars — same length as a real SHA-256 hex, but wrong value
    const wrongHex = 'a'.repeat(64)
    expect(verifyMetaSignature(PAYLOAD, `sha256=${wrongHex}`, SECRET)).toBe(false)
  })

  it('SEC-04: short hex signature returns false without throwing (length mismatch guard)', () => {
    // 'sha256=short' has hex portion shorter than 64 chars — triggers length guard before timingSafeEqual
    expect(() => verifyMetaSignature(PAYLOAD, 'sha256=short', SECRET)).not.toThrow()
    expect(verifyMetaSignature(PAYLOAD, 'sha256=short', SECRET)).toBe(false)
  })

  it('SEC-04: implementation uses crypto.timingSafeEqual (source grep)', () => {
    const src = readFileSync('src/lib/whatsapp/verify-signature.ts', 'utf8')
    expect(src).toMatch(/timingSafeEqual/)
    // Defensive: verify no === comparison between hex strings was introduced
    expect(src).not.toMatch(/expectedHex\s*===\s*computedHex|computedHex\s*===\s*expectedHex/)
  })

  it('SEC-04: signature without sha256= prefix returns false', () => {
    const validHex = createHmac('sha256', SECRET).update('{"any":"payload"}').digest('hex')
    // Bare hex (no prefix) → must reject
    expect(verifyMetaSignature('{"any":"payload"}', validHex, SECRET)).toBe(false)
    // Wrong algorithm prefix → must reject
    expect(verifyMetaSignature('{"any":"payload"}', `sha512=${validHex}`, SECRET)).toBe(false)
  })

  it('SEC-04: verify-signature.ts module declares import \'server-only\' on line 1', () => {
    const src = readFileSync('src/lib/whatsapp/verify-signature.ts', 'utf8')
    expect(src.split('\n')[0]).toMatch(/import 'server-only'/)
  })
})
