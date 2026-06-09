-- =============================================================================
-- InvoiceIQ — Migration 018: Phase 7 RPC Bounds Guards
-- Applied after: 20260528000017_phase7_dashboard_rpcs.sql
-- Fixes CR-02: get_revenue_trend had unbounded p_months — DoS via expensive generate_series
-- Fixes CR-03: get_top_products had unbounded p_limit — full table dump via LIMIT -1 or huge value
-- =============================================================================

-- =============================================================================
-- SECTION 1: get_revenue_trend — add p_months bounds check (1–60)
-- =============================================================================

-- CR-02: language changed from sql to plpgsql to allow RAISE EXCEPTION.
-- Guard clamps p_months to 1–60; values outside this range raise an error
-- rather than silently clamping so callers get clear feedback.
-- All other logic identical to migration 017.

CREATE OR REPLACE FUNCTION public.get_revenue_trend(p_months int DEFAULT 12)
  RETURNS TABLE(month text, revenue numeric)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF p_months < 1 OR p_months > 60 THEN
    RAISE EXCEPTION 'p_months must be between 1 and 60, got %', p_months;
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      (DATE_TRUNC('month', CURRENT_DATE) - ((p_months - 1) || ' months')::interval)::date,
      DATE_TRUNC('month', CURRENT_DATE)::date,
      '1 month'
    ) AS month_start
  )
  SELECT
    TO_CHAR(months.month_start, 'YYYY-MM') AS month,
    COALESCE(SUM(i.total_amount), 0)::numeric AS revenue
  FROM months
  LEFT JOIN public.invoices i
    ON DATE_TRUNC('month', i.invoice_date) = months.month_start
    AND i.company_id = public.get_company_id()
    AND i.payment_status IN ('partial', 'paid')
  GROUP BY months.month_start
  ORDER BY months.month_start ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_revenue_trend(int) TO authenticated;

-- =============================================================================
-- SECTION 2: get_top_products — add p_limit bounds check (1–100)
-- =============================================================================

-- CR-03: language changed from sql to plpgsql to allow RAISE EXCEPTION.
-- Guard rejects p_limit < 1 (LIMIT -1 means "no limit" in PostgreSQL) or > 100.
-- All other logic identical to migration 017.

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
    SUM(ii.unit_price * ii.quantity) AS revenue
  FROM public.invoice_items ii
  JOIN public.products p ON p.id = ii.product_id
  WHERE ii.company_id = public.get_company_id()
  GROUP BY p.id, p.name
  ORDER BY SUM(ii.unit_price * ii.quantity) DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_products(int) TO authenticated;
