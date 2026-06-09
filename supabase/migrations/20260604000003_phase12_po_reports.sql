-- =============================================================================
-- InvoiceIQ — Migration 20260604000003: Phase 12 PO cross-tenant schema + atomic RPCs
-- Applied after: all prior migrations
-- Purpose:
--   - Extend po_status_enum with confirmed, rejected, dispatched
--   - Add distributor_company_id + updated_at + notes columns to purchase_orders
--   - Make supplier_id nullable for OEM→Distributor POs
--   - Add updated_at to purchase_order_items
--   - Add cross-tenant RLS policies for Distributor access
--   - Add purchase_orders to supabase_realtime publication
--   - Create dispatch_po_and_create_invoice atomic RPC
--   - Create receive_po_and_update_inventory atomic RPC
--   - Create get_pnl_summary reporting RPC
-- =============================================================================

-- =============================================================================
-- SECTION 2: Enum extension
-- These must be standalone (NOT inside a transaction block or DO block).
-- ADD VALUE is safe as standalone in Supabase migrations.
-- =============================================================================

ALTER TYPE public.po_status_enum ADD VALUE IF NOT EXISTS 'confirmed' AFTER 'sent';
ALTER TYPE public.po_status_enum ADD VALUE IF NOT EXISTS 'rejected' AFTER 'confirmed';
ALTER TYPE public.po_status_enum ADD VALUE IF NOT EXISTS 'dispatched' AFTER 'confirmed';

-- =============================================================================
-- SECTION 3: Column additions to purchase_orders
-- =============================================================================

-- Make supplier_id nullable (OEM→Distributor POs have no supplier_id)
ALTER TABLE public.purchase_orders ALTER COLUMN supplier_id DROP NOT NULL;

-- Add distributor_company_id: UUID of the Distributor company receiving this PO
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS distributor_company_id uuid REFERENCES public.companies(id);

-- Index for fast cross-tenant RLS lookups
CREATE INDEX IF NOT EXISTS purchase_orders_distributor_company_id_idx
  ON public.purchase_orders(distributor_company_id);

-- Audit trail column
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Optional notes field
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS notes text;

-- =============================================================================
-- SECTION 4: purchase_order_items — add updated_at
-- =============================================================================

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- =============================================================================
-- SECTION 5: Cross-tenant RLS policies
-- Distributor can SELECT their incoming POs and line items.
-- OEM company_isolation policy still covers OEM's own rows.
-- =============================================================================

-- Allow Distributor to read POs directed to them
CREATE POLICY "distributor_read_incoming_pos"
  ON public.purchase_orders
  FOR SELECT
  USING (
    distributor_company_id IS NOT NULL
    AND distributor_company_id = (SELECT public.get_company_id())
  );

-- Allow Distributor to read line items of their incoming POs
CREATE POLICY "distributor_read_incoming_po_items"
  ON public.purchase_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.purchase_orders po
      WHERE po.id = purchase_order_items.po_id
        AND po.distributor_company_id IS NOT NULL
        AND po.distributor_company_id = (SELECT public.get_company_id())
    )
  );

-- =============================================================================
-- SECTION 6: Realtime publication
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;

