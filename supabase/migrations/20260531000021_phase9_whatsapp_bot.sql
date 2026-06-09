-- =============================================================================
-- InvoiceIQ — Migration 021: Phase 9 WhatsApp Bot
-- Applied after: 20260530000020_phase8_customer_portal.sql
--
-- Wave 0 schema gaps required by the WhatsApp Bot feature:
--   WA-03: companies.bot_code — START-{bot_code} routing
--   WA-05: whatsapp_sessions unique constraint — enables upsert onConflict
--   D-09:  last_processed_wamid — primary dedup column (session-level)
--   D-10:  invoices.source_wamid + partial unique index — invoice-level dedup
--   D-08:  pg_cron session TTL cleanup — nightly purge of expired sessions
--
-- All additive statements use IF NOT EXISTS / DO $$ ... $$ guards for idempotency.
-- =============================================================================

-- =============================================================================
-- SECTION 1: whatsapp_sessions — dedup column + unique constraint
-- =============================================================================

-- D-09: Add last_processed_wamid to track the most recently processed Message ID.
-- Edge Function checks this before processing each incoming message to skip retries.
ALTER TABLE public.whatsapp_sessions
  ADD COLUMN IF NOT EXISTS last_processed_wamid TEXT; -- D-09: primary dedup column

-- WA-05: Unique constraint on (company_id, customer_phone) enables the
-- upsert onConflict pattern: supabase.from('whatsapp_sessions').upsert({...},
-- { onConflict: 'company_id,customer_phone' }) to update existing sessions atomically.
-- Risk 3 mitigation: cross-tenant phone collision creates separate session rows
-- because company_id is part of the uniqueness tuple.
DO $$
BEGIN
  ALTER TABLE public.whatsapp_sessions
    ADD CONSTRAINT whatsapp_sessions_company_phone_unique
    UNIQUE (company_id, customer_phone); -- WA-05: enables upsert-on-conflict
EXCEPTION
  WHEN duplicate_object THEN NULL; -- idempotent: constraint already exists
END $$;

-- =============================================================================
-- SECTION 2: companies — bot_code column + back-fill
-- =============================================================================

-- WA-03: Add bot_code TEXT UNIQUE to companies. Each Retailer company gets a
-- unique short code (e.g. SHOP01) that customers include in START-{bot_code} messages.
-- T-9-03 (accept): bot_code is intentionally shareable — printed on retailer materials.
-- UNIQUE constraint prevents collision-based hijack.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS bot_code TEXT; -- WA-03: START-{bot_code} routing

-- Add unique constraint separately (IF NOT EXISTS not supported for UNIQUE in PG < 15)
DO $$
BEGIN
  ALTER TABLE public.companies
    ADD CONSTRAINT companies_bot_code_unique
    UNIQUE (bot_code); -- WA-03: collision prevention
EXCEPTION
  WHEN duplicate_object THEN NULL; -- idempotent
END $$;

-- WA-03: Back-fill NULL bot_code values for existing companies.
-- Generates an 8-char upper-case alphanumeric code from a random UUID.
-- Only updates rows without an existing bot_code to preserve manually set codes.
UPDATE public.companies
  SET bot_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  WHERE bot_code IS NULL; -- WA-03: auto-generate for existing tenants

-- =============================================================================
-- SECTION 3: invoices — source_wamid + partial unique index
-- =============================================================================

-- D-10: Add source_wamid to invoices for invoice-level dedup (second dedup layer).
-- Before creating a WhatsApp-triggered invoice, the Edge Function queries for an
-- existing invoice with source_wamid = <YES-confirm-wamid>; if found, re-sends
-- the existing payment link without creating a duplicate.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source_wamid TEXT; -- D-10: invoice-level dedup

-- T-9-02 mitigation: Partial unique index prevents Meta-retry double-insert at the
-- DB layer (defense-in-depth for D-09 session-level check).
-- WHERE source_wamid IS NOT NULL: regular invoices (no wamid) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_source_wamid_idx -- D-10, T-9-02
  ON public.invoices (source_wamid)
  WHERE source_wamid IS NOT NULL;

-- =============================================================================
-- SECTION 4: pg_cron — nightly session TTL cleanup
-- =============================================================================

-- D-08: Sessions expire after 30 minutes (expires_at refreshed on each message).
-- This nightly job purges rows whose expires_at is older than 1 hour, providing
-- a safety buffer beyond the 30-minute active TTL.
-- Runs at 2 AM daily. cron.schedule is idempotent (upserts by job name).
-- Pg_cron extension is enabled on all Supabase free-tier projects.
SELECT cron.schedule( -- D-08: nightly session TTL cleanup
  'whatsapp-session-cleanup',               -- job name (idempotent upsert)
  '0 2 * * *',                              -- daily at 02:00 UTC
  $$DELETE FROM public.whatsapp_sessions
    WHERE expires_at < now() - interval '1 hour'$$ -- D-08: prune expired sessions
);
