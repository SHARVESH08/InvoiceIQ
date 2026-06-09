import 'server-only'

import Razorpay from 'razorpay'

/**
 * PAYMENT-01 — Razorpay Payment Link generation.
 *
 * Paise arithmetic: total_amount arrives as decimal rupees from Supabase (JS number).
 * We convert with Math.round(Number(x) * 100) — never parseInt, never floats
 * (RESEARCH.md Pitfall 2).
 *
 * Null field omission: Razorpay rejects payment-link create calls that include
 * `email: null` or `contact: null` inside the customer object. We use conditional
 * spread to omit those keys entirely when the invoice row has null values
 * (RESEARCH.md Pitfall 8).
 *
 * Errors bubble to the caller — Plan 04 (markAsSent) wraps in try/catch (D-08).
 *
 * Server-only: RAZORPAY_KEY_SECRET must never reach the client bundle.
 */

export interface PaymentLinkInput {
  id: string
  invoice_number: string
  total_amount: number
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
}

/**
 * Creates a Razorpay Payment Link for the given invoice and returns the short_url.
 *
 * @param invoice - Invoice data from the DB row (total_amount in decimal rupees)
 * @returns Razorpay short_url (e.g. "https://rzp.io/i/abc123")
 */
export async function createPaymentLink(invoice: PaymentLinkInput): Promise<string> {
  // Instantiate per-call so tests can mock the constructor after module load
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  })

  // Convert decimal rupees to integer paise (RESEARCH.md Pitfall 2)
  const amountPaise = Math.round(Number(invoice.total_amount) * 100)

  // Omit null fields entirely — Razorpay rejects null values in customer object
  // (RESEARCH.md Pitfall 8). Conditional spread omits the key when falsy.
  const customer = {
    name: invoice.customer_name,
    ...(invoice.customer_email && { email: invoice.customer_email }),
    ...(invoice.customer_phone && { contact: invoice.customer_phone }),
  }

  const link = await razorpay.paymentLink.create({
    amount: amountPaise,
    currency: 'INR',
    description: invoice.invoice_number,
    customer,
    notify: { sms: false, email: false },
    reminder_enable: false,
  })

  return link.short_url as string
}
