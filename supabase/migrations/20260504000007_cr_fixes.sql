-- =============================================================================
-- InvoiceIQ — Migration 007: Corrective fixes CR-01..CR-05, WR-01..WR-03
-- Applied after: 20260504000006_pg_cron.sql
-- Purpose: Patch live DB to match fixed versions of 003_functions and 005_rls.
--          Migrations 001-006 are already applied; this file contains only diffs.
-- =============================================================================

-- ─── CR-01: Rewrite get_company_id() — query company_users, not JWT claim ────────
-- auth.jwt() ->> 'company_id' is never populated by Supabase automatically.
-- The original function returned NULL for every user, breaking all Model A policies.

CREATE OR REPLACE FUNCTION public.get_company_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT company_id
  FROM public.company_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- ─── WR-01: Add company membership guard to generate_invoice_number() ─────────────
-- Any authenticated user could previously increment another company's invoice sequence.

CREATE OR REPLACE FUNCTION public.generate_invoice_number(
  p_company_id uuid,
  p_date       date DEFAULT CURRENT_DATE
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_fy  text;
  v_seq integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id
      AND user_id    = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of company %', p_company_id;
  END IF;

  v_fy := public.get_indian_fy(p_date);

  INSERT INTO public.invoice_sequences (company_id, fy, last_seq)
  VALUES (p_company_id, v_fy, 0)
  ON CONFLICT (company_id, fy) DO NOTHING;

  UPDATE public.invoice_sequences
  SET last_seq = last_seq + 1
  WHERE company_id = p_company_id
    AND fy         = v_fy
  RETURNING last_seq INTO v_seq;

  RETURN 'INV/' || v_fy || '/' || LPAD(v_seq::text, 4, '0');
END;
$$;

-- ─── CR-04: Rewrite decrement_inventory_on_invoice_item() ────────────────────────
-- Original queried by (product_id, company_id) — UNIQUE constraint is (product_id,
-- godown_id). Multi-godown companies got TOO_MANY_ROWS on every invoice line item.
-- Fix: join through godowns WHERE is_default = true.

CREATE OR REPLACE FUNCTION public.decrement_inventory_on_invoice_item()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_inventory public.inventory%ROWTYPE;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT i.* INTO v_inventory
  FROM public.inventory i
  JOIN public.godowns g ON g.id = i.godown_id
  WHERE i.product_id  = NEW.product_id
    AND i.company_id  = NEW.company_id
    AND g.is_default  = true
  LIMIT 1
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'No inventory record found for product % in the default godown of company %',
      NEW.product_id, NEW.company_id;
  END IF;

  IF v_inventory.quantity < NEW.quantity THEN
    RAISE EXCEPTION
      'Insufficient stock for product %. Available: %, Requested: %',
      NEW.product_id, v_inventory.quantity, NEW.quantity;
  END IF;

  UPDATE public.inventory
  SET quantity   = quantity - NEW.quantity,
      updated_at = now()
  WHERE id = v_inventory.id;

  RETURN NEW;
END;
$$;

-- ─── WR-02: Remove audit trigger on invoice_sequences ────────────────────────────
-- Counter table — auditing every increment is noise with no security value.
DROP TRIGGER IF EXISTS audit_invoice_sequences ON public.invoice_sequences;

-- ─── WR-03: Partial unique index — one default godown per company ─────────────────
-- Required by CR-04 fix: LIMIT 1 is only safe when at most one default exists.
CREATE UNIQUE INDEX IF NOT EXISTS idx_godowns_one_default_per_company
  ON public.godowns (company_id)
  WHERE is_default = true;

-- ─── CR-02: Remove audit_log INSERT policy ────────────────────────────────────────
-- WITH CHECK (true) let any authenticated user forge audit records directly.
-- The SECURITY DEFINER audit_log_trigger bypasses RLS — no INSERT policy needed.
DROP POLICY IF EXISTS audit_log_insert_only ON public.audit_log;

-- ─── CR-03: Replace Model B invoice policy — add NULL guards ─────────────────────
DROP POLICY IF EXISTS customer_read_own_invoices ON public.invoices;

CREATE POLICY "customer_read_own_invoices"
  ON public.invoices
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (customer_email IS NOT NULL AND customer_email = auth.email())
      OR
      (customer_phone IS NOT NULL AND customer_phone = (auth.jwt() ->> 'phone'))
    )
  );

-- ─── CR-05: Add Model B read policy for invoice_items ────────────────────────────
-- Customers could read invoice headers but got zero line items — payment links broken.
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
          (inv.customer_email IS NOT NULL AND inv.customer_email = auth.email())
          OR
          (inv.customer_phone IS NOT NULL AND inv.customer_phone = (auth.jwt() ->> 'phone'))
        )
    )
  );
