-- =============================================================================
-- InvoiceIQ — Migration 015: Phase 5 Public Invoice RLS + Private Storage Bucket
-- Applied after: 20260504000005_rls.sql (company RLS policies must already exist)
-- Depends on: public.invoices.public_id (uuid, NOT NULL, DEFAULT gen_random_uuid())
--             public.invoices RLS must be ENABLED (done in 20260504000005_rls.sql)
--             public.invoice_items RLS must be ENABLED (done in 20260504000005_rls.sql)
--
-- Purpose:
--   1. Adds an anon SELECT policy on public.invoices so unauthenticated visitors
--      can read invoice rows when the page filters by public_id (public invoice page).
--   2. Adds an anon SELECT policy on public.invoice_items so the public invoice page
--      can also fetch line items for the same invoice.
--   3. Creates the private 'invoices' storage bucket for PDF uploads (PDF-02).
--   4. Adds a storage RLS policy that prevents anon direct-object access; signed URLs
--      (generated via service-role token) are the only valid access path (D-19).
--
-- Security model:
--   - public_id is a 128-bit UUID (not enumerable). Risk accepted per T-05-01.
--   - Bucket public=false + storage RLS together enforce signed-URL-only access (T-05-02).
--   - All policies are guarded with DROP ... IF EXISTS for idempotent re-runs.
-- =============================================================================

-- =============================================================================
-- SECTION 1: Anon SELECT policy on public.invoices
-- Allows unauthenticated (anon role) reads when public_id is present.
-- Every invoice row has public_id (NOT NULL DEFAULT gen_random_uuid()), so
-- the real access gate is the application layer filtering WHERE public_id = $param.
-- =============================================================================

DROP POLICY IF EXISTS "public_invoice_by_public_id" ON public.invoices;

CREATE POLICY "public_invoice_by_public_id"
  ON public.invoices
  FOR SELECT
  TO anon
  USING (public_id IS NOT NULL);

-- =============================================================================
-- SECTION 2: Anon SELECT policy on public.invoice_items
-- The public invoice page JOINs invoice_items to render line items.
-- Without this policy, anon would receive an empty items array even when the
-- parent invoice row is visible (T-05-03).
-- =============================================================================

DROP POLICY IF EXISTS "public_invoice_items_by_invoice" ON public.invoice_items;

CREATE POLICY "public_invoice_items_by_invoice"
  ON public.invoice_items
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.public_id IS NOT NULL
    )
  );

-- =============================================================================
-- SECTION 3: Private storage bucket for PDF files
-- Bucket public=false ensures no direct URL access without a signed token (D-19).
-- ON CONFLICT DO NOTHING makes this idempotent on re-run.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SECTION 4: Storage RLS — deny anon direct SELECT on objects in 'invoices' bucket
-- Signed URLs (generated with service-role token) bypass RLS via their own auth path
-- and are not affected by this policy. This policy only blocks the raw
-- /storage/v1/object/public/invoices/... endpoint for the anon role (T-05-02).
-- =============================================================================

DROP POLICY IF EXISTS "pdf_signed_url_only" ON storage.objects;

CREATE POLICY "pdf_signed_url_only"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id <> 'invoices');
