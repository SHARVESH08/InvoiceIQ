-- =============================================================================
-- InvoiceIQ — Migration 016: Phase 6 Inventory Triggers + Godown Management
-- Applied after: 20260518000013_phase4_schema_gaps.sql
-- Incorporates cross-AI review feedback (06-REVIEWS.md):
--   HIGH: reserved_qty column added to inventory (ghost stock fix)
--   HIGH: SECURITY DEFINER RPCs hardened (search_path, company check, status, godown active, self-approval)
--   HIGH: pricing_alerts UNIQUE includes godown_id (multi-godown low-stock correctness)
--   HIGH: low-stock trigger fires on AFTER INSERT OR UPDATE OF quantity, reorder_level
--   HIGH: pg_cron job body includes full pg_net.http_post invocation with vault secrets
--   MEDIUM: composite indexes added; default godown guard in create_inventory_on_product_insert
-- =============================================================================

-- =============================================================================
-- SECTION 1: Schema gaps
-- =============================================================================

-- 1a. Add is_active column to godowns
ALTER TABLE public.godowns
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 1b. Add reserved_qty column to inventory (ghost stock fix — HIGH review concern)
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS reserved_qty numeric(12,3) NOT NULL DEFAULT 0
    CHECK (reserved_qty >= 0 AND reserved_qty <= quantity);

-- 1c. Add godown_id column to pricing_alerts (needed for godown-scoped uniqueness)
ALTER TABLE public.pricing_alerts
  ADD COLUMN IF NOT EXISTS godown_id uuid REFERENCES public.godowns(id);

-- Add godown-scoped unique constraint on pricing_alerts (HIGH review concern)
DO $$ BEGIN
  ALTER TABLE public.pricing_alerts
    ADD CONSTRAINT pricing_alerts_company_product_godown_type_unique
      UNIQUE (company_id, product_id, godown_id, alert_type);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1d. Create stock_transfers table with full constraints
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid          NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  product_id     uuid          NOT NULL REFERENCES public.products(id),
  from_godown_id uuid          NOT NULL REFERENCES public.godowns(id),
  to_godown_id   uuid          NOT NULL REFERENCES public.godowns(id),
  qty            numeric(12,3) NOT NULL CHECK (qty > 0),
  status         text          NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by   uuid          NOT NULL REFERENCES auth.users(id),
  approved_by    uuid          REFERENCES auth.users(id),
  notes          text,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now(),
  CHECK (from_godown_id <> to_godown_id)
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers FORCE ROW LEVEL SECURITY;

