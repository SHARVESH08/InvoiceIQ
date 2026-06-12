-- Phase 3 (UI revamp): per-product pricing monitoring.
-- Replaces category-only monitoring with product-level rows. The weekly cron
-- still fetches one market price per category, but alerts per monitored product.

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

CREATE POLICY "pricing_monitor_products_select"
  ON public.pricing_monitor_products
  FOR SELECT TO authenticated
  USING (company_id = (SELECT get_company_id()));

CREATE POLICY "pricing_monitor_products_insert"
  ON public.pricing_monitor_products
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT get_company_id()));

CREATE POLICY "pricing_monitor_products_delete"
  ON public.pricing_monitor_products
  FOR DELETE TO authenticated
  USING (company_id = (SELECT get_company_id()));

-- Backfill: seed product-level monitoring from existing monitored categories so
-- current users keep their alerts. Mirrors the cron's old ILIKE category match.
INSERT INTO public.pricing_monitor_products (company_id, product_id)
SELECT DISTINCT p.company_id, p.id
FROM public.products p
JOIN public.pricing_monitor_categories c
  ON c.company_id = p.company_id
 AND p.category ILIKE '%' || c.category || '%'
ON CONFLICT (company_id, product_id) DO NOTHING;
