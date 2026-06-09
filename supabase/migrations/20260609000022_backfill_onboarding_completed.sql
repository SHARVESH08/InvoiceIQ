-- =============================================================================
-- InvoiceIQ — Migration 022: Backfill onboarding_completed for pre-existing companies
--
-- Problem: Migration 20260608000021 added companies.onboarding_completed with
--          NOT NULL DEFAULT false and no backfill. The Phase 13 middleware
--          onboarding guard (src/middleware.ts) then force-redirects every
--          business user whose company has onboarding_completed = false to
--          /onboarding?step=1 — trapping all accounts that existed before the
--          onboarding feature shipped (they never went through, and shouldn't).
--
-- Fix: Grandfather every company that exists at the time this migration runs as
--      already onboarded. Genuinely new registrations created AFTER this
--      migration still default to false and flow through onboarding correctly.
-- =============================================================================

UPDATE public.companies
SET onboarding_completed = true,
    onboarding_step = 4
WHERE onboarding_completed = false;
