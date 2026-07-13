-- =============================================================================
-- InvoiceIQ — Migration 035: Franchise foundation (groups, invites, HQ RPCs)
--
-- A franchise group links existing companies WITHOUT merging their data.
-- Per-company isolation (RLS by company_id) is untouched. Group owners get
-- aggregate reads across member companies through SECURITY DEFINER RPCs that
-- gate on franchise_owners membership and return aggregates only.
--
-- Consent model: a company joins a group only when one of ITS admins accepts
-- a pending invite (accept_franchise_invite). Acceptance also grants the
-- group's owners an admin company_users row in the joining company, which is
-- what the invite text presents to the accepting admin.
-- =============================================================================

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE public.franchise_groups (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  created_by uuid        NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.franchise_owners (
  group_id   uuid        NOT NULL REFERENCES public.franchise_groups(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id)              ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE public.companies
  ADD COLUMN franchise_group_id uuid REFERENCES public.franchise_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_companies_franchise_group ON public.companies(franchise_group_id)
  WHERE franchise_group_id IS NOT NULL;

CREATE TYPE public.franchise_invite_status_enum AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE public.franchise_invites (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid        NOT NULL REFERENCES public.franchise_groups(id) ON DELETE CASCADE,
  company_id   uuid        NOT NULL REFERENCES public.companies(id)        ON DELETE CASCADE,
  invited_by   uuid        NOT NULL REFERENCES auth.users(id),
  status       public.franchise_invite_status_enum NOT NULL DEFAULT 'pending',
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '14 days',
  responded_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- One live invite per (group, company) at a time.
CREATE UNIQUE INDEX idx_franchise_invites_pending
  ON public.franchise_invites(group_id, company_id)
  WHERE status = 'pending';

CREATE INDEX idx_franchise_invites_company ON public.franchise_invites(company_id);

-- ─── Grants (RLS remains the security boundary, matching migration 011) ─────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.franchise_groups  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.franchise_owners  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.franchise_invites TO authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.franchise_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchise_groups  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.franchise_owners  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchise_owners  FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.franchise_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchise_invites FORCE  ROW LEVEL SECURITY;

-- Owners see their own groups. Mutations happen through SECURITY DEFINER RPCs.
CREATE POLICY "owners_select_groups"
  ON public.franchise_groups FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.franchise_owners fo
    WHERE fo.group_id = franchise_groups.id AND fo.user_id = auth.uid()
  ));

CREATE POLICY "owners_select_own_rows"
  ON public.franchise_owners FOR SELECT
  USING (user_id = auth.uid());

-- Invites are visible to the group's owners AND to admins of the target company
-- (the people who must accept or decline).
CREATE POLICY "owners_or_target_admin_select_invites"
  ON public.franchise_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.franchise_owners fo
      WHERE fo.group_id = franchise_invites.group_id AND fo.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = franchise_invites.company_id
        AND cu.user_id = auth.uid()
        AND cu.role = 'admin'
    )
  );

-- ─── RPC: create_franchise_group(p_name) ─────────────────────────────────────
-- Atomic group + owner-row bootstrap (mirrors the registerBusiness admin-client
-- pattern, but doable in one definer function since the caller is known).

CREATE OR REPLACE FUNCTION public.create_franchise_group(p_name text)
  RETURNS uuid
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 OR length(trim(p_name)) > 80 THEN
    RAISE EXCEPTION 'Group name must be 2-80 characters';
  END IF;

  INSERT INTO public.franchise_groups (name, created_by)
  VALUES (trim(p_name), auth.uid())
  RETURNING id INTO v_group_id;

  INSERT INTO public.franchise_owners (group_id, user_id)
  VALUES (v_group_id, auth.uid());

  RETURN v_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_franchise_group(text) TO authenticated;

-- ─── RPC: find_company_for_franchise(p_gstin) ────────────────────────────────
-- Exact-GSTIN lookup so an owner can target an invite. Returns id + name only
-- (no address/contact data) and only for exact matches: no enumeration surface.

CREATE OR REPLACE FUNCTION public.find_company_for_franchise(p_gstin text)
  RETURNS TABLE(company_id uuid, name text, already_in_group boolean)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT c.id, c.name, (c.franchise_group_id IS NOT NULL)
  FROM public.companies c
  WHERE auth.uid() IS NOT NULL
    AND c.gstin = upper(trim(p_gstin));
$$;

GRANT EXECUTE ON FUNCTION public.find_company_for_franchise(text) TO authenticated;

-- ─── RPC: invite_company_to_franchise(p_group_id, p_company_id) ──────────────

