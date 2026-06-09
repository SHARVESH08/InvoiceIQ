-- =============================================================================
-- InvoiceIQ — Migration 008: Custom Access Token Hook (D-09, D-10, D-11)
-- Injects company_id, role, user_type into every issued JWT
-- NOTE: companies table has no owner_user_id column.
-- Ownership is determined by role='admin' in company_users.
-- =============================================================================

-- ─── Function: custom_access_token_hook ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  -- Instead grant execute to supabase_auth_admin explicitly below.
AS $$
DECLARE
  v_user_id    uuid;
  v_company_id uuid;
  v_role       text;
  v_user_type  text;
  v_claims     jsonb;
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims  := event->'claims';

  -- Deterministic single-query lookup (Codex HIGH fix: ORDER BY admin-first, oldest-first)
  -- Users with multiple company_users rows (e.g., admin in one, salesperson in another)
  -- always get their admin role surfaced first in the JWT.
  SELECT company_id, role::text
    INTO v_company_id, v_role
    FROM public.company_users
   WHERE user_id = v_user_id
   ORDER BY (role = 'admin') DESC, created_at ASC
   LIMIT 1;

  IF FOUND THEN
    v_user_type := 'business';
  ELSE
    -- No company affiliation yet (new user during signup, or end customer).
    -- role must be a non-null string — Supabase JWT schema rejects null.
    v_company_id := NULL;
    v_role       := 'none';
    v_user_type  := 'customer';
  END IF;

  -- Inject custom claims (D-11: flat keys 'company_id', 'role', 'user_type')
  v_claims := v_claims
    || jsonb_build_object(
         'company_id', v_company_id,
         'role',       v_role,
         'user_type',  v_user_type
       );

  RETURN jsonb_build_object('claims', v_claims);
END;
$$;

-- ─── Grants required by Supabase Auth ────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

GRANT EXECUTE
  ON FUNCTION public.custom_access_token_hook(jsonb)
  TO supabase_auth_admin;

REVOKE EXECUTE
  ON FUNCTION public.custom_access_token_hook(jsonb)
  FROM authenticated, anon, public;

-- ─── RLS: grant supabase_auth_admin read access to company_users ─────────────
-- MANDATORY (Risk 6): without this, the hook runs as supabase_auth_admin which
-- cannot bypass RLS on company_users, silently returning null claims for everyone.

GRANT SELECT ON public.company_users TO supabase_auth_admin;