-- =============================================================================
-- SECTION 7: dispatch_po_and_create_invoice RPC
-- Called by OEM after the Distributor confirms the PO.
-- Atomically creates a sale invoice for the OEM and transitions PO→dispatched.
-- SECURITY DEFINER + search_path = '' prevents search_path injection.
-- FOR UPDATE on PO row prevents concurrent double-dispatch (T-12-03).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.dispatch_po_and_create_invoice(
  p_po_id      uuid,
  p_company_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_po         public.purchase_orders%ROWTYPE;
  v_invoice_id uuid;
BEGIN
  -- 1. Lock the PO row — prevents concurrent double-dispatch (T-12-03)
  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id         = p_po_id
    AND company_id = p_company_id
    AND status     = 'confirmed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'PO not found, not owned by caller, or not in confirmed status';
  END IF;

  -- 2. Verify caller's JWT company matches p_company_id (T-12-02)
  IF p_company_id <> public.get_company_id() THEN
    RAISE EXCEPTION 'Company mismatch';
  END IF;

  -- 3. Insert OEM sale invoice (doc_type='sale', customer_id=NULL — Phase 4 made customer_id nullable)
  INSERT INTO public.invoices (
    company_id,
    customer_id,
    invoice_number,
    invoice_date,
    invoice_type,
    doc_type,
    status,
    subtotal,
    discount_amount,
    taxable_amount,
    cgst_amount,
    sgst_amount,
    igst_amount,
    total_amount,
    payment_status
  )
  VALUES (
    p_company_id,
    NULL,
    public.generate_invoice_number(p_company_id, CURRENT_DATE),
    CURRENT_DATE,
    'B2B',
    'sale',
    'sent',
    v_po.total_amount,
    0,
    v_po.total_amount,
    0,
    0,
    0,
    v_po.total_amount,
    'unpaid'
  )
  RETURNING id INTO v_invoice_id;

  -- 4. Insert invoice line items from PO items
  INSERT INTO public.invoice_items (
    invoice_id,
    company_id,
    product_id,
    quantity,
    unit_price,
    total_amount,
    taxable_amount,
    tax_rate,
    cgst_rate,
    sgst_rate,
    igst_rate,
    cgst_amount,
    sgst_amount,
    igst_amount,
    discount_percent
  )
  SELECT
    v_invoice_id,
    p_company_id,
    product_id,
    quantity_ordered,
    unit_price,
    total_amount,
    total_amount,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  FROM public.purchase_order_items
  WHERE po_id = p_po_id;

  -- 5. Advance PO to dispatched
  UPDATE public.purchase_orders
  SET status     = 'dispatched',
      updated_at = now()
  WHERE id = p_po_id;

  -- 6. Return invoice id
  RETURN v_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_po_and_create_invoice(uuid, uuid) TO authenticated;

-- =============================================================================
-- SECTION 8: receive_po_and_update_inventory RPC
-- Called by Distributor after physical goods arrive.
-- Atomically: validates product catalog, creates purchase invoice, upserts inventory,
-- and transitions PO→received.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.receive_po_and_update_inventory(
  p_po_id      uuid,
  p_company_id uuid,
  p_godown_id  uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_po         public.purchase_orders%ROWTYPE;
  v_invoice_id uuid;
  poi          RECORD;
BEGIN
  -- 1. Lock the dispatched PO row (must belong to this Distributor)
  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id                    = p_po_id
    AND distributor_company_id = p_company_id
    AND status                = 'dispatched'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'PO not found, not directed to this Distributor, or not in dispatched status';
  END IF;

  -- 2. Verify caller's JWT company matches p_company_id
  IF p_company_id <> public.get_company_id() THEN
    RAISE EXCEPTION 'Company mismatch';
  END IF;

  -- 3. Validate each line item product exists in Distributor's catalog
  FOR poi IN
    SELECT poi.*, p.name AS product_name
    FROM public.purchase_order_items poi
    LEFT JOIN public.products p
      ON p.id = poi.product_id
     AND p.company_id = p_company_id
    WHERE poi.po_id = p_po_id
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.products
      WHERE id         = poi.product_id
        AND company_id = p_company_id
    ) THEN
      RAISE EXCEPTION
        'Product "%" not found in Distributor product catalog. Add the product before receiving this PO.',
        poi.product_id::text;
    END IF;
  END LOOP;

  -- 4. Insert Distributor purchase invoice (doc_type='purchase')
  INSERT INTO public.invoices (
    company_id,
    customer_id,
    invoice_number,
    invoice_date,
    invoice_type,
    doc_type,
    status,
    subtotal,
    discount_amount,
    taxable_amount,
    cgst_amount,
    sgst_amount,
    igst_amount,
    total_amount,
    payment_status
  )
  VALUES (
    p_company_id,
    NULL,
    public.generate_invoice_number(p_company_id, CURRENT_DATE),
    CURRENT_DATE,
    'B2B',
    'purchase',
    'sent',
    v_po.total_amount,
    0,
    v_po.total_amount,
    0,
    0,
    0,
    v_po.total_amount,
    'unpaid'
  )
  RETURNING id INTO v_invoice_id;

  -- 5. Insert invoice line items from PO items
  INSERT INTO public.invoice_items (
    invoice_id,
    company_id,
    product_id,
    quantity,
    unit_price,
    total_amount,
    taxable_amount,
    tax_rate,
    cgst_rate,
    sgst_rate,
    igst_rate,
    cgst_amount,
    sgst_amount,
    igst_amount,
    discount_percent
  )
  SELECT
    v_invoice_id,
    p_company_id,
    product_id,
    quantity_ordered,
    unit_price,
    total_amount,
    total_amount,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  FROM public.purchase_order_items
  WHERE po_id = p_po_id;

  -- 6. Upsert Distributor inventory (UNIQUE constraint: product_id, godown_id)
  INSERT INTO public.inventory (
    company_id,
    product_id,
    godown_id,
    quantity,
    reserved_qty,
    reorder_level
  )
  SELECT
    p_company_id,
    product_id,
    p_godown_id,
    quantity_ordered,
    0,
    0
  FROM public.purchase_order_items
  WHERE po_id = p_po_id
  ON CONFLICT (product_id, godown_id)
  DO UPDATE SET
    quantity   = public.inventory.quantity + EXCLUDED.quantity,
    updated_at = now();

  -- 7. Advance PO to received
  UPDATE public.purchase_orders
  SET status     = 'received',
      updated_at = now()
  WHERE id = p_po_id;

  -- 8. Return invoice id
  RETURN v_invoice_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_po_and_update_inventory(uuid, uuid, uuid) TO authenticated;

-- =============================================================================
-- SECTION 9: get_pnl_summary RPC
-- Single-query P&L aggregate to avoid N+1 in the reports server action.
-- Returns: { revenue, cogs, gross_margin }
-- =============================================================================

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
  -- 1. Caller must own the company
  IF p_company_id <> public.get_company_id() THEN
    RAISE EXCEPTION 'Company mismatch';
  END IF;

  -- 2. Revenue = sum of taxable_amount on sale invoices in the date range
  SELECT COALESCE(SUM(taxable_amount), 0)
  INTO v_revenue
  FROM public.invoices
  WHERE company_id   = p_company_id
    AND doc_type     = 'sale'
    AND status      != 'cancelled'
    AND invoice_date BETWEEN p_from AND p_to;

  -- 3. COGS = sum of (qty sold * product base_price) for sale invoices in range
  SELECT COALESCE(SUM(ii.quantity * p.base_price), 0)
  INTO v_cogs
  FROM public.invoice_items ii
  JOIN public.invoices inv
    ON inv.id = ii.invoice_id
  JOIN public.products p
    ON p.id = ii.product_id
  WHERE inv.company_id   = p_company_id
    AND inv.doc_type     = 'sale'
    AND inv.status      != 'cancelled'
    AND inv.invoice_date BETWEEN p_from AND p_to;

  -- 4. Return JSON
  RETURN jsonb_build_object(
    'revenue',      v_revenue,
    'cogs',         v_cogs,
    'gross_margin', v_revenue - v_cogs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pnl_summary(uuid, date, date) TO authenticated;
