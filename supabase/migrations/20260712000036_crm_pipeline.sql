-- =============================================================================
-- InvoiceIQ — Migration 036: CRM pipeline (leads, deals, interactions, tasks)
--
-- Every table is company_id-scoped with the standard "company_isolation" RLS
-- policy (get_company_id() from the JWT claim), matching migration 005.
-- Leads convert into the existing customers table; deals/interactions/tasks
-- attach to a lead, a deal, and/or a customer.
-- =============================================================================

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE public.crm_lead_status_enum AS ENUM
  ('new', 'contacted', 'qualified', 'converted', 'lost');

CREATE TYPE public.crm_lead_source_enum AS ENUM
  ('walk_in', 'referral', 'whatsapp', 'online', 'other');

CREATE TYPE public.crm_deal_stage_enum AS ENUM
  ('qualified', 'proposal', 'negotiation', 'won', 'lost');

CREATE TYPE public.crm_interaction_type_enum AS ENUM
  ('call', 'email', 'whatsapp', 'visit', 'note');

CREATE TYPE public.crm_task_status_enum AS ENUM ('open', 'done');

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE public.crm_leads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  phone       text,
  email       text,
  source      public.crm_lead_source_enum NOT NULL DEFAULT 'walk_in',
  status      public.crm_lead_status_enum NOT NULL DEFAULT 'new',
  customer_id uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  assigned_to uuid        REFERENCES auth.users(id)       ON DELETE SET NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_deals (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title          text          NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  value          numeric(12,2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  stage          public.crm_deal_stage_enum NOT NULL DEFAULT 'qualified',
  expected_close date,
  lead_id        uuid          REFERENCES public.crm_leads(id)  ON DELETE SET NULL,
  customer_id    uuid          REFERENCES public.customers(id)  ON DELETE SET NULL,
  assigned_to    uuid          REFERENCES auth.users(id)        ON DELETE SET NULL,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_interactions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type        public.crm_interaction_type_enum NOT NULL DEFAULT 'note',
  content     text        NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 4000),
  customer_id uuid        REFERENCES public.customers(id) ON DELETE CASCADE,
  lead_id     uuid        REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  deal_id     uuid        REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  created_by  uuid        NOT NULL REFERENCES auth.users(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  -- An interaction must be about something.
  CHECK (customer_id IS NOT NULL OR lead_id IS NOT NULL OR deal_id IS NOT NULL)
);

CREATE TABLE public.crm_tasks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title       text        NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  due_date    date        NOT NULL,
  status      public.crm_task_status_enum NOT NULL DEFAULT 'open',
  customer_id uuid        REFERENCES public.customers(id) ON DELETE CASCADE,
  lead_id     uuid        REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  deal_id     uuid        REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  assigned_to uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by  uuid        NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_crm_leads_company_status ON public.crm_leads(company_id, status);
CREATE INDEX idx_crm_deals_company_stage  ON public.crm_deals(company_id, stage);
CREATE INDEX idx_crm_interactions_company ON public.crm_interactions(company_id, occurred_at DESC);
CREATE INDEX idx_crm_interactions_customer ON public.crm_interactions(customer_id)
  WHERE customer_id IS NOT NULL;
CREATE INDEX idx_crm_tasks_company_due    ON public.crm_tasks(company_id, status, due_date);

-- ─── updated_at maintenance ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.crm_touch_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crm_leads_touch BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();
CREATE TRIGGER trg_crm_deals_touch BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();

-- ─── Grants + RLS (standard company_isolation, matching migration 005/011) ──

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_deals        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_interactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks        TO authenticated;

ALTER TABLE public.crm_leads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_interactions FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks        FORCE  ROW LEVEL SECURITY;

CREATE POLICY "company_isolation" ON public.crm_leads
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

CREATE POLICY "company_isolation" ON public.crm_deals
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

CREATE POLICY "company_isolation" ON public.crm_interactions
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

CREATE POLICY "company_isolation" ON public.crm_tasks
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));

-- ─── RPC: get_crm_segments() ─────────────────────────────────────────────────
-- Auto-segments computed from existing billing data (no new state):
--   top_spenders: top decile by ex-GST revenue over the last 90 days (min 1)
--   overdue:      customers with issued, unpaid/partial invoices past due_date
--   at_risk:      customers with history but no issued invoice in 90 days
--   new_30d:      customers whose first issued invoice is within 30 days

CREATE OR REPLACE FUNCTION public.get_crm_segments()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_company uuid;
  v_result jsonb;
BEGIN
  v_company := public.get_company_id();
  IF v_company IS NULL THEN
    RETURN NULL;
  END IF;

  WITH issued AS (
    SELECT i.customer_id, i.invoice_date, i.taxable_amount, i.total_amount,
           i.payment_status, i.due_date
    FROM public.invoices i
    WHERE i.company_id = v_company
      AND i.status NOT IN ('draft', 'cancelled')
  ),
  spend_90d AS (
    SELECT customer_id, SUM(taxable_amount) AS revenue
    FROM issued
    WHERE invoice_date >= CURRENT_DATE - 90
      AND payment_status IN ('partial', 'paid')
    GROUP BY customer_id
  )
  SELECT jsonb_build_object(
    'top_spenders', (
      SELECT COUNT(*) FROM spend_90d
      WHERE revenue >= (
        SELECT COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY revenue), 0)
        FROM spend_90d
      ) AND revenue > 0
    ),
    'overdue', (
      SELECT COUNT(DISTINCT customer_id) FROM issued
      WHERE payment_status <> 'paid' AND due_date < CURRENT_DATE
    ),
    'at_risk', (
      SELECT COUNT(*) FROM (
        SELECT customer_id FROM issued
        GROUP BY customer_id
        HAVING MAX(invoice_date) < CURRENT_DATE - 90
      ) dormant
    ),
    'new_30d', (
      SELECT COUNT(*) FROM (
        SELECT customer_id FROM issued
        GROUP BY customer_id
        HAVING MIN(invoice_date) >= CURRENT_DATE - 30
      ) fresh
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_crm_segments() TO authenticated;
