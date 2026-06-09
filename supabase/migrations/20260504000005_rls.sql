-- =============================================================================
-- InvoiceIQ — Migration 005: Row Level Security
-- Applied after: 20260504000003_functions.sql (get_company_id must exist)
-- Depends on: public.get_company_id() function
-- Auth models:
--   Model A — company isolation: company_id = public.get_company_id()
--   Model B — cross-tenant customer read: customer_email = auth.email() OR phone match
-- =============================================================================

-- =============================================================================
-- SECTION 1: Company-scoped tables — Model A (company isolation)
-- 16 tables: companies, company_users, products, inventory, godowns, customers,
--            suppliers, invoices, invoice_items, payments, purchase_orders,
--            purchase_order_items, whatsapp_sessions, pricing_alerts,
--            gst_period_data, + invoice_sequences handled separately in section 3
-- =============================================================================

-- ─── companies ───────────────────────────────────────────────────────────────

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.companies
  FOR ALL
  USING      (id = (SELECT public.get_company_id()))
  WITH CHECK (id = (SELECT public.get_company_id()));

-- ─── company_users ───────────────────────────────────────────────────────────

ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.company_users
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- ─── products ────────────────────────────────────────────────────────────────

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.products
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- ─── inventory ───────────────────────────────────────────────────────────────

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.inventory
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- ─── godowns ─────────────────────────────────────────────────────────────────

ALTER TABLE public.godowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.godowns FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.godowns
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- ─── customers ───────────────────────────────────────────────────────────────

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.customers
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- ─── suppliers ───────────────────────────────────────────────────────────────

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.suppliers
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- ─── invoices ────────────────────────────────────────────────────────────────
-- Two policies: Model A (company isolation, ALL operations) + Model B (customer read, SELECT only)
-- A customer authenticated via Supabase Auth can read their own invoices across companies
-- using their email or phone from the JWT — without knowing which company issued the invoice.

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.invoices
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- Model B: cross-tenant customer read (D-06, AUTH-06)
-- Allows customers to fetch their own invoices via public payment links.
-- SELECT only — customers cannot INSERT/UPDATE/DELETE invoices.
-- Fix (CR-03): Added auth.uid() IS NOT NULL guard to explicitly exclude
-- unauthenticated (anon) sessions. Also added IS NOT NULL checks on the
-- invoice columns before the equality test — prevents fragile NULL = NULL
-- semantics if policy ever evolves to use IS NOT DISTINCT FROM.
CREATE POLICY "customer_read_own_invoices"
  ON public.invoices
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (customer_email IS NOT NULL AND customer_email = auth.email())
      OR (customer_phone IS NOT NULL AND customer_phone = (auth.jwt() ->> 'phone'))
    )
  );

-- ─── invoice_items ───────────────────────────────────────────────────────────
-- Two policies: Model A (company isolation, ALL operations) + Model B (customer read, SELECT only)
-- Fix (CR-05): Added Model B read policy so customers can see line items on their
-- own invoices. Without this, payment link flow was functionally broken — invoice
-- header was visible (via customer_read_own_invoices) but line items were not.

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.invoice_items
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- Model B: cross-tenant customer read — mirrors logic of customer_read_own_invoices
-- on invoices, but accessed via subquery join so we don't denormalize email/phone
-- onto invoice_items. SELECT only.
CREATE POLICY "customer_read_own_invoice_items"
  ON public.invoice_items
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.invoices inv
      WHERE inv.id = invoice_items.invoice_id
        AND (
          (inv.customer_email IS NOT NULL AND inv.customer_email = auth.email())
          OR (inv.customer_phone IS NOT NULL AND inv.customer_phone = (auth.jwt() ->> 'phone'))
        )
    )
  );

-- ─── payments ────────────────────────────────────────────────────────────────

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.payments
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- ─── purchase_orders ─────────────────────────────────────────────────────────

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.purchase_orders
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- ─── purchase_order_items ────────────────────────────────────────────────────

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.purchase_order_items
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- ─── whatsapp_sessions ───────────────────────────────────────────────────────

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.whatsapp_sessions
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- ─── pricing_alerts ──────────────────────────────────────────────────────────

ALTER TABLE public.pricing_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_alerts FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.pricing_alerts
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- ─── gst_period_data ─────────────────────────────────────────────────────────

ALTER TABLE public.gst_period_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gst_period_data FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation"
  ON public.gst_period_data
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- =============================================================================
-- SECTION 2: audit_log — append-only, no regular-user read
-- ENABLE+FORCE RLS. Zero policies for regular users.
-- Fix (CR-02): The original INSERT policy WITH CHECK (true) allowed any
-- authenticated user to directly forge arbitrary audit records. Removed.
-- The audit_log_trigger() function is SECURITY DEFINER — it runs as the
-- function owner and bypasses RLS entirely. No INSERT policy is needed for
-- the trigger path. Zero policies + FORCE RLS is the correct final state:
-- only service_role and SECURITY DEFINER functions can write to audit_log.
-- =============================================================================

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

-- No policies intentionally. Zero rows returned/written for any direct user query.
-- All writes flow through audit_log_trigger() SECURITY DEFINER (bypasses RLS).

-- =============================================================================
-- SECTION 3: customer_profiles — cross-tenant, user_id = auth.uid()
-- No company_id column. Users own their own profile row only.
-- =============================================================================

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "own_profile_only"
  ON public.customer_profiles
  FOR ALL
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- SECTION 4: invoice_sequences — ENABLE+FORCE RLS, NO direct-access policies
-- Only generate_invoice_number() (SECURITY DEFINER) reads/writes this table.
-- service_role (server-side only) bypasses RLS. Regular users have no path here.
-- =============================================================================

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences FORCE ROW LEVEL SECURITY;

-- No policies intentionally. Zero rows returned for any direct user query.
