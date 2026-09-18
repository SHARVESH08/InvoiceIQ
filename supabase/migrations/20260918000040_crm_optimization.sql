-- =============================================================================
-- InvoiceIQ — Migration 040: CRM performance
--
-- Two problems this fixes:
--
-- 1. getCrmFunnel() streamed EVERY lead row and EVERY deal row to the Node
--    process on each /crm render, purely to produce five integers. Cost grew
--    linearly with pipeline size while the answer stayed 40 bytes.
--    get_crm_funnel() below does the same arithmetic in one pass per table.
--
-- 2. The list queries order by created_at / updated_at, but migration 036 only
--    indexed (company_id, status) and (company_id, stage). Postgres could use
--    those to filter but still had to sort the matching rows every time.
--    The two indexes here match the actual ORDER BY, making the reads
--    index-ordered.
-- =============================================================================

-- ─── RPC: get_crm_funnel() ───────────────────────────────────────────────────
-- Mirrors get_crm_segments (migration 036): resolves the company itself and
-- returns NULL when there is no membership, so RLS-equivalent scoping holds
-- without trusting a caller-supplied company id.

CREATE OR REPLACE FUNCTION public.get_crm_funnel()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_company uuid;
  v_result  jsonb;
BEGIN
  v_company := public.get_company_id();
  IF v_company IS NULL THEN
    RETURN NULL;
  END IF;

  WITH l AS (
    SELECT
      COUNT(*)                                    AS leads_total,
      COUNT(*) FILTER (WHERE status = 'converted') AS leads_converted
    FROM public.crm_leads
    WHERE company_id = v_company
  ),
  d AS (
    SELECT
      COUNT(*) FILTER (WHERE stage = 'won')                        AS deals_won,
      COUNT(*) FILTER (WHERE stage = 'lost')                       AS deals_lost,
      COALESCE(SUM(value) FILTER (WHERE stage = 'won'), 0)::numeric AS won_value
    FROM public.crm_deals
    WHERE company_id = v_company
  )
  SELECT jsonb_build_object(
    'leads_total',     l.leads_total,
    'leads_converted', l.leads_converted,
    'deals_won',       d.deals_won,
    'deals_lost',      d.deals_lost,
    'won_value',       d.won_value
  )
  INTO v_result
  FROM l, d;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_crm_funnel() TO authenticated;

-- ─── Indexes matching the list queries' ORDER BY ─────────────────────────────
-- listLeads:     WHERE company_id = $1 ORDER BY created_at DESC
-- listDeals:     WHERE company_id = $1 ORDER BY updated_at DESC
-- listOpenTasks: already covered by idx_crm_tasks_company_due
--                (company_id, status, due_date).

CREATE INDEX IF NOT EXISTS idx_crm_leads_company_created
  ON public.crm_leads(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_deals_company_updated
  ON public.crm_deals(company_id, updated_at DESC);