CREATE OR REPLACE FUNCTION public.invite_company_to_franchise(p_group_id uuid, p_company_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_invite_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.franchise_owners
    WHERE group_id = p_group_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not an owner of this franchise group';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = p_company_id AND franchise_group_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Company already belongs to a franchise group';
  END IF;

  INSERT INTO public.franchise_invites (group_id, company_id, invited_by)
  VALUES (p_group_id, p_company_id, auth.uid())
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'An invite for this company is already pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_company_to_franchise(uuid, uuid) TO authenticated;

-- ─── RPC: respond_franchise_invite(p_invite_id, p_accept) ────────────────────
-- Caller must be an admin of the invite's target company. On accept:
--   1. companies.franchise_group_id is set
--   2. every group owner gets an admin company_users row in the company
--      (this is the drill-down consent the admin is accepting)

CREATE OR REPLACE FUNCTION public.respond_franchise_invite(p_invite_id uuid, p_accept boolean)
  RETURNS void
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_invite public.franchise_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM public.franchise_invites
  WHERE id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'Invite already responded to';
  END IF;
  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = v_invite.company_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only an admin of the invited company can respond';
  END IF;

  IF p_accept THEN
    UPDATE public.companies
       SET franchise_group_id = v_invite.group_id
     WHERE id = v_invite.company_id
       AND franchise_group_id IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Company already belongs to a franchise group';
    END IF;

    INSERT INTO public.company_users (company_id, user_id, role, invited_by)
    SELECT v_invite.company_id, fo.user_id, 'admin', v_invite.invited_by
    FROM public.franchise_owners fo
    WHERE fo.group_id = v_invite.group_id
    ON CONFLICT (company_id, user_id) DO NOTHING;

    UPDATE public.franchise_invites
       SET status = 'accepted', responded_at = now()
     WHERE id = p_invite_id;
  ELSE
    UPDATE public.franchise_invites
       SET status = 'declined', responded_at = now()
     WHERE id = p_invite_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_franchise_invite(uuid, boolean) TO authenticated;

-- ─── Helper: caller's franchise group (NULL when not an owner) ───────────────

CREATE OR REPLACE FUNCTION public.get_franchise_group_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT group_id FROM public.franchise_owners
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_franchise_group_id() TO authenticated;

-- =============================================================================
-- HQ aggregate RPCs
-- Revenue semantics mirror migration 034: SUM(taxable_amount) over invoices
-- with status NOT IN ('draft','cancelled') AND payment_status IN
-- ('partial','paid'). Outstanding mirrors the dashboard receivables query:
-- SUM(total_amount) where payment_status != 'paid' and status is issued.
-- Low stock mirrors the nav-badge source: active low_stock pricing_alerts.
-- =============================================================================

-- ─── RPC: get_franchise_overview() ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_franchise_overview()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_group uuid;
  v_result jsonb;
BEGIN
  v_group := public.get_franchise_group_id();
  IF v_group IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'group_id', v_group,
    'group_name', (SELECT g.name FROM public.franchise_groups g WHERE g.id = v_group),
    'member_count', (
      SELECT COUNT(*) FROM public.companies c WHERE c.franchise_group_id = v_group
    ),
    'revenue_mtd', COALESCE((
      SELECT SUM(i.taxable_amount)
      FROM public.invoices i
      JOIN public.companies c ON c.id = i.company_id
      WHERE c.franchise_group_id = v_group
        AND i.invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND i.status NOT IN ('draft', 'cancelled')
        AND i.payment_status IN ('partial', 'paid')
    ), 0),
    'outstanding', COALESCE((
      SELECT SUM(i.total_amount)
      FROM public.invoices i
      JOIN public.companies c ON c.id = i.company_id
      WHERE c.franchise_group_id = v_group
        AND i.payment_status <> 'paid'
        AND i.status NOT IN ('draft', 'cancelled')
    ), 0),
    'invoice_count_mtd', (
      SELECT COUNT(*)
      FROM public.invoices i
      JOIN public.companies c ON c.id = i.company_id
      WHERE c.franchise_group_id = v_group
        AND i.invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND i.status NOT IN ('draft', 'cancelled')
    ),
    'low_stock_count', (
      SELECT COUNT(*)
      FROM public.pricing_alerts pa
      JOIN public.companies c ON c.id = pa.company_id
      WHERE c.franchise_group_id = v_group
        AND pa.alert_type = 'low_stock'
        AND pa.is_active = true
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_franchise_overview() TO authenticated;

-- ─── RPC: get_franchise_showroom_comparison() ────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_franchise_showroom_comparison()
  RETURNS TABLE(
    company_id uuid,
    name text,
    revenue_mtd numeric,
    revenue_prev_month numeric,
    outstanding numeric,
    invoice_count_mtd bigint,
    low_stock_count bigint
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_group uuid;
BEGIN
  v_group := public.get_franchise_group_id();
  IF v_group IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    COALESCE(SUM(i.taxable_amount) FILTER (
      WHERE i.invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND i.status NOT IN ('draft', 'cancelled')
        AND i.payment_status IN ('partial', 'paid')
    ), 0) AS revenue_mtd,
    COALESCE(SUM(i.taxable_amount) FILTER (
      WHERE i.invoice_date >= DATE_TRUNC('month', CURRENT_DATE) - interval '1 month'
        AND i.invoice_date <  DATE_TRUNC('month', CURRENT_DATE)
        AND i.status NOT IN ('draft', 'cancelled')
        AND i.payment_status IN ('partial', 'paid')
    ), 0) AS revenue_prev_month,
    COALESCE(SUM(i.total_amount) FILTER (
      WHERE i.payment_status <> 'paid'
        AND i.status NOT IN ('draft', 'cancelled')
    ), 0) AS outstanding,
    COUNT(i.id) FILTER (
      WHERE i.invoice_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND i.status NOT IN ('draft', 'cancelled')
    ) AS invoice_count_mtd,
    (
      SELECT COUNT(*)
      FROM public.pricing_alerts pa
      WHERE pa.company_id = c.id
        AND pa.alert_type = 'low_stock'
        AND pa.is_active = true
    ) AS low_stock_count
  FROM public.companies c
  LEFT JOIN public.invoices i ON i.company_id = c.id
  WHERE c.franchise_group_id = v_group
  GROUP BY c.id, c.name
  ORDER BY revenue_mtd DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_franchise_showroom_comparison() TO authenticated;

-- ─── RPC: get_franchise_revenue_trend(p_months) ──────────────────────────────

CREATE OR REPLACE FUNCTION public.get_franchise_revenue_trend(p_months int DEFAULT 6)
  RETURNS TABLE(month text, revenue numeric)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_group uuid;
BEGIN
  IF p_months < 1 OR p_months > 60 THEN
    RAISE EXCEPTION 'p_months must be between 1 and 60, got %', p_months;
  END IF;

  v_group := public.get_franchise_group_id();
  IF v_group IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      (DATE_TRUNC('month', CURRENT_DATE) - ((p_months - 1) || ' months')::interval)::date,
      DATE_TRUNC('month', CURRENT_DATE)::date,
      '1 month'
    ) AS month_start
  )
  SELECT
    TO_CHAR(months.month_start, 'YYYY-MM') AS month,
    COALESCE(SUM(i.taxable_amount), 0)::numeric AS revenue
  FROM months
  LEFT JOIN public.invoices i
    ON DATE_TRUNC('month', i.invoice_date) = months.month_start
    AND i.company_id IN (
      SELECT c.id FROM public.companies c WHERE c.franchise_group_id = v_group
    )
    AND i.status NOT IN ('draft', 'cancelled')
    AND i.payment_status IN ('partial', 'paid')
  GROUP BY months.month_start
  ORDER BY months.month_start ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_franchise_revenue_trend(int) TO authenticated;

-- ─── RPC: get_franchise_top_products(p_limit) ────────────────────────────────
-- Aggregated by product NAME: member companies have separate product rows, and
-- the same SKU appears under the same name across showrooms.

CREATE OR REPLACE FUNCTION public.get_franchise_top_products(p_limit int DEFAULT 5)
  RETURNS TABLE(name text, revenue numeric)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_group uuid;
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 100, got %', p_limit;
  END IF;

  v_group := public.get_franchise_group_id();
  IF v_group IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.name,
    SUM(ii.taxable_amount)::numeric AS revenue
  FROM public.invoice_items ii
  JOIN public.invoices inv ON inv.id = ii.invoice_id
  JOIN public.products p   ON p.id  = ii.product_id
  JOIN public.companies c  ON c.id  = ii.company_id
  WHERE c.franchise_group_id = v_group
    AND inv.status NOT IN ('draft', 'cancelled')
    AND inv.payment_status IN ('partial', 'paid')
  GROUP BY p.name
  ORDER BY SUM(ii.taxable_amount) DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_franchise_top_products(int) TO authenticated;

-- =============================================================================
-- Auth hook: honor app_metadata.active_company_id (company switcher)
-- The switcher server action validates membership and writes
-- app_metadata.active_company_id; the hook re-validates against company_users
-- before trusting it, then falls back to admin-first/oldest-first.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
AS $$
DECLARE
  v_user_id    uuid;
  v_active     uuid;
  v_company_id uuid;
  v_role       text;
  v_user_type  text;
  v_claims     jsonb;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims  := event->'claims';

  -- Switcher preference: only honored when a matching membership row exists.
  v_active := NULLIF(v_claims->'app_metadata'->>'active_company_id', '')::uuid;
  IF v_active IS NOT NULL THEN
    SELECT company_id, role::text
      INTO v_company_id, v_role
      FROM public.company_users
     WHERE user_id = v_user_id AND company_id = v_active
     LIMIT 1;
  END IF;

  -- Fallback: deterministic admin-first, oldest-first (pre-switcher behavior).
  IF v_company_id IS NULL THEN
    SELECT company_id, role::text
      INTO v_company_id, v_role
      FROM public.company_users
     WHERE user_id = v_user_id
     ORDER BY (role = 'admin') DESC, created_at ASC
     LIMIT 1;
  END IF;

  IF v_company_id IS NOT NULL THEN
    v_user_type := 'business';
  ELSE
    v_company_id := NULL;
    v_role       := 'none';
    v_user_type  := 'customer';
  END IF;

  v_claims := v_claims
    || jsonb_build_object(
         'company_id', v_company_id,
         'role',       v_role,
         'user_type',  v_user_type
       );

  RETURN jsonb_build_object('claims', v_claims);
END;
$$;
