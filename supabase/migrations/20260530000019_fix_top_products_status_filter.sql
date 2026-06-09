-- =============================================================================
-- InvoiceIQ — Migration 019: Fix get_top_products to exclude cancelled invoices
-- Problem: prior version joined only invoice_items, never filtered by invoice
--          payment_status — so cancelled invoices were counted as revenue.
-- Fix: join public.invoices and restrict to payment_status IN ('partial','paid')
--      for consistency with get_revenue_trend (migration 017/018).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_top_products(p_limit int DEFAULT 5)
  RETURNS TABLE(name text, revenue numeric)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 100, got %', p_limit;
  END IF;

  RETURN QUERY
  SELECT
    p.name,
    SUM(ii.unit_price * ii.quantity)::numeric AS revenue
  FROM public.invoice_items ii
  JOIN public.invoices inv ON inv.id = ii.invoice_id
  JOIN public.products p   ON p.id  = ii.product_id
  WHERE ii.company_id = public.get_company_id()
    AND inv.payment_status IN ('partial', 'paid')
  GROUP BY p.id, p.name
  ORDER BY SUM(ii.unit_price * ii.quantity) DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_products(int) TO authenticated;
