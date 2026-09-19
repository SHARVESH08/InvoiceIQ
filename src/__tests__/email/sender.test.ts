import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { resolveFromAddress, isSandboxSender } from '@/lib/email/sender'

const ORIGINAL = { ...process.env }

beforeEach(() => {
  vi.restoreAllMocks()
  delete process.env.RESEND_FROM_EMAIL
  delete process.env.ALLOW_SANDBOX_EMAIL_SENDER
})

afterEach(() => {
  process.env = { ...ORIGINAL }
})

/** NODE_ENV is readonly in the type defs but writable at runtime. */
function setNodeEnv(value: string) {
  Object.defineProperty(process.env, 'NODE_ENV', { value, configurable: true })
}

describe('isSandboxSender', () => {
  it('detects the Resend sandbox domain, case- and space-insensitively', () => {
    expect(isSandboxSender('onboarding@resend.dev')).toBe(true)
    expect(isSandboxSender('  Onboarding@Resend.Dev ')).toBe(true)
    expect(isSandboxSender('anything@resend.dev')).toBe(true)
  })

  it('treats a real domain as deliverable', () => {
    expect(isSandboxSender('billing@invoiceiq.in')).toBe(false)
    // Must not match a domain that merely contains the sandbox string.
    expect(isSandboxSender('billing@resend.dev.example.com')).toBe(false)
  })
})

describe('resolveFromAddress', () => {
  it('returns a configured verified sender unchanged', () => {
    setNodeEnv('production')
    process.env.RESEND_FROM_EMAIL = 'billing@invoiceiq.in'
    expect(resolveFromAddress()).toBe('billing@invoiceiq.in')
  })

  it('refuses the sandbox sender in production', () => {
    setNodeEnv('production')
    process.env.RESEND_FROM_EMAIL = 'onboarding@resend.dev'
    expect(() => resolveFromAddress()).toThrow(/sandbox sender/i)
  })

  it('refuses when RESEND_FROM_EMAIL is unset in production', () => {
    // The old `process.env.RESEND_FROM_EMAIL!` would have sent the literal
    // string "undefined" as the From header.
    setNodeEnv('production')
    expect(() => resolveFromAddress()).toThrow(/sandbox sender/i)
  })

  it('treats a blank value as unset rather than sending an empty From', () => {
    setNodeEnv('production')
    process.env.RESEND_FROM_EMAIL = '   '
    expect(() => resolveFromAddress()).toThrow(/sandbox sender/i)
  })

  it('allows the sandbox sender in production behind an explicit opt-in', () => {
    setNodeEnv('production')
    process.env.RESEND_FROM_EMAIL = 'onboarding@resend.dev'
    process.env.ALLOW_SANDBOX_EMAIL_SENDER = '1'
    expect(resolveFromAddress()).toBe('onboarding@resend.dev')
  })

  it('warns but still sends outside production', () => {
    setNodeEnv('development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveFromAddress()).toBe('onboarding@resend.dev')
    expect(warn).toHaveBeenCalledOnce()
  })

  it('does not warn outside production when opted in', () => {
    setNodeEnv('development')
    process.env.ALLOW_SANDBOX_EMAIL_SENDER = '1'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    resolveFromAddress()
    expect(warn).not.toHaveBeenCalled()
  })
})
