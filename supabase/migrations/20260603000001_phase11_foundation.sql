-- =============================================================================
-- InvoiceIQ — Migration 20260603000001: Phase 11 Foundation
-- Applied: supabase db push
-- Depends on: all prior migrations (001–019)
-- Purpose: AI chatbot + nightly summaries + pricing alerts + overdue reminders
-- =============================================================================

-- ─── BLOCK 1: pg_net extension ───────────────────────────────────────────────
-- pg_net provides net.http_post() used by pg_cron jobs to call Next.js route handlers.
-- MANUAL CHECK: if SELECT * FROM pg_extension WHERE extname = 'pg_net'; returns no rows,
-- enable pg_net via Supabase Dashboard → Database → Extensions before running supabase db push.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── BLOCK 2: companies.is_active column ─────────────────────────────────────
-- Required by AI chatbot to skip inactive companies in context building.
-- Soft-delete pattern: set is_active = false instead of hard deleting.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ─── BLOCK 3: nightly_summaries table ────────────────────────────────────────
-- Stores AI-generated nightly business summaries per company per date.
-- One summary per (company_id, summary_date) enforced by UNIQUE constraint.
-- data_snapshot stores raw metrics used to generate the summary (for audit/replay).

CREATE TABLE IF NOT EXISTS public.nightly_summaries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  summary_date  date        NOT NULL DEFAULT CURRENT_DATE,
  summary_text  text        NOT NULL,
  data_snapshot jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, summary_date)
);

ALTER TABLE public.nightly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nightly_summaries FORCE ROW LEVEL SECURITY;

-- Authenticated users can read summaries for their own company
CREATE POLICY "nightly_summaries_select_own_company"
  ON public.nightly_summaries
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT company_id
      FROM public.company_users
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- Service role can insert (nightly-summary route handler uses service role key)
CREATE POLICY "nightly_summaries_insert_service_role"
  ON public.nightly_summaries
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ─── BLOCK 4: pricing_monitor_categories table ───────────────────────────────
-- Companies register product categories to monitor for market price changes.
-- Brave Search API queries are built from these categories weekly.

CREATE TABLE IF NOT EXISTS public.pricing_monitor_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category    text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, category)
);

ALTER TABLE public.pricing_monitor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_monitor_categories FORCE ROW LEVEL SECURITY;

-- Authenticated users can read categories for their own company
CREATE POLICY "pricing_monitor_categories_select"
  ON public.pricing_monitor_categories
  FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT get_company_id())
  );

-- Authenticated users can insert categories for their own company
CREATE POLICY "pricing_monitor_categories_insert"
  ON public.pricing_monitor_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT get_company_id())
  );

-- Authenticated users can delete categories for their own company
CREATE POLICY "pricing_monitor_categories_delete"
  ON public.pricing_monitor_categories
  FOR DELETE
  TO authenticated
  USING (
    company_id = (SELECT get_company_id())
  );

-- ─── BLOCK 5: invoices.reminder_milestones_sent column ───────────────────────
-- Tracks which overdue-reminder milestones (days: 3, 7, 14) have been sent.
-- Example: {3,7} means 3-day and 7-day reminders have been emailed.
-- NOT NULL DEFAULT '{}' prevents NULL states that could bypass milestone checks.
-- Column is only writable server-side via service role in the cron handler (T-11-04).

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reminder_milestones_sent integer[] NOT NULL DEFAULT '{}';

-- ─── BLOCK 6: pg_cron job registrations ──────────────────────────────────────
-- Three cron jobs call Next.js route handlers via pg_net.
-- URLs and CRON_SECRET are hardcoded here (Supabase SQL editor cannot ALTER DATABASE).
-- Each registration is idempotent: unschedule first, then schedule.

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
          'Content-Type',    'application/json',
          'x-cron-secret',   current_setting('app.cron_secret')
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
          'Content-Type',    'application/json',
          'x-cron-secret',   current_setting('app.cron_secret')
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
          'Content-Type',    'application/json',
          'x-cron-secret',   current_setting('app.cron_secret')
        ),
        body    := '{}'::jsonb
      )
    $cmd$
  );
EXCEPTION WHEN others THEN NULL;
END $$;
