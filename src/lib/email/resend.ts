import 'server-only'

import { Resend } from 'resend'
import { renderBrandedEmail, escapeHtml } from './template'

/**
 * EMAIL-01 — Resend email with PDF attachment and payment link.
 *
 * Attachment: pdfBuffer is passed directly as the `content` field (Node Buffer).
 * DO NOT base64-encode — Resend SDK 6.x accepts Buffer directly (RESEARCH.md Pattern 4).
 *
 * Non-blocking: sendInvoiceEmail throws on Resend SDK failure. Plan 04 (markAsSent)
 * wraps in a non-blocking try/catch per D-08 (email failure does not block invoice status update).
 *
 * Server-only: RESEND_API_KEY must never reach the client bundle.
 */

export interface EmailInput {
  invoiceNumber: string
  companyName: string
  customerEmail: string
  pdfBuffer: Buffer
  paymentLinkUrl: string
}

/**
 * Sends an invoice email with PDF attachment and payment link to the customer.
 *
 * @param input - Email payload including invoice details, PDF buffer, and payment link
 * @returns void — throws on Resend SDK failure (caller handles per D-08)
 */
export async function sendInvoiceEmail(input: EmailInput): Promise<void> {
  // Instantiate per-call so tests can mock the constructor after module load
  const resend = new Resend(process.env.RESEND_API_KEY!)

  const from = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

  const invoiceNumber = escapeHtml(input.invoiceNumber)
  const companyName = input.companyName ? escapeHtml(input.companyName) : ''

  const html = renderBrandedEmail({
    preheader: `Your invoice ${input.invoiceNumber} is attached.`,
    bodyHtml: `
      <p style="margin:0 0 14px;">Hello${companyName ? ` from ${companyName}` : ''},</p>
      <p style="margin:0 0 14px;">Please find your invoice <strong style="color:#18181b;">${invoiceNumber}</strong> attached to this email.</p>
      <p style="margin:0 0 4px;">You can settle it securely using the button below.</p>`,
    cta: { label: 'Pay Now', url: input.paymentLinkUrl },
  })

  // Plain-text fallback for clients that block HTML/images (deliverability).
  const text = [
    `Hello${input.companyName ? ` from ${input.companyName}` : ''},`,
    '',
    `Please find your invoice ${input.invoiceNumber} attached to this email.`,
    '',
    `Pay now: ${input.paymentLinkUrl}`,
    '',
    'Thank you for your business.',
  ].join('\n')

  await resend.emails.send({
    from,
    to: [input.customerEmail],
    subject: `Invoice ${input.invoiceNumber} from ${input.companyName}`,
    html,
    text,
    attachments: [{ filename: `${input.invoiceNumber}.pdf`, content: input.pdfBuffer }],
  })
}
