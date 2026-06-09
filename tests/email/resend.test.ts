import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'

// Hoist sendMock so tests can introspect call args
const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue({ id: 'msg_1' }),
}))

vi.mock('resend', () => {
  const ResendMock = vi.fn(function (this: unknown) {
    return { emails: { send: sendMock } }
  })
  return { Resend: ResendMock }
})

import { sendInvoiceEmail } from '@/lib/email/resend'

const FIXTURE_INPUT = {
  invoiceNumber: 'INV/2025-26/0001',
  companyName: 'Acme Corp',
  customerEmail: 'customer@example.com',
  pdfBuffer: Buffer.from('test pdf content'),
  paymentLinkUrl: 'https://rzp.io/i/abc123',
}

describe('resend-email', () => {
  beforeEach(() => {
    sendMock.mockClear()
    process.env.RESEND_API_KEY = 'test_resend_api_key'
    process.env.RESEND_FROM_EMAIL = 'invoices@acme.com'
  })

  it('EMAIL-01: sendInvoiceEmail calls resend.emails.send with attachments[0].content as Buffer', async () => {
    await sendInvoiceEmail(FIXTURE_INPUT)
    expect(sendMock).toHaveBeenCalledTimes(1)
    const arg = sendMock.mock.calls[0][0]
    expect(Buffer.isBuffer(arg.attachments[0].content)).toBe(true)
  })

  it('EMAIL-01: subject includes invoiceNumber', async () => {
    await sendInvoiceEmail(FIXTURE_INPUT)
    const arg = sendMock.mock.calls[0][0]
    expect(arg.subject).toContain('INV/2025-26/0001')
  })

  it('EMAIL-01: html body contains paymentLinkUrl', async () => {
    await sendInvoiceEmail(FIXTURE_INPUT)
    const arg = sendMock.mock.calls[0][0]
    expect(arg.html).toContain('https://rzp.io/i/abc123')
  })

  it('EMAIL-01: from address uses RESEND_FROM_EMAIL env var or fallback', async () => {
    // With env var set
    process.env.RESEND_FROM_EMAIL = 'invoices@example.com'
    await sendInvoiceEmail(FIXTURE_INPUT)
    const arg = sendMock.mock.calls[0][0]
    expect(arg.from).toBe('invoices@example.com')
  })

  it("EMAIL-01: resend.ts module declares import 'server-only' on line 1", () => {
    const src = fs.readFileSync('src/lib/email/resend.ts', 'utf8')
    expect(src.split('\n')[0]).toMatch(/import 'server-only'/)
  })
})
