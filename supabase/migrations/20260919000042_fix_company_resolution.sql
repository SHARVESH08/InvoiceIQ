-- =============================================================================
-- InvoiceIQ — Migration 042: Correct company resolution
--
-- Two long-standing defects, both invisible until a user belonged to more than
-- one company. Creating a franchise demo made that real.
--
-- 1. get_company_id() was `SELECT company_id FROM company_users WHERE user_id =
--    auth.uid() LIMIT 1` with NO ORDER BY. For a multi-company user Postgres is
--    free to return either row, and may return a different one as plans change.
--    Since every write scopes on this, a franchise owner could have an invoice
--    land in the wrong showroom.
--
--    It also ignored app_metadata.active_company_id entirely — which is the
--    value switchActiveCompany() writes. The company switcher therefore did
--    nothing: the UI changed, the data scope did not.
--
-- 2. custom_access_token_hook was not SECURITY DEFINER. Supabase Auth runs it
--    as supabase_auth_admin, which is not the owner of company_users and has no
--    policy on it — and that table is RLS FORCE. The hook's lookup returned
--    zero rows, so every JWT issued carried company_id: null,
--    company_role: "none", user_type: "customer", including for admins.
--
--    Nothing currently reads those claims (company scoping goes through the
--    SECURITY DEFINER RPCs, and the RLS policies only use auth.jwt()->>'phone'),
--    which is why this never surfaced as a visible bug. It still meant the
--    token was lying, and left a trap for the first policy to trust it.
-- =============================================================================

-- ─── get_company_id(): switcher-aware and deterministic ──────────────────────
-- Kept as LANGUAGE sql (not plpgsql) because this is called from RLS policies
-- on hot paths; one ordered SELECT expresses the whole precedence rule:
--   1. the company the user explicitly switched to, when they are a member
--   2. otherwise admin memberships first
--   3. then oldest membership first
-- which is exactly the order custom_access_token_hook uses, so the RPC and the
-- JWT can no longer disagree.
--
-- The boolean sort key is NULL for every row when no active_company_id is set,
-- so the comparison ties and resolution falls through to the next key.

CREATE OR REPLACE FUNCTION public.get_company_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT cu.company_id
  FROM public.company_users cu
  WHERE cu.user_id = auth.uid()
  ORDER BY
    (
      cu.company_id = NULLIF(
        current_setting('request.jwt.claims', true)::jsonb
          -> 'app_metadata' ->> 'active_company_id',
        ''
      )::uuid
    ) DESC NULLS LAST,
    (cu.role = 'admin') DESC,
    cu.created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_id() TO authenticated;

-- ─── custom_access_token_hook: run as owner so it can read company_users ─────
-- Body is unchanged from migration 037 apart from SECURITY DEFINER and an
-- explicit empty search_path (required whenever a definer function is added —
-- every reference below is already schema-qualified).

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
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

  -- Fallback: deterministic admin-first, oldest-first.
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

  -- NEVER set 'role' here: PostgREST maps the JWT 'role' claim to the
  -- PostgreSQL role. Supabase sets role='authenticated' in the base claims
  -- and it must stay that way (migration 012).
  v_claims := v_claims
    || jsonb_build_object(
         'company_id',   v_company_id,
         'company_role', v_role,
         'user_type',    v_user_type
       );

  RETURN jsonb_build_object('claims', v_claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
