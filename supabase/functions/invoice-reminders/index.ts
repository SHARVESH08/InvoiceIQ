// Invoice reminders edge function — stub
// Phase 5 did not implement this function. When implemented, the query MUST
// include the email_reminders opt-out filter (PORTAL-05):
//
//   JOIN customer_profiles cp ON cp.email = invoices.customer_email
//   WHERE cp.email_reminders = true
//
// This ensures customers who toggled off reminders in /my/settings
// (stored in customer_profiles.email_reminders — added in migration 020)
// are excluded from reminder sends.
//
// See: src/app/(customer)/my/settings/_components/notification-settings.tsx
//      src/lib/actions/customer-settings.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (_req) => {
  // TODO: implement invoice reminder sends
  // REQUIRED: filter WHERE customer_profiles.email_reminders = true
  // JOIN: customer_profiles cp ON cp.email = invoices.customer_email
  return new Response(JSON.stringify({ status: 'not_implemented' }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
