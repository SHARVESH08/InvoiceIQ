-- =============================================================================
-- InvoiceIQ — Migration 023: Reschedule pg_cron jobs WITHOUT a hardcoded secret
--
-- SEC-01 fix (v1.0 integration audit). Migration 20260603000002 originally
-- embedded the CRON_SECRET (and the deploy URL) in plaintext inside the
-- cron.schedule command strings — which committed the secret to git. That secret
-- is now considered compromised and MUST be rotated.
--
-- This migration unschedules the 3 jobs and reschedules them to resolve BOTH the
-- secret and the base URL from database settings at cron-execution time, so no
-- secret ever appears in a migration or in the cron.job table.
--
-- PREREQUISITES — create these Vault secrets on the remote DB BEFORE applying
-- (one-time, via Supabase SQL Editor — managed Supabase forbids ALTER DATABASE):
--   select vault.create_secret('<NEW-rotated-secret>', 'cron_secret');
--   select vault.create_secret('https://<your-vercel-domain>', 'next_url');
-- The cron jobs read them at runtime from vault.decrypted_secrets (postgres can
-- decrypt). Set the SAME new value as CRON_SECRET in the Vercel project env vars.
-- =============================================================================

-- Job 1: Nightly summary — 8:30 PM UTC = 2:00 AM IST
DO $$ BEGIN PERFORM cron.unschedule('invoiceiq-nightly-summary'); EXCEPTION WHEN others THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.schedule(
    'invoiceiq-nightly-summary',
    '30 20 * * *',
    $cmd$
      SELECT net.http_post(
        url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'next_url') || '/api/cron/nightly-summary',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body    := '{}'::jsonb
      )
    $cmd$
  );
EXCEPTION WHEN others THEN NULL;
END $$;

-- Job 2: Overdue reminders — 4:00 AM UTC = 9:30 AM IST
DO $$ BEGIN PERFORM cron.unschedule('invoiceiq-overdue-reminders'); EXCEPTION WHEN others THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.schedule(
    'invoiceiq-overdue-reminders',
    '0 4 * * *',
    $cmd$
      SELECT net.http_post(
        url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'next_url') || '/api/cron/overdue-reminders',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body    := '{}'::jsonb
      )
    $cmd$
  );
EXCEPTION WHEN others THEN NULL;
END $$;

-- Job 3: Pricing alerts — 9:30 PM UTC Sunday = 3:00 AM IST Monday
DO $$ BEGIN PERFORM cron.unschedule('invoiceiq-pricing-alerts'); EXCEPTION WHEN others THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.schedule(
    'invoiceiq-pricing-alerts',
    '30 21 * * 0',
    $cmd$
      SELECT net.http_post(
        url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'next_url') || '/api/cron/pricing-alerts',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body    := '{}'::jsonb
      )
    $cmd$
  );
EXCEPTION WHEN others THEN NULL;
END $$;
