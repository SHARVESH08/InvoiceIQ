import 'server-only'

// ─────────────────────────────────────────────────────────────────────────────
// From-address resolution.
//
// Resend's shared sandbox sender (onboarding@resend.dev) only delivers to the
// Resend account owner's own address. Mail to anyone else is accepted by the
// API and then silently dropped — the send "succeeds", the invoice is marked
// sent, and the customer never receives anything.
//
// Silent non-delivery is the worst failure mode available here, so in
// production this refuses to send rather than pretending. Callers already treat
// email failure as non-blocking (D-08), so the invoice still saves; the
// difference is that the operator now sees an actionable error instead of a
// false success.
//
// To fix properly: verify a domain in Resend, add the DNS records it gives you,
// then set RESEND_FROM_EMAIL to an address at that domain (e.g.
// billing@yourcompany.com).
// ─────────────────────────────────────────────────────────────────────────────

/** Resend's sandbox domain. Anything here can only reach the account owner. */
const SANDBOX_DOMAIN = /@resend\.dev$/i

export const SANDBOX_SENDER_MESSAGE =
  'Email is still configured with the Resend sandbox sender (onboarding@resend.dev), ' +
  'which only delivers to the Resend account owner. Verify a domain in Resend and set ' +
  'RESEND_FROM_EMAIL to an address on it. To send anyway (e.g. while testing), set ' +
  'ALLOW_SANDBOX_EMAIL_SENDER=1.'

export function isSandboxSender(address: string): boolean {
  return SANDBOX_DOMAIN.test(address.trim())
}

/**
 * The verified From address for outbound mail.
 *
 * @throws when running in production with the sandbox sender and no explicit
 *         ALLOW_SANDBOX_EMAIL_SENDER opt-in.
 */
export function resolveFromAddress(): string {
  const configured = process.env.RESEND_FROM_EMAIL?.trim()

  // Previously several call sites used `process.env.RESEND_FROM_EMAIL!`, which
  // sends the literal string "undefined" as the From header when unset.
  const from = configured || 'onboarding@resend.dev'

  if (!isSandboxSender(from)) return from

  const optedIn = process.env.ALLOW_SANDBOX_EMAIL_SENDER === '1'
  if (process.env.NODE_ENV === 'production' && !optedIn) {
    throw new Error(SANDBOX_SENDER_MESSAGE)
  }

  if (!optedIn) {
    console.warn(`[email] ${SANDBOX_SENDER_MESSAGE}`)
  }
  return from
}
