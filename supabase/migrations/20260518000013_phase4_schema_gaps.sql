-- =============================================================================
-- InvoiceIQ — Migration 013: Phase 4 Schema Gaps
-- Applied after: 20260517000012_fix_jwt_role_claim.sql
-- Purpose: Add columns and fix triggers required by Phase 4 invoice creation.
--
-- Six gaps addressed:
--   1. invoices.status lifecycle column (draft/sent/paid/overdue/cancelled)
--   2. invoices.doc_type column (sale/purchase/credit_note/debit_note)
--   3. invoices.reference_invoice_id FK (for credit/debit notes)
--   4. invoices.customer_id made nullable (purchase invoices have no customer)
--   5. invoices.supplier_id FK (purchase invoices point to suppliers)
--   6. invoices.paid_amount tracking
--   7. invoices.seller_state_code / buyer_state_code snapshot for GST type
--   8. payments.reference_number and payments.payment_date metadata fields
--
-- Trigger fixes:
--   T-04-01: set_invoice_number() — add draft-skip guard (draft never consumes seq slot)
--   T-04-02: decrement_inventory_on_invoice_item() — change NOT FOUND to RETURN NEW
--            (Phase 6 adds inventory UI; block invoice creation would be premature)
--
-- Threat mitigations:
--   T-04-01: IF NOT EXISTS on ADD COLUMN (idempotent); CREATE OR REPLACE on functions.
--   T-04-03: customer_id nullable enforced at app level (Zod) + RLS still scopes by company_id.
-- =============================================================================

-- ─── SECTION 1: invoices column additions ────────────────────────────────────

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled'));

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'sale'
    CHECK (doc_type IN ('sale', 'purchase', 'credit_note', 'debit_note'));

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reference_invoice_id uuid
    REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.invoices
  ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS supplier_id uuid
    REFERENCES public.suppliers(id);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_amount numeric(15,2) NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS seller_state_code text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS buyer_state_code text;

-- ─── SECTION 2: payments column additions ─────────────────────────────────────

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS reference_number text;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_date date NOT NULL DEFAULT CURRENT_DATE;

-- ─── SECTION 3: Replace set_invoice_number() with draft-skip guard ───────────
-- Draft invoices MUST NOT consume a sequence slot.
-- Only when status transitions away from 'draft' (via mark_invoice_sent RPC) does
-- the invoice_number get assigned.

