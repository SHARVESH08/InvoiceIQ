-- =============================================================================
-- InvoiceIQ — Migration 032: Customer invoice matching — case-insensitive email
--                            + phone fallback applied consistently everywhere.
--
-- Customers see invoices across all businesses by IDENTITY MATCH on the invoice's
-- customer_email / customer_phone (Model B). Two gaps fixed here:
--
--   1. Email matched case-sensitively (customer_email = auth.email()). Emails are
--      case-insensitive, so 'Foo@x.com' on an invoice didn't match a login of
--      'foo@x.com'. Now LOWER(customer_email) = LOWER(auth.email()).
--
--   2. The phone fallback existed only in the RLS policies, NOT in the customer
--      KPI/spend RPCs (they matched email only). So an invoice matched by phone
--      (different/typo'd email) appeared in the invoice list but was excluded from
--      the spend totals/charts — the numbers disagreed. The RPCs now use the same
--      email-or-phone predicate as the RLS, so everything is consistent.
--
-- No widening of access: both branches still compare only against the caller's own
-- auth.email() / auth.jwt()->>'phone'. NULL guards preserved (no NULL = NULL match).
--
-- A functional index on LOWER(customer_email) keeps the case-insensitive lookup off
-- a sequential scan (the existing raw idx_invoices_customer_email can't serve it).
-- =============================================================================

-- ─── Functional index for the case-insensitive email predicate ───────────────
CREATE INDEX IF NOT EXISTS idx_invoices_customer_email_lower
  ON public.invoices (LOWER(customer_email));

-- ─── RLS: invoices — Model B customer read ───────────────────────────────────
DROP POLICY IF EXISTS customer_read_own_invoices ON public.invoices;
CREATE POLICY "customer_read_own_invoices"
  ON public.invoices
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (customer_email IS NOT NULL AND LOWER(customer_email) = LOWER(auth.email()))
      OR
      (customer_phone IS NOT NULL AND customer_phone = (auth.jwt() ->> 'phone'))
    )
  );

-- ─── RLS: invoice_items — Model B customer read (mirrors invoices) ────────────
DROP POLICY IF EXISTS customer_read_own_invoice_items ON public.invoice_items;
CREATE POLICY "customer_read_own_invoice_items"
  ON public.invoice_items
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.invoices inv
      WHERE inv.id = invoice_id
        AND (
          (inv.customer_email IS NOT NULL AND LOWER(inv.customer_email) = LOWER(auth.email()))
          OR
          (inv.customer_phone IS NOT NULL AND inv.customer_phone = (auth.jwt() ->> 'phone'))
        )
    )
  );

-- ─── RPC: get_customer_kpis — add phone fallback + CI email ───────────────────
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
    AND payment_status IN ('partial', 'paid');
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_kpis() TO authenticated;

-- ─── RPC: get_customer_spend_trend — add phone fallback + CI email ────────────
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
    AND i.payment_status IN ('partial', 'paid')
  GROUP BY months.month_start
  ORDER BY months.month_start ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_spend_trend(int) TO authenticated;

-- ─── RPC: get_customer_spend_by_merchant — add phone fallback + CI email ──────
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
    AND i.payment_status IN ('partial', 'paid')
  GROUP BY c.id, c.name
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_spend_by_merchant() TO authenticated;

-- Force PostgREST to reload the schema cache (RPC signatures unchanged, but safe).
NOTIFY pgrst, 'reload schema';
