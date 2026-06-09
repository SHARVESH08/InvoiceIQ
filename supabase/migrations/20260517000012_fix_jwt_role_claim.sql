-- =============================================================================
-- InvoiceIQ — Migration 012: Fix JWT 'role' claim collision with PostgREST
-- =============================================================================
-- The auth hook was injecting 'role': 'admin'|'accountant'|... into the JWT.
-- PostgREST reads the JWT 'role' claim to SET the PostgreSQL role for the
-- request. Since 'admin', 'accountant', etc. are not PostgreSQL roles,
-- every authenticated request failed with "permission denied for table X".
--
-- Fix: store the company membership role under 'company_role' instead.
-- The Supabase platform sets 'role': 'authenticated' in the base JWT;
-- we must not override it.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
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

  SELECT company_id, role::text
    INTO v_company_id, v_role
    FROM public.company_users
   WHERE user_id = v_user_id
   ORDER BY (role = 'admin') DESC, created_at ASC
   LIMIT 1;

  IF FOUND THEN
    v_user_type := 'business';
  ELSE
    v_company_id := NULL;
    v_role       := 'none';
    v_user_type  := 'customer';
  END IF;

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
