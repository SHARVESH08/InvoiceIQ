-- =============================================================================
-- InvoiceIQ — Migration 010: Phase 3 Schema Gaps
-- Applied after: 20260506000009_invitations.sql
-- Purpose: Add columns required by Phase 3 CRUD for products, customers, suppliers.
--          Adds updated_at column + auto-update triggers on all three tables.
-- Threat mitigations:
--   T-03-01: IF NOT EXISTS on ADD COLUMN (idempotent); DROP TRIGGER IF EXISTS
--            before CREATE TRIGGER (idempotent); CREATE OR REPLACE on function.
-- =============================================================================

-- ─── products: add missing columns ───────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_price  numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_level   numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category        text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

-- ─── customers: add updated_at ───────────────────────────────────────────────

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ─── suppliers: add state_code and updated_at ────────────────────────────────

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS state_code text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ─── Trigger function: auto-update updated_at on UPDATE ──────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── Triggers: products, customers, suppliers ─────────────────────────────────
-- Use DROP TRIGGER IF EXISTS + CREATE TRIGGER for idempotency (compatible with
-- all Postgres versions deployed on Supabase free tier).

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS customers_updated_at ON public.customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS suppliers_updated_at ON public.suppliers;
CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
