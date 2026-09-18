-- =============================================================================
-- InvoiceIQ — Migration 039: IAM roles
--
-- Adds the two roles the existing enum was missing ('manager', 'billing') and
-- exposes the caller's role to the app through get_company_role().
--
-- The enum is EXTENDED, never rewritten: 'admin', 'accountant', 'salesperson'
-- and 'ca' already exist on live company_users rows and are referenced by RLS
-- policies (e.g. franchise_invites' owners_or_target_admin_select_invites).
-- Renaming them would silently invalidate both.
-- =============================================================================

-- ─── Enum extension ──────────────────────────────────────────────────────────
-- IF NOT EXISTS keeps this idempotent. PG12+ permits ADD VALUE inside a
-- transaction as long as the new label isn't *used* in the same transaction —
-- nothing below writes one, so this is safe in a migration.

ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'billing';

-- ─── RPC: get_company_role() ─────────────────────────────────────────────────
-- The caller's role in their ACTIVE company. Resolution deliberately mirrors
-- custom_access_token_hook (migration 037) so the role the UI gates on and the
-- role baked into the JWT can never disagree:
--   1. app_metadata.active_company_id, but only if a membership row backs it
--   2. otherwise admin-first, then oldest-first
--
-- Returns NULL for users with no company membership (i.e. portal customers).

CREATE OR REPLACE FUNCTION public.get_company_role()
  RETURNS text
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_active uuid;
  v_role   text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  v_active := NULLIF(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'active_company_id',
    ''
  )::uuid;

  IF v_active IS NOT NULL THEN
    SELECT cu.role::text
      INTO v_role
      FROM public.company_users cu
     WHERE cu.user_id = auth.uid()
       AND cu.company_id = v_active
     LIMIT 1;
  END IF;

  IF v_role IS NULL THEN
    SELECT cu.role::text
      INTO v_role
      FROM public.company_users cu
     WHERE cu.user_id = auth.uid()
     ORDER BY (cu.role = 'admin') DESC, cu.created_at ASC
     LIMIT 1;
  END IF;

  RETURN v_role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_role() TO authenticated;
