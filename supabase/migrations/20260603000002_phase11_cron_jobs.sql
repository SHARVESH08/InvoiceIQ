-- =============================================================================
-- InvoiceIQ — Migration 20260603000002: Phase 11 pg_cron job registrations
-- Applied: supabase db push
-- Purpose: Register 3 pg_cron jobs that call Next.js cron route handlers.
--          Separated from 20260603000001 because that migration errored on
--          the cron DO blocks (nested $$ delimiter conflict) and was recorded
--          as applied by Supabase before the cron jobs were registered.
-- =============================================================================

-- Job 1: Nightly summary — 8:30 PM UTC = 2:00 AM IST
DO $$
BEGIN
  PERFORM cron.unschedule('invoiceiq-nightly-summary');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'invoiceiq-nightly-summary',
    '30 20 * * *',
    $cmd$
      SELECT net.http_post(
        url     := current_setting('app.next_url') || '/api/cron/nightly-summary',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'x-cron-secret', current_setting('app.cron_secret')
        ),
        body    := '{}'::jsonb
      )
    $cmd$
  );
EXCEPTION WHEN others THEN NULL;
END $$;

-- Job 2: Overdue reminders — 4:00 AM UTC = 9:30 AM IST
DO $$
BEGIN
  PERFORM cron.unschedule('invoiceiq-overdue-reminders');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'invoiceiq-overdue-reminders',
    '0 4 * * *',
    $cmd$
      SELECT net.http_post(
        url     := current_setting('app.next_url') || '/api/cron/overdue-reminders',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'x-cron-secret', current_setting('app.cron_secret')
        ),
        body    := '{}'::jsonb
      )
    $cmd$
  );
EXCEPTION WHEN others THEN NULL;
END $$;

-- Job 3: Pricing alerts — 9:30 PM UTC Sunday = 3:00 AM IST Monday
DO $$
BEGIN
  PERFORM cron.unschedule('invoiceiq-pricing-alerts');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'invoiceiq-pricing-alerts',
    '30 21 * * 0',
    $cmd$
      SELECT net.http_post(
        url     := current_setting('app.next_url') || '/api/cron/pricing-alerts',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'x-cron-secret', current_setting('app.cron_secret')
        ),
        body    := '{}'::jsonb
      )
    $cmd$
  );
EXCEPTION WHEN others THEN NULL;
END $$;
