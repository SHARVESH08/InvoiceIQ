-- =============================================================================
-- InvoiceIQ — Migration 017: Phase 7 Dashboard RPCs
-- Applied after: 20260525000016_phase6_inventory.sql
-- Incorporates cross-AI review feedback (07-REVIEWS.md):
--   MEDIUM: get_revenue_trend returns YYYY-MM (chronologically sortable) — Gemini MEDIUM concern
--   MEDIUM: generate_series ensures zero-revenue months emitted as revenue=0 rows — Gemini suggestion
-- =============================================================================

-- =============================================================================
-- SECTION 1: get_company_context()
-- =============================================================================

-- RPC 1: get_company_context() — returns company_id, company_type, user_role for auth user
-- D-02: single round-trip for all dashboard context. SECURITY DEFINER + search_path = ''
-- prevents search-path injection. WHERE cu.user_id = auth.uid() scopes to caller only.
-- T-07-01: mitigated — only caller's own row returned; company_users RLS is second boundary.

CREATE OR REPLACE FUNCTION public.get_company_context()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'company_id',   cu.company_id,
    'company_type', c.company_type,
    'user_role',    cu.role
  )
  FROM public.company_users cu
  JOIN public.companies c ON c.id = cu.company_id
  WHERE cu.user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_context() TO authenticated;

-- =============================================================================
-- SECTION 2: get_revenue_trend(p_months int)
-- =============================================================================

-- RPC 2: get_revenue_trend(p_months int DEFAULT 12)
-- D-05, D-06: Returns monthly revenue rows for the past p_months months.
-- Month column is YYYY-MM format (chronologically sortable — addresses Gemini MEDIUM concern).
-- Zero-revenue months emitted as revenue=0 rows via generate_series (addresses Gemini suggestion).
-- Filters payment_status IN ('partial', 'paid') — invoices has no doc_type column (schema fact).
-- T-07-02: mitigated — scoped via public.get_company_id(); unauthenticated call returns empty set.

CREATE OR REPLACE FUNCTION public.get_revenue_trend(p_months int DEFAULT 12)
  RETURNS TABLE(month text, revenue numeric)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.get_revenue_trend(int) TO authenticated;

-- =============================================================================
-- SECTION 3: get_top_products(p_limit int)
-- =============================================================================

-- RPC 3: get_top_products(p_limit int DEFAULT 5)
-- D-05, D-07: Returns top p_limit products by sum(unit_price * quantity) DESC.
-- unit_price is numeric(12,2) in rupees — SUM(unit_price * quantity) gives rupees.
-- SUM in ORDER BY (not alias) to avoid SQL column-reference error.
-- T-07-02: mitigated — scoped via public.get_company_id().

CREATE OR REPLACE FUNCTION public.get_top_products(p_limit int DEFAULT 5)
  RETURNS TABLE(name text, revenue numeric)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT
    p.name,
    SUM(ii.unit_price * ii.quantity) AS revenue
  FROM public.invoice_items ii
  JOIN public.products p ON p.id = ii.product_id
  WHERE ii.company_id = public.get_company_id()
  GROUP BY p.id, p.name
  ORDER BY SUM(ii.unit_price * ii.quantity) DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_products(int) TO authenticated;

-- =============================================================================
-- SECTION 4: get_payment_mode_split()
-- =============================================================================

-- RPC 4: get_payment_mode_split()
-- D-05: Returns one row per payment_method with count and total.
-- payment_method enum: 'cash' | 'upi' | 'bank_transfer' | 'razorpay' | 'cheque'
-- T-07-02: mitigated — scoped via public.get_company_id().

CREATE OR REPLACE FUNCTION public.get_payment_mode_split()
  RETURNS TABLE(mode text, count bigint, total numeric)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT
    payment_method AS mode,
    COUNT(*)        AS count,
    SUM(amount)     AS total
  FROM public.payments
  WHERE company_id = public.get_company_id()
  GROUP BY payment_method
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_mode_split() TO authenticated;

-- =============================================================================
-- SECTION 5: Realtime publication guard for invoices table
-- =============================================================================

-- Ensures invoices INSERT events reach Realtime subscribers (DASH-05/D-09).
-- Wrapped in DO $$ EXCEPTION block for idempotency — safe to re-run migration.
-- T-07-03: mitigated — Supabase Realtime respects RLS on postgres_changes; this enables
-- the subscription, while company_users RLS remains the authoritative security boundary.

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
