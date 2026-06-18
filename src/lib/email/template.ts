import 'server-only'

/**
 * Brand-consistent transactional email layout.
 *
 * Deliberately LIGHT-themed (not the app's dark Midnight Gold UI): email clients
 * — Gmail, Outlook, Apple Mail — render dark backgrounds inconsistently and often
 * force light mode, so a dark clone breaks. Brand identity is carried by the logo,
 * the gold accent button, and the wordmark/footer instead. Table layout + inline
 * styles for maximum client compatibility.
 */

// Brand gold = globals.css `--primary: 38 91% 55%` → #f5a824; on-gold text = `--primary-foreground` → #1a1206.
const BRAND_GOLD = '#f5a824'
const BRAND_GOLD_FG = '#1a1206'

/** Absolute base URL — email assets/links must be absolute, never relative. */
export function emailBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL
  if (u && u.startsWith('http') && !u.includes('localhost')) return u.replace(/\/+$/, '')
  return 'https://invoiceiq-one.vercel.app'
}

/** Escape a DB/user-supplied value before interpolating into email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface BrandedEmailOptions {
  /** Body HTML — block elements (e.g. <p>). Interpolated values must be pre-escaped. */
  bodyHtml: string
  /** Optional gold call-to-action button. */
  cta?: { label: string; url: string }
  /** Hidden inbox-preview text. */
  preheader?: string
}

/** Wrap body content in the brand-consistent, email-client-safe shell. */
export function renderBrandedEmail({ bodyHtml, cta, preheader }: BrandedEmailOptions): string {
  const base = emailBaseUrl()
  const logo = `${base}/brand/logo-mark.png`

  const ctaHtml = cta
    ? `<div style="padding:8px 0 4px;">
         <a href="${cta.url}" style="display:inline-block;background:${BRAND_GOLD};color:${BRAND_GOLD_FG};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;">${escapeHtml(cta.label)}</a>
       </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:24px 28px 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="${logo}" width="30" height="30" alt="InvoiceIQ" style="display:block;border-radius:7px;"></td>
          <td style="vertical-align:middle;padding-left:10px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#18181b;">InvoiceIQ</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:16px 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#27272a;">
        ${bodyHtml}
        ${ctaHtml}
      </td></tr>
      <tr><td style="padding:16px 28px 24px;border-top:1px solid #f1f1f4;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#a1a1aa;">
        Powered by <a href="${base}" style="color:${BRAND_GOLD};text-decoration:none;font-weight:600;">InvoiceIQ</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
