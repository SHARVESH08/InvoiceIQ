-- =============================================================================
-- InvoiceIQ — Migration 009: invitations table (D-13)
-- Pre-invite data store for sub-user invite flow (AUTH-06)
-- Role column uses public.user_role_enum ('ca' lowercase — Risk 7)
-- =============================================================================

CREATE TABLE public.invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL,
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role        public.user_role_enum NOT NULL,
  invited_by  uuid        NOT NULL REFERENCES auth.users(id),
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_email      ON public.invitations(email);
CREATE INDEX idx_invitations_company_id ON public.invitations(company_id);

-- ─── RLS (matches project pattern from migration 005) ────────────────────────

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;

-- Company admins can INSERT invitations for their own company (defense-in-depth: T-2-02-03)
CREATE POLICY "admin_can_invite"
  ON public.invitations
  FOR INSERT
  WITH CHECK (
    company_id = (SELECT public.get_company_id())
    AND EXISTS (
      SELECT 1 FROM public.company_users
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND company_id = invitations.company_id
    )
  );

-- Company admins can view invitations for their company
CREATE POLICY "admin_can_view_invitations"
  ON public.invitations
  FOR SELECT
  USING (company_id = (SELECT public.get_company_id()));

-- NOTE (Risk 5): The invitation callback route handler (plan 02-06) uses
-- createAdminClient() (service role) to SELECT from invitations — this bypasses
-- RLS entirely. No additional SELECT policy is needed for the invitee because
-- the invitee is not yet in company_users when the callback fires, so
-- get_company_id() would return NULL and the admin_can_view_invitations policy
-- would match 0 rows. Service role is the correct approach for this path.