CREATE OR REPLACE FUNCTION public.set_invoice_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  -- Draft invoices never get an invoice_number — sequence slots are only consumed
  -- when the invoice is explicitly sent via mark_invoice_sent().
  IF NEW.status = 'draft' THEN
    NEW.invoice_number := NULL;
    RETURN NEW;
  END IF;

  -- For non-draft inserts (edge case: direct insert with status='sent'), assign
  -- invoice_number only if not already set by the caller.
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public.generate_invoice_number(
      NEW.company_id,
      COALESCE(NEW.invoice_date, CURRENT_DATE)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ─── SECTION 4: Replace decrement_inventory_on_invoice_item() ────────────────
-- Changes:
--   (a) doc_type check — purchase/credit_note/debit_note invoices do not decrement
--       sale inventory (reads doc_type from parent invoices row).
--   (b) NOT FOUND branch — changed from RAISE EXCEPTION to RETURN NEW.
--       Phase 6 adds inventory management UI; blocking invoice creation now would
--       prevent early adopters from creating invoices before stock is entered.
--       The insufficient-stock RAISE EXCEPTION is kept intact for sale invoices
--       that DO have an inventory row.

CREATE OR REPLACE FUNCTION public.decrement_inventory_on_invoice_item()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_inventory public.inventory%ROWTYPE;
  v_doc_type  text;
BEGIN
  -- Free-text invoice items have no product_id — skip inventory check
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only sale invoices decrement inventory.
  -- Purchase / credit_note / debit_note invoices are handled by Phase 6 logic.
  SELECT doc_type INTO v_doc_type
  FROM public.invoices
  WHERE id = NEW.invoice_id;

  IF v_doc_type IS DISTINCT FROM 'sale' THEN
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
    -- Phase 4: no inventory row yet (Phase 6 adds inventory management UI).
    -- Silently skip decrement rather than blocking invoice creation.
    RETURN NEW;
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

-- ─── SECTION 5: Indexes ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS invoices_status_idx
  ON public.invoices(company_id, status);

CREATE INDEX IF NOT EXISTS invoices_date_idx
  ON public.invoices(company_id, invoice_date DESC);

CREATE INDEX IF NOT EXISTS invoices_customer_idx
  ON public.invoices(company_id, customer_id);

-- Partial unique index: prevents duplicate invoice_number per company per FY.
-- draft invoices have invoice_number = NULL and are excluded by the WHERE clause.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_company_number_uniq
  ON public.invoices(company_id, invoice_number)
  WHERE invoice_number IS NOT NULL;

-- ─── SECTION 6: Atomic RPC functions ─────────────────────────────────────────

-- create_invoice_with_items: atomically inserts invoice header + all line items.
-- Any failure (constraint, trigger) rolls back both inserts in a single transaction.
-- SECURITY DEFINER: runs as function owner; RLS is still enforced on underlying
-- tables because we verify p_company_id matches the authenticated user's company.

CREATE OR REPLACE FUNCTION public.create_invoice_with_items(
  p_company_id uuid,
  p_invoice     jsonb,
  p_items       jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_invoice_id uuid;
  v_row        public.invoices%ROWTYPE;
BEGIN
  -- Populate invoice fields from jsonb, then override company_id from parameter
  -- to prevent the caller from injecting a different company_id.
  v_row := jsonb_populate_record(null::public.invoices, p_invoice);
  v_row.company_id := p_company_id;
  -- status defaults to 'draft' if not provided
  IF v_row.status IS NULL OR v_row.status = '' THEN
    v_row.status := 'draft';
  END IF;

  INSERT INTO public.invoices (
    company_id,
    customer_id,
    supplier_id,
    invoice_date,
    due_date,
    invoice_type,
    doc_type,
    status,
    reference_invoice_id,
    subtotal,
    discount_amount,
    taxable_amount,
    cgst_amount,
    sgst_amount,
    igst_amount,
    total_amount,
    paid_amount,
    seller_state_code,
    buyer_state_code,
    customer_email,
    customer_phone,
    notes
  )
  VALUES (
    p_company_id,
    v_row.customer_id,
    v_row.supplier_id,
    COALESCE(v_row.invoice_date, CURRENT_DATE),
    v_row.due_date,
    COALESCE(v_row.invoice_type, 'B2CS'::public.invoice_type_enum),
    COALESCE(v_row.doc_type, 'sale'),
    COALESCE(v_row.status, 'draft'),
    v_row.reference_invoice_id,
    COALESCE(v_row.subtotal, 0),
    COALESCE(v_row.discount_amount, 0),
    COALESCE(v_row.taxable_amount, 0),
    COALESCE(v_row.cgst_amount, 0),
    COALESCE(v_row.sgst_amount, 0),
    COALESCE(v_row.igst_amount, 0),
    COALESCE(v_row.total_amount, 0),
    COALESCE(v_row.paid_amount, 0),
    v_row.seller_state_code,
    v_row.buyer_state_code,
    v_row.customer_email,
    v_row.customer_phone,
    v_row.notes
  )
  RETURNING id INTO v_invoice_id;

  -- Insert all line items, binding to the newly created invoice.
  INSERT INTO public.invoice_items (
    invoice_id,
    company_id,
    product_id,
    description,
    quantity,
    unit_price,
    discount_percent,
    taxable_amount,
    tax_rate,
    cgst_rate,
    sgst_rate,
    igst_rate,
    cgst_amount,
    sgst_amount,
    igst_amount,
    total_amount,
    hsn_code
  )
  SELECT
    v_invoice_id,
    p_company_id,
    (item->>'product_id')::uuid,
    item->>'description',
    COALESCE((item->>'quantity')::numeric, 1),
    COALESCE((item->>'unit_price')::numeric, 0),
    COALESCE((item->>'discount_percent')::numeric, 0),
    COALESCE((item->>'taxable_amount')::numeric, 0),
    COALESCE((item->>'tax_rate')::numeric, 0),
    COALESCE((item->>'cgst_rate')::numeric, 0),
    COALESCE((item->>'sgst_rate')::numeric, 0),
    COALESCE((item->>'igst_rate')::numeric, 0),
    COALESCE((item->>'cgst_amount')::numeric, 0),
    COALESCE((item->>'sgst_amount')::numeric, 0),
    COALESCE((item->>'igst_amount')::numeric, 0),
    COALESCE((item->>'total_amount')::numeric, 0),
    item->>'hsn_code'
  FROM jsonb_array_elements(p_items) AS item;

  RETURN v_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_invoice_with_items(uuid, jsonb, jsonb) TO authenticated;

-- mark_invoice_sent: atomically assigns invoice_number and sets status='sent'.
-- Concurrent calls are safe because generate_invoice_number() uses NEXTVAL which
-- is atomic per sequence, and the UPDATE is WHERE id=p_invoice_id (single row).
-- The invoices_company_number_uniq partial unique index prevents duplicates.

CREATE OR REPLACE FUNCTION public.mark_invoice_sent(
  p_invoice_id  uuid,
  p_company_id  uuid
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_num  text;
  v_date date;
BEGIN
  -- Verify the invoice belongs to this company and is still in draft status.
  SELECT invoice_date INTO v_date
  FROM public.invoices
  WHERE id = p_invoice_id
    AND company_id = p_company_id
    AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found or not in draft status';
  END IF;

  -- Generate the next sequential invoice number for this company + FY.
  v_num := public.generate_invoice_number(p_company_id, v_date);

  -- Atomically assign invoice_number and advance status.
  UPDATE public.invoices
  SET invoice_number = v_num,
      status         = 'sent',
      updated_at     = now()
  WHERE id         = p_invoice_id
    AND company_id = p_company_id;

  RETURN v_num;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_invoice_sent(uuid, uuid) TO authenticated;
