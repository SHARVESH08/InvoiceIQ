-- Fix get_pnl_summary: use purchase_price (Phase 3 column, written by the UI)
-- not base_price (original column, always 0 — never written by product form).
-- Products table has both columns; purchase_price is the one the form populates.

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
  IF p_company_id <> public.get_company_id() THEN
    RAISE EXCEPTION 'Company mismatch';
  END IF;

  SELECT COALESCE(SUM(taxable_amount), 0)
  INTO v_revenue
  FROM public.invoices
  WHERE company_id   = p_company_id
    AND doc_type     = 'sale'
    AND status      != 'cancelled'
    AND invoice_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(ii.quantity * p.purchase_price), 0)
  INTO v_cogs
  FROM public.invoice_items ii
  JOIN public.invoices inv ON inv.id = ii.invoice_id
  JOIN public.products p   ON p.id  = ii.product_id
  WHERE inv.company_id   = p_company_id
    AND inv.doc_type     = 'sale'
    AND inv.status      != 'cancelled'
    AND inv.invoice_date BETWEEN p_from AND p_to;

  RETURN jsonb_build_object(
    'revenue',      v_revenue,
    'cogs',         v_cogs,
    'gross_margin', v_revenue - v_cogs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pnl_summary(uuid, date, date) TO authenticated;
