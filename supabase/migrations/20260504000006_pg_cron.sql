-- =============================================================================
-- InvoiceIQ — Migration 006: pg_cron Heartbeat Job
-- Applied after: 20260504000005_rls.sql
-- Purpose: Prevent Supabase free-tier project pause (7-day inactivity threshold)
-- Schedule: Every 3 days at midnight UTC
-- Requires: pg_cron extension enabled in Supabase Dashboard before this runs
-- =============================================================================

SELECT cron.schedule(
  'invoiceiq-heartbeat',   -- job name (unique)
  '0 0 */3 * *',           -- every 3 days at 00:00 UTC
  $$ SELECT 1 $$           -- no-op: generates DB activity to reset inactivity timer
);
