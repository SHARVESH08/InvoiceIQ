-- =============================================================================
-- InvoiceIQ — Migration 020: Phase 8 Customer Portal
-- Applied after: 20260530000019_fix_top_products_status_filter.sql
--
-- PORTAL-02 disambiguation: 'spend by category' = spend by merchant name (D-04 in
-- 08-CONTEXT.md). get_customer_spend_by_merchant() covers this requirement entirely;
-- no category taxonomy RPC is needed.
--
-- Cross-AI review feedback (08-REVIEW-FIX.md):
--   MEDIUM: idx_invoices_customer_email added — prevents full-table scan on
--   customer_email = auth.email() filter as invoices table grows.
-- =============================================================================

-- =============================================================================
-- SECTION 1: email_reminders column on customer_profiles
-- =============================================================================

-- PORTAL-05: Add email_reminders boolean column. IF NOT EXISTS makes migration
-- idempotent — safe to re-run. DEFAULT true: customers are opted in by default.
-- NO new RLS policies: customer_read_own_invoices already deployed in migration 005
-- with USING (auth.uid() IS NOT NULL AND (customer_email = auth.email() OR ...)).

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS email_reminders boolean NOT NULL DEFAULT true;

-- =============================================================================
-- SECTION 2: get_customer_kpis() — MTD/YTD/all-time spend + merchant count
-- =============================================================================

-- PORTAL-02, T-8-01: Returns spend KPIs for the authenticated customer.
-- Scoped by auth.email() — unauthenticated call returns all zeros (NULL comparison
-- evaluates false). customer_email IS NOT NULL guard prevents NULL = NULL edge cases.
-- Filters payment_status IN ('partial', 'paid') — counts only settled spend (A1 assumption).
-- LANGUAGE sql sufficient — no bounds check needed (no user-supplied int param).

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
  WHERE customer_email IS NOT NULL
    AND customer_email = auth.email()
    AND payment_status IN ('partial', 'paid');
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_kpis() TO authenticated;

-- =============================================================================
-- SECTION 3: get_customer_spend_trend(p_months int) — monthly spend time series
-- =============================================================================

-- PORTAL-02, T-8-01: Returns p_months rows of (month YYYY-MM, spend numeric).
-- Zero-fill via generate_series LEFT JOIN — months with no spend return 0.
-- Mirrors get_revenue_trend from migration 018 but joins on auth.email() not company_id.
-- Bounds guard (1–60) matches Phase 7 pattern from migration 018.

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
    AND i.customer_email IS NOT NULL
    AND i.customer_email = auth.email()
    AND i.payment_status IN ('partial', 'paid')
  GROUP BY months.month_start
  ORDER BY months.month_start ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_spend_trend(int) TO authenticated;

-- =============================================================================
-- SECTION 4: get_customer_spend_by_merchant() — spend by merchant name
-- =============================================================================

-- PORTAL-02, D-04, T-8-01: Returns (merchant text, total numeric) ordered by total DESC.
-- "Spend by category" = spend by merchant name per D-04 disambiguation above.
-- Joins companies table on company_id to get merchant display name.
-- Same auth.email() + IS NOT NULL guard as KPIs and trend RPCs.

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
  WHERE i.customer_email IS NOT NULL
    AND i.customer_email = auth.email()
    AND i.payment_status IN ('partial', 'paid')
  GROUP BY c.id, c.name
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_spend_by_merchant() TO authenticated;

-- =============================================================================
-- SECTION 5: Performance index
-- =============================================================================

-- Cross-AI review feedback (MEDIUM): Without this index, every customer RPC and
-- the invoice SELECT in /my/page.tsx performs a full sequential scan on invoices
-- for the customer_email = auth.email() predicate. As the invoices table grows,
-- this becomes a significant performance problem. CREATE INDEX IF NOT EXISTS is
-- idempotent — safe to re-run.

CREATE INDEX IF NOT EXISTS idx_invoices_customer_email
  ON public.invoices(customer_email);