CREATE POLICY "company_isolation" ON public.stock_transfers FOR ALL
  USING (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

CREATE OR REPLACE TRIGGER audit_stock_transfers
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- 1e. Composite indexes (MEDIUM review concern)
CREATE INDEX IF NOT EXISTS idx_inventory_company_product_godown
  ON public.inventory(company_id, product_id, godown_id);

CREATE INDEX IF NOT EXISTS idx_pricing_alerts_company_type_product_godown
  ON public.pricing_alerts(company_id, alert_type, product_id, godown_id);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_company_status_created
  ON public.stock_transfers(company_id, status, created_at DESC);

-- =============================================================================
-- SECTION 2: low_stock_summary view (godown-aware)
-- =============================================================================

CREATE OR REPLACE VIEW public.low_stock_summary AS
  SELECT
    i.company_id,
    i.product_id,
    i.godown_id,
    i.quantity,
    i.reserved_qty,
    (i.quantity - i.reserved_qty) AS available_qty,
    i.reorder_level,
    p.name AS product_name,
    p.unit,
    g.name AS godown_name
  FROM public.inventory i
  JOIN public.products p ON p.id = i.product_id
  JOIN public.godowns g ON g.id = i.godown_id
  WHERE i.quantity <= i.reorder_level
    AND g.is_active = true;

-- =============================================================================
-- SECTION 3: Low-stock AFTER INSERT OR UPDATE trigger (HIGH review concern)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_low_stock_after_decrement()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- INSERT branch: fire when initial quantity is already at or below reorder_level
    IF NEW.quantity <= NEW.reorder_level THEN
      INSERT INTO public.pricing_alerts
        (company_id, product_id, godown_id, alert_type, threshold, is_active, triggered_at)
      VALUES
        (NEW.company_id, NEW.product_id, NEW.godown_id, 'low_stock', NEW.reorder_level, true, now())
      ON CONFLICT (company_id, product_id, godown_id, alert_type)
      DO UPDATE SET
        triggered_at = EXCLUDED.triggered_at,
        is_active    = true,
        threshold    = EXCLUDED.threshold;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- UPDATE guard: only fire when stock decreased OR reorder_level increased
    IF NEW.quantity >= OLD.quantity AND NEW.reorder_level <= OLD.reorder_level THEN
      RETURN NEW;
    END IF;

    IF NEW.quantity <= NEW.reorder_level THEN
      -- UPSERT alert (idempotent)
      INSERT INTO public.pricing_alerts
        (company_id, product_id, godown_id, alert_type, threshold, is_active, triggered_at)
      VALUES
        (NEW.company_id, NEW.product_id, NEW.godown_id, 'low_stock', NEW.reorder_level, true, now())
      ON CONFLICT (company_id, product_id, godown_id, alert_type)
      DO UPDATE SET
        triggered_at = EXCLUDED.triggered_at,
        is_active    = true,
        threshold    = EXCLUDED.threshold;
    ELSE
      -- Replenishment: DELETE alert so badge COUNT(*) stays accurate
      DELETE FROM public.pricing_alerts
      WHERE company_id = NEW.company_id
        AND product_id  = NEW.product_id
        AND godown_id   = NEW.godown_id
        AND alert_type  = 'low_stock';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER check_low_stock_after_inventory_change
  AFTER INSERT OR UPDATE OF quantity, reorder_level ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.check_low_stock_after_decrement();

-- =============================================================================
-- SECTION 4: create_inventory_on_product_insert trigger (MEDIUM review concern)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_inventory_on_product_insert()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_godown_id uuid;
BEGIN
  SELECT id INTO v_godown_id
  FROM public.godowns
  WHERE company_id  = NEW.company_id
    AND is_default  = true
    AND is_active   = true
  LIMIT 1;

  IF v_godown_id IS NULL THEN
    RAISE EXCEPTION
      'No default active godown found for company %. Cannot create inventory row for product %.',
      NEW.company_id, NEW.id
      USING HINT = 'Create a default godown for the company before adding products.';
  END IF;

  INSERT INTO public.inventory
    (company_id, product_id, godown_id, quantity, reserved_qty, reorder_level)
  VALUES
    (NEW.company_id, NEW.id, v_godown_id, 0, 0, 0)
  ON CONFLICT (product_id, godown_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER create_inventory_on_product_insert
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.create_inventory_on_product_insert();

-- =============================================================================
-- SECTION 5: Updated decrement trigger (ghost stock fix — invoice must respect reserved_qty)
-- =============================================================================

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
  SELECT doc_type INTO v_doc_type
  FROM public.invoices
  WHERE id = NEW.invoice_id;

  IF v_doc_type IS DISTINCT FROM 'sale' THEN
    RETURN NEW;
  END IF;

  -- Lock the inventory row for the default godown to serialize concurrent inserts.
  SELECT i.* INTO v_inventory
  FROM public.inventory i
  JOIN public.godowns g ON g.id = i.godown_id
  WHERE i.product_id = NEW.product_id
    AND i.company_id = NEW.company_id
    AND g.is_default = true
  LIMIT 1
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    -- Phase 4: no inventory row yet. Silently skip decrement.
    RETURN NEW;
  END IF;

  -- Check available stock = quantity - reserved_qty (ghost stock fix)
  IF (v_inventory.quantity - v_inventory.reserved_qty) < NEW.quantity THEN
    RAISE EXCEPTION
      'Insufficient available stock (qty: %, reserved: %, requested: %) for product %',
      v_inventory.quantity, v_inventory.reserved_qty, NEW.quantity, NEW.product_id;
  END IF;

  UPDATE public.inventory
  SET quantity   = quantity - NEW.quantity,
      updated_at = now()
  WHERE id = v_inventory.id;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- SECTION 6: Hardened RPCs — reserve_transfer_qty, approve_transfer, reject_transfer
-- =============================================================================

-- 6a. reserve_transfer_qty: atomically validates and reserves stock for a pending transfer
CREATE OR REPLACE FUNCTION public.reserve_transfer_qty(
  p_transfer_id   uuid,
  p_company_id    uuid,
  p_product_id    uuid,
  p_from_godown_id uuid,
  p_qty           numeric
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_inventory public.inventory%ROWTYPE;
BEGIN
  SET LOCAL search_path = public, pg_temp;

  -- Verify caller's company
  IF p_company_id IS NULL OR p_company_id <> public.get_company_id() THEN
    RAISE EXCEPTION 'Company mismatch — caller is not a member of company %', p_company_id;
  END IF;

  -- Lock inventory row atomically
  SELECT i.* INTO v_inventory
  FROM public.inventory i
  WHERE i.product_id = p_product_id
    AND i.godown_id  = p_from_godown_id
    AND i.company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No inventory record found in source godown % for product %',
      p_from_godown_id, p_product_id;
  END IF;

  IF (v_inventory.quantity - v_inventory.reserved_qty) < p_qty THEN
    RAISE EXCEPTION
      'Insufficient available stock to reserve. Available: %, Requested: %',
      (v_inventory.quantity - v_inventory.reserved_qty), p_qty;
  END IF;

  UPDATE public.inventory
  SET reserved_qty = reserved_qty + p_qty,
      updated_at   = now()
  WHERE id = v_inventory.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_transfer_qty(uuid, uuid, uuid, uuid, numeric) TO authenticated;

-- 6b. approve_transfer: fully-hardened approval RPC (HIGH review concern)
CREATE OR REPLACE FUNCTION public.approve_transfer(
  p_transfer_id uuid,
  p_company_id  uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_transfer  public.stock_transfers%ROWTYPE;
  v_src       public.inventory%ROWTYPE;
  v_active    boolean;
BEGIN
  SET LOCAL search_path = public, pg_temp;

  -- Verify caller's company
  IF p_company_id IS NULL OR p_company_id <> public.get_company_id() THEN
    RAISE EXCEPTION 'Company mismatch — caller not member of company %', p_company_id;
  END IF;

  -- Lock the pending transfer row (prevents concurrent double-approval)
  SELECT * INTO v_transfer
  FROM public.stock_transfers
  WHERE id         = p_transfer_id
    AND company_id = p_company_id
    AND status     = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found, not in pending status, or not in your company';
  END IF;

  -- Self-approval check
  IF v_transfer.requested_by = auth.uid() THEN
    RAISE EXCEPTION 'Cannot approve your own transfer request';
  END IF;

  -- Verify source godown is active
  SELECT is_active INTO v_active
  FROM public.godowns
  WHERE id         = v_transfer.from_godown_id
    AND company_id = p_company_id;

  IF NOT FOUND OR NOT v_active THEN
    RAISE EXCEPTION 'Source godown is inactive or not found';
  END IF;

  -- Verify destination godown is active
  SELECT is_active INTO v_active
  FROM public.godowns
  WHERE id         = v_transfer.to_godown_id
    AND company_id = p_company_id;

  IF NOT FOUND OR NOT v_active THEN
    RAISE EXCEPTION 'Destination godown is inactive or not found';
  END IF;

  -- Lock source inventory row
  SELECT i.* INTO v_src
  FROM public.inventory i
  WHERE i.product_id = v_transfer.product_id
    AND i.godown_id  = v_transfer.from_godown_id
    AND i.company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No inventory record found in source godown';
  END IF;

  -- Validate reservation integrity
  IF v_src.reserved_qty < v_transfer.qty THEN
    RAISE EXCEPTION
      'Reserved qty (%) less than transfer qty (%) — corrupt reservation',
      v_src.reserved_qty, v_transfer.qty;
  END IF;

  -- Atomic source update: convert reservation to permanent decrement
  UPDATE public.inventory
  SET quantity     = quantity - v_transfer.qty,
      reserved_qty = reserved_qty - v_transfer.qty,
      updated_at   = now()
  WHERE id = v_src.id;

  -- Atomic destination UPSERT
  INSERT INTO public.inventory
    (company_id, product_id, godown_id, quantity, reserved_qty, reorder_level)
  VALUES
    (p_company_id, v_transfer.product_id, v_transfer.to_godown_id, v_transfer.qty, 0, 0)
  ON CONFLICT (product_id, godown_id)
  DO UPDATE SET
    quantity   = public.inventory.quantity + EXCLUDED.quantity,
    updated_at = now();

  -- Mark transfer approved
  UPDATE public.stock_transfers
  SET status      = 'approved',
      approved_by = auth.uid(),
      updated_at  = now()
  WHERE id = p_transfer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_transfer(uuid, uuid) TO authenticated;

-- 6c. reject_transfer: fully-hardened rejection RPC (HIGH review concern)
CREATE OR REPLACE FUNCTION public.reject_transfer(
  p_transfer_id uuid,
  p_company_id  uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_transfer public.stock_transfers%ROWTYPE;
BEGIN
  SET LOCAL search_path = public, pg_temp;

  -- Verify caller's company
  IF p_company_id IS NULL OR p_company_id <> public.get_company_id() THEN
    RAISE EXCEPTION 'Company mismatch — caller is not a member of company %', p_company_id;
  END IF;

  -- Lock the pending transfer row
  SELECT * INTO v_transfer
  FROM public.stock_transfers
  WHERE id         = p_transfer_id
    AND company_id = p_company_id
    AND status     = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found or not in pending status';
  END IF;

  -- Release reservation
  UPDATE public.inventory
  SET reserved_qty = reserved_qty - v_transfer.qty,
      updated_at   = now()
  WHERE product_id = v_transfer.product_id
    AND godown_id  = v_transfer.from_godown_id
    AND company_id = p_company_id;

  -- Mark transfer rejected
  UPDATE public.stock_transfers
  SET status      = 'rejected',
      approved_by = auth.uid(),
      updated_at  = now()
  WHERE id = p_transfer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_transfer(uuid, uuid) TO authenticated;

-- =============================================================================
-- SECTION 7: Inventory backfill (D-19)
-- =============================================================================

INSERT INTO public.inventory
  (company_id, product_id, godown_id, quantity, reserved_qty, reorder_level)
SELECT
  p.company_id,
  p.id,
  g.id,
  0,
  0,
  0
FROM public.products p
JOIN public.godowns g
  ON g.company_id = p.company_id
  AND g.is_default = true
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory i
  WHERE i.product_id = p.id
    AND i.godown_id  = g.id
);

-- =============================================================================
-- SECTION 7b: pricing_alerts backfill for existing low-stock inventory (INVENTORY-03)
-- =============================================================================

INSERT INTO public.pricing_alerts
  (company_id, product_id, godown_id, alert_type, threshold, is_active, triggered_at)
SELECT
  i.company_id,
  i.product_id,
  i.godown_id,
  'low_stock',
  i.reorder_level,
  true,
  now()
FROM public.inventory i
JOIN public.godowns g ON g.id = i.godown_id
WHERE i.quantity <= i.reorder_level
  AND g.is_active = true
ON CONFLICT (company_id, product_id, godown_id, alert_type)
DO UPDATE SET
  is_active    = true,
  triggered_at = now();

-- =============================================================================
-- SECTION 8: pg_cron job with full pg_net.http_post invocation (HIGH review concern)
-- =============================================================================

-- Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- BEFORE this migration is pushed in production, set vault secrets via Supabase Dashboard:
--   Project Settings -> Database -> Custom postgres config:
--     app.supabase_url = 'https://<project-ref>.supabase.co'
--     app.service_role_key = '<service_role_key>'
--   OR run in SQL editor as superuser:
--     ALTER DATABASE postgres SET app.supabase_url = 'https://<project-ref>.supabase.co';
--     ALTER DATABASE postgres SET app.service_role_key = '<service_role_key>';
--   These settings are read by the pg_cron job body below via current_setting().

-- Idempotently unschedule then re-schedule the digest job
DO $$ BEGIN
  PERFORM cron.unschedule('invoiceiq-low-stock-digest');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'invoiceiq-low-stock-digest',
  '30 2 * * *',
  $$
    SELECT extensions.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/low-stock-digest',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
        'Content-Type',  'application/json'
      ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 30000
    )
  $$
);
