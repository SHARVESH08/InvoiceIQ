-- =============================================================================
-- InvoiceIQ — Migration 034: revenue/P&L RPCs recognise only ISSUED sales.
--
-- Status-handling sweep follow-up. Two gaps:
--   1. get_revenue_trend / get_top_products filtered payment_status IN
--      ('partial','paid') but NOT status — so a cancelled-partial invoice leaked
--      into the dashboard revenue chart + top products (same bug already fixed in
--      the page-level queries and the P&L RPC).
--   2. Revenue should be recognised when an invoice is ISSUED (sent), not while
--      it is a draft. get_pnl_summary excluded cancelled but still counted drafts.
--
-- Fix: every revenue/COGS aggregation now excludes status IN ('draft','cancelled')
-- — i.e. only sent/overdue/paid sales count. (doc_type filtering of the trend RPC
-- is intentionally left unchanged here.)
-- =============================================================================

-- ─── get_revenue_trend — exclude draft + cancelled ───────────────────────────
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
    COALESCE(SUM(i.taxable_amount), 0)::numeric AS revenue
  FROM months
  LEFT JOIN public.invoices i
    ON DATE_TRUNC('month', i.invoice_date) = months.month_start
    AND i.company_id = public.get_company_id()
    AND i.status NOT IN ('draft', 'cancelled')
    AND i.payment_status IN ('partial', 'paid')
  GROUP BY months.month_start
  ORDER BY months.month_start ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_revenue_trend(int) TO authenticated;

-- ─── get_top_products — exclude draft + cancelled ────────────────────────────
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
    SUM(ii.taxable_amount)::numeric AS revenue
  FROM public.invoice_items ii
  JOIN public.invoices inv ON inv.id = ii.invoice_id
  JOIN public.products p   ON p.id  = ii.product_id
  WHERE ii.company_id = public.get_company_id()
    AND inv.status NOT IN ('draft', 'cancelled')
    AND inv.payment_status IN ('partial', 'paid')
  GROUP BY p.id, p.name
  ORDER BY SUM(ii.taxable_amount) DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_products(int) TO authenticated;

-- ─── get_pnl_summary — exclude draft (already excluded cancelled) ─────────────
CREATE OR REPLACE FUNCTION public.get_pnl_summary(
  p_company_id uuid,
  p_from       date,
  p_to         date
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_revenue numeric(15,2);
  v_cogs    numeric(15,2);
BEGIN
  IF p_company_id <> public.get_company_id() THEN
    RAISE EXCEPTION 'Company mismatch';
  END IF;

  SELECT COALESCE(SUM(taxable_amount), 0)
  INTO v_revenue
  FROM public.invoices
  WHERE company_id   = p_company_id
    AND doc_type     = 'sale'
    AND status NOT IN ('draft', 'cancelled')
    AND invoice_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(ii.quantity * p.purchase_price), 0)
  INTO v_cogs
  FROM public.invoice_items ii
  JOIN public.invoices inv ON inv.id = ii.invoice_id
  JOIN public.products p   ON p.id  = ii.product_id
  WHERE inv.company_id   = p_company_id
    AND inv.doc_type     = 'sale'
    AND inv.status NOT IN ('draft', 'cancelled')
    AND inv.invoice_date BETWEEN p_from AND p_to;

  RETURN jsonb_build_object(
    'revenue',      v_revenue,
    'cogs',         v_cogs,
    'gross_margin', v_revenue - v_cogs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pnl_summary(uuid, date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
