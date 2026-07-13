-- =============================================================================
-- InvoiceIQ — Migration 037: Fix JWT 'role' claim regression from migration 035
-- =============================================================================
-- Migration 035 rewrote custom_access_token_hook from the 008 version and
-- reintroduced the bug migration 012 fixed: it injected
-- 'role': 'admin'|'salesperson'|'none' into the JWT. PostgREST maps the JWT
-- 'role' claim to the PostgreSQL role for the request, so every token issued
-- after 035 failed with "permission denied for table X" (user-visible on the
-- first surfaced mutation, e.g. crm_deals inserts).
--
-- This restores 012's claim layout ('company_role', never 'role') while
-- keeping 035's company-switcher preference (validated
-- app_metadata.active_company_id).
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
