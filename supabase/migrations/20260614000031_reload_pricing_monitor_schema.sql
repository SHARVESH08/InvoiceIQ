-- Fix: PostgREST's schema cache never picked up public.pricing_monitor_products
-- (created in 20260612000030). Every REST call to it returned
--   PGRST205 "Could not find the table 'public.pricing_monitor_products' in the
--   schema cache"
-- so the pricing-alert toggles failed with "Failed to enable alert/category"
-- even though the table, FKs and RLS policies exist in Postgres.
--
-- This migration re-asserts the object idempotently and forces a schema-cache
-- reload. Running it (or any DDL) also fires Supabase's pgrst_ddl_watch event
-- trigger, so a fresh `db reset`/deploy can't reproduce the stale cache.

CREATE TABLE IF NOT EXISTS public.pricing_monitor_products (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id  uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, product_id)
);

CREATE INDEX IF NOT EXISTS pricing_monitor_products_company_idx
  ON public.pricing_monitor_products (company_id);

ALTER TABLE public.pricing_monitor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_monitor_products FORCE ROW LEVEL SECURITY;

-- The root cause: the table had no GRANTs to the API roles, so PostgREST left
-- it out of the schema cache (PGRST205) no matter how often the cache reloaded.
GRANT SELECT, INSERT, DELETE ON TABLE public.pricing_monitor_products TO authenticated;
GRANT ALL ON TABLE public.pricing_monitor_products TO service_role;

-- Re-assert policies idempotently (drop-then-create is safe whether or not the
-- 20260612000030 policies were applied).
DROP POLICY IF EXISTS "pricing_monitor_products_select" ON public.pricing_monitor_products;
CREATE POLICY "pricing_monitor_products_select"
  ON public.pricing_monitor_products
  FOR SELECT TO authenticated
  USING (company_id = (SELECT get_company_id()));

DROP POLICY IF EXISTS "pricing_monitor_products_insert" ON public.pricing_monitor_products;
CREATE POLICY "pricing_monitor_products_insert"
  ON public.pricing_monitor_products
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_company_id()));

DROP POLICY IF EXISTS "pricing_monitor_products_delete" ON public.pricing_monitor_products;
CREATE POLICY "pricing_monitor_products_delete"
  ON public.pricing_monitor_products
  FOR DELETE TO authenticated
  USING (company_id = (SELECT get_company_id()));

-- Force PostgREST to rebuild its schema cache immediately.
NOTIFY pgrst, 'reload schema';
