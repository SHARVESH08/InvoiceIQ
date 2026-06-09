import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'

// Hoist the mock fn so we can introspect calls in tests
const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn().mockResolvedValue({ short_url: 'https://rzp.io/i/abc123' }),
}))

vi.mock('razorpay', () => {
  const RazorpayMock = vi.fn(function (this: unknown) {
    return { paymentLink: { create: createMock } }
  })
  return { default: RazorpayMock }
})

// Import after mocks are set up
import { createPaymentLink } from '@/lib/payments/razorpay'

const FIXTURE_INVOICE = {
  id: 'inv_001',
  invoice_number: 'INV/2025-26/0001',
  total_amount: 1250.00,
  customer_name: 'Acme Corp',
  customer_email: 'billing@acme.com',
  customer_phone: '+919876543210',
}

describe('razorpay', () => {
  beforeEach(() => {
    createMock.mockClear()
    process.env.RAZORPAY_KEY_ID = 'rzp_test_xxx'
    process.env.RAZORPAY_KEY_SECRET = 'sk_test_xxx'
  })

  it('PAYMENT-01: paise arithmetic — rupees to paise conversion is exact integer multiplication', () => {
    expect(Math.round(1250.00 * 100)).toBe(125000)
    expect(Math.round(0.01 * 100)).toBe(1)
    expect(Math.round(99999.99 * 100)).toBe(9999999)
  })

  it('PAYMENT-01: createPaymentLink calls razorpay.paymentLink.create with amount in paise', async () => {
    await createPaymentLink(FIXTURE_INVOICE)
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 125000,
        currency: 'INR',
        description: 'INV/2025-26/0001',
      })
    )
  })

  it('PAYMENT-01: createPaymentLink returns short_url string', async () => {
    const result = await createPaymentLink(FIXTURE_INVOICE)
    expect(result).toBe('https://rzp.io/i/abc123')
  })

  it('PAYMENT-01: customer.contact omitted when invoice.customer_phone is null', async () => {
    await createPaymentLink({ ...FIXTURE_INVOICE, customer_phone: null })
    const callArg = createMock.mock.calls[0][0]
    expect('contact' in callArg.customer).toBe(false)
  })

  it('PAYMENT-01: customer.email omitted when invoice.customer_email is null', async () => {
    await createPaymentLink({ ...FIXTURE_INVOICE, customer_email: null })
    const callArg = createMock.mock.calls[0][0]
    expect('email' in callArg.customer).toBe(false)
  })

  it("PAYMENT-01: razorpay.ts module declares import 'server-only' on line 1", () => {
    const src = fs.readFileSync('src/lib/payments/razorpay.ts', 'utf8')
    expect(src.split('\n')[0]).toMatch(/import 'server-only'/)
  })
})
