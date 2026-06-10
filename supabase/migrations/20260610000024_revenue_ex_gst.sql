-- =============================================================================
-- InvoiceIQ — Migration 024: Revenue metrics = net of GST (taxable_amount)
--
-- "Revenue" should EXCLUDE GST (tax collected is a liability owed to the
-- government, not income) and be net of discounts. Previously the two revenue
-- RPCs were inconsistent:
--   - get_revenue_trend summed invoices.total_amount   (INCL GST)
--   - get_top_products summed unit_price * quantity      (pre-tax AND pre-discount)
-- Both now sum taxable_amount (ex-GST, post-discount). All bounds guards, the
-- invoices join, and the paid/partial payment_status filter are preserved.
-- (Revenue This Month + Top Distributors are switched to taxable_amount in the
--  dashboard page query to match.)
-- =============================================================================

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
    AND i.payment_status IN ('partial', 'paid')
  GROUP BY months.month_start
  ORDER BY months.month_start ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_revenue_trend(int) TO authenticated;

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
    AND inv.payment_status IN ('partial', 'paid')
  GROUP BY p.id, p.name
  ORDER BY SUM(ii.taxable_amount) DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_products(int) TO authenticated;
