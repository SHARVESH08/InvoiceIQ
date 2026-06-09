-- =============================================================================
-- InvoiceIQ — Migration 003: Functions
-- Applied after: 20260504000002_indexes.sql
-- Required by: 20260504000004_triggers.sql (trigger functions)
--              20260504000005_rls.sql (get_company_id used in policies)
-- =============================================================================

-- ─── Function 1: get_company_id() ────────────────────────────────────────────
-- D-04: returns the company_id for the authenticated user by querying company_users.
-- Previously read from JWT claim (auth.jwt() ->> 'company_id') which Supabase never
-- populates automatically — returned NULL for all users, breaking all RLS policies.
-- Fix (CR-01): query company_users WHERE user_id = auth.uid() instead.
-- SECURITY DEFINER + SET search_path = '' prevents search_path injection.
-- STABLE caches result within a query.
-- Wrapped in SELECT in policies: (SELECT public.get_company_id()) caches once per query.
-- NOTE: For users belonging to multiple companies, this returns one company_id
-- (lowest by PK ordering). A session-level company selector will be added in Phase 2.

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

-- ─── Function 2: get_indian_fy() ─────────────────────────────────────────────
-- D-10: compute Indian fiscal year string from a date in pure SQL.
-- April 2025 → '2025-26', January 2026 → '2025-26', April 2026 → '2026-27'

CREATE OR REPLACE FUNCTION public.get_indian_fy(p_date date DEFAULT CURRENT_DATE)
  RETURNS text
  LANGUAGE sql
  STABLE
  SET search_path = ''
AS $$
  SELECT
    CASE
      WHEN EXTRACT(MONTH FROM p_date) >= 4
      THEN EXTRACT(YEAR FROM p_date)::text
           || '-'
           || LPAD(((EXTRACT(YEAR FROM p_date) + 1) % 100)::text, 2, '0')
      ELSE (EXTRACT(YEAR FROM p_date) - 1)::text
           || '-'
           || LPAD((EXTRACT(YEAR FROM p_date) % 100)::text, 2, '0')
    END;
$$;

-- ─── Function 3: generate_invoice_number() ───────────────────────────────────
-- D-09: uses INSERT ON CONFLICT DO NOTHING + UPDATE RETURNING for concurrency safety.
-- Two concurrent calls for same (company_id, fy) serialize on the UPDATE row lock.
-- No duplicate numbers possible.

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
  -- WR-01: Prevent any authenticated user from incrementing another company's
  -- invoice sequence counter (wasting numbers, causing GST compliance gaps).
  IF NOT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of company %', p_company_id;
  END IF;

  v_fy := public.get_indian_fy(p_date);

  -- Ensure the sequence row exists (idempotent under concurrent calls)
  INSERT INTO public.invoice_sequences (company_id, fy, last_seq)
  VALUES (p_company_id, v_fy, 0)
  ON CONFLICT (company_id, fy) DO NOTHING;

  -- Atomic increment + return (UPDATE serializes concurrent callers via row lock)
  UPDATE public.invoice_sequences
  SET last_seq = last_seq + 1
  WHERE company_id = p_company_id
    AND fy = v_fy
  RETURNING last_seq INTO v_seq;

  -- Format: INV/2025-26/0001
  RETURN 'INV/' || v_fy || '/' || LPAD(v_seq::text, 4, '0');
END;
$$;

-- ─── Function 4: set_invoice_number() ────────────────────────────────────────
-- D-11: BEFORE INSERT trigger wrapper on invoices.
-- Only assigns invoice_number if not already provided by the caller.

CREATE OR REPLACE FUNCTION public.set_invoice_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public.generate_invoice_number(
      NEW.company_id,
      COALESCE(NEW.invoice_date, CURRENT_DATE)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ─── Function 5: audit_log_trigger() ─────────────────────────────────────────
-- SCHEMA-06: writes one row to audit_log on every INSERT/UPDATE/DELETE.
-- changed_by is auth.uid() which MAY be NULL when trigger fires via service_role
-- connection (no user JWT). The audit_log.changed_by column is nullable to allow this.

CREATE OR REPLACE FUNCTION public.audit_log_trigger()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_log (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_by,
    changed_at
  ) VALUES (
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN (to_jsonb(OLD) ->> 'id')::uuid
      ELSE                       (to_jsonb(NEW) ->> 'id')::uuid
    END,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid(),
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─── Function 6: decrement_inventory_on_invoice_item() ───────────────────────
-- SCHEMA-05: BEFORE INSERT on invoice_items.
-- FOR UPDATE NOWAIT: fail immediately if another transaction holds the lock.
-- Raises EXCEPTION if stock would go negative — BEFORE trigger aborts the INSERT.
-- Fix (CR-04): inventory UNIQUE constraint is (product_id, godown_id), not
-- (product_id, company_id). Selecting by company_id alone causes TOO_MANY_ROWS
-- for multi-godown companies. Fix: join through godowns to find the default godown
-- (is_default = true) and decrement only that row. LIMIT 1 is defensive — the
-- WR-03 partial unique index ensures at most one default per company.
-- NOTE: Callers MUST catch SQLSTATE 55P03 (lock_not_available) and retry.
-- NOWAIT is intentional to avoid deadlocks under high concurrency.

CREATE OR REPLACE FUNCTION public.decrement_inventory_on_invoice_item()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_inventory public.inventory%ROWTYPE;
BEGIN
  -- Free-text invoice items have no product_id — skip inventory check
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lock the inventory row for the default godown to serialize concurrent inserts.
  -- Joins godowns to filter by is_default = true so we never match multiple rows
  -- when the company has stock in more than one godown.
  SELECT i.* INTO v_inventory
  FROM public.inventory i
  JOIN public.godowns g ON g.id = i.godown_id
  WHERE i.product_id = NEW.product_id
    AND i.company_id = NEW.company_id
    AND g.is_default = true
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

-- ─── Function 7: create_default_godown() ─────────────────────────────────────
-- D-07: AFTER INSERT on companies.
-- Auto-creates one 'Main Warehouse' godown for every new company.
-- Ensures inventory.godown_id NOT NULL constraint is satisfiable from birth.

CREATE OR REPLACE FUNCTION public.create_default_godown()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.godowns (company_id, name, is_default)
  VALUES (NEW.id, 'Main Warehouse', true);
  RETURN NEW;
END;
$$;
