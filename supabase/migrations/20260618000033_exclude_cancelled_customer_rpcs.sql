-- =============================================================================
-- InvoiceIQ — Migration 033: exclude cancelled invoices from customer spend RPCs
--
-- cancelInvoice() only sets status='cancelled' and never resets payment_status,
-- so a cancelled invoice keeps payment_status 'unpaid'/'partial'. The customer
-- spend RPCs filtered payment_status IN ('partial','paid') WITHOUT excluding
-- cancelled, so a cancelled-partial invoice wrongly counted toward the customer's
-- spend KPIs / trend / by-merchant totals. Add `status != 'cancelled'` — matching
-- the P&L RPC and the page-level invoice queries. Carries forward the
-- case-insensitive email + phone fallback matching from migration 032.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_customer_kpis()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'mtd',            COALESCE(SUM(CASE
                        WHEN DATE_TRUNC('month', invoice_date) = DATE_TRUNC('month', CURRENT_DATE)
                        THEN total_amount ELSE 0 END), 0),
    'ytd',            COALESCE(SUM(CASE
                        WHEN EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                        THEN total_amount ELSE 0 END), 0),
    'all_time',       COALESCE(SUM(total_amount), 0),
    'merchant_count', COUNT(DISTINCT company_id)
  )
  FROM public.invoices
  WHERE (
      (customer_email IS NOT NULL AND LOWER(customer_email) = LOWER(auth.email()))
      OR (customer_phone IS NOT NULL AND customer_phone = (auth.jwt() ->> 'phone'))
    )
    AND status != 'cancelled'
    AND payment_status IN ('partial', 'paid');
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_kpis() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_customer_spend_trend(p_months int DEFAULT 12)
  RETURNS TABLE(month text, spend numeric)
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
    COALESCE(SUM(i.total_amount), 0)::numeric AS spend
  FROM months
  LEFT JOIN public.invoices i
    ON DATE_TRUNC('month', i.invoice_date) = months.month_start
    AND (
      (i.customer_email IS NOT NULL AND LOWER(i.customer_email) = LOWER(auth.email()))
      OR (i.customer_phone IS NOT NULL AND i.customer_phone = (auth.jwt() ->> 'phone'))
    )
    AND i.status != 'cancelled'
    AND i.payment_status IN ('partial', 'paid')
  GROUP BY months.month_start
  ORDER BY months.month_start ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_spend_trend(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_customer_spend_by_merchant()
  RETURNS TABLE(merchant text, total numeric)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT
    c.name AS merchant,
    SUM(i.total_amount) AS total
  FROM public.invoices i
  JOIN public.companies c ON c.id = i.company_id
  WHERE (
      (i.customer_email IS NOT NULL AND LOWER(i.customer_email) = LOWER(auth.email()))
      OR (i.customer_phone IS NOT NULL AND i.customer_phone = (auth.jwt() ->> 'phone'))
    )
    AND i.status != 'cancelled'
    AND i.payment_status IN ('partial', 'paid')
  GROUP BY c.id, c.name
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_spend_by_merchant() TO authenticated;

NOTIFY pgrst, 'reload schema';
