-- =============================================================================
-- InvoiceIQ — Migration 038: Telephony (Exotel click-to-call + recordings)
--
-- telephony_settings: per-company Exotel credentials + virtual number.
--   Admin-only RLS. The api_token is a secret: it is only ever read
--   server-side (server actions / webhook fallback), never sent to clients.
-- telephony_agents: each user's own phone number (the leg Exotel dials first).
-- crm_calls: one row per outbound call; the StatusCallback webhook fills in
--   status/duration/recording and links a crm_interactions row for the
--   customer timeline.
-- =============================================================================

-- gen_random_bytes lives in pgcrypto (extensions schema on Supabase).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.telephony_settings (
  company_id     uuid        PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  provider       text        NOT NULL DEFAULT 'exotel' CHECK (provider IN ('exotel')),
  account_sid    text        NOT NULL,
  api_key        text        NOT NULL,
  api_token      text        NOT NULL,
  virtual_number text        NOT NULL, -- the Exophone used as CallerId
  -- Shared secret embedded in the StatusCallback URL; Exotel v1 does not sign
  -- webhooks, so this is the webhook's auth.
  webhook_token  text        NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  record_calls   boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.telephony_agents (
  company_id uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  phone      text        NOT NULL CHECK (length(trim(phone)) BETWEEN 8 AND 16),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);

CREATE TABLE public.crm_calls (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider          text        NOT NULL DEFAULT 'exotel',
  provider_call_sid text        UNIQUE,
  agent_user_id     uuid        NOT NULL REFERENCES auth.users(id),
  agent_number      text        NOT NULL,
  customer_number   text        NOT NULL,
  customer_id       uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id           uuid        REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  deal_id           uuid        REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  -- Provider status values vary ('completed','failed','busy','no-answer',...);
  -- kept as text on purpose.
  status            text        NOT NULL DEFAULT 'initiated',
  duration_seconds  int,
  recording_url     text,
  interaction_id    uuid        REFERENCES public.crm_interactions(id) ON DELETE SET NULL,
  started_at        timestamptz,
  ended_at          timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_calls_company_created ON public.crm_calls(company_id, created_at DESC);
CREATE INDEX idx_crm_calls_customer ON public.crm_calls(customer_id) WHERE customer_id IS NOT NULL;

CREATE TRIGGER trg_telephony_settings_touch BEFORE UPDATE ON public.telephony_settings
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();

-- ─── Grants + RLS ────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telephony_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telephony_agents   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_calls          TO authenticated;

ALTER TABLE public.telephony_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telephony_settings FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.telephony_agents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telephony_agents   FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.crm_calls          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_calls          FORCE  ROW LEVEL SECURITY;

-- Credentials: admins of the company only.
CREATE POLICY "admin_only" ON public.telephony_settings
  FOR ALL
  USING (
    company_id = (SELECT public.get_company_id())
    AND EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = telephony_settings.company_id
        AND cu.user_id = auth.uid() AND cu.role = 'admin'
    )
  )
  WITH CHECK (
    company_id = (SELECT public.get_company_id())
    AND EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = telephony_settings.company_id
        AND cu.user_id = auth.uid() AND cu.role = 'admin'
    )
  );

-- Agents manage their own number within the active company.
CREATE POLICY "own_row" ON public.telephony_agents
  FOR ALL
  USING (company_id = (SELECT public.get_company_id()) AND user_id = auth.uid())
  WITH CHECK (company_id = (SELECT public.get_company_id()) AND user_id = auth.uid());

CREATE POLICY "company_isolation" ON public.crm_calls
  FOR ALL
  USING      (company_id = (SELECT public.get_company_id()))
  WITH CHECK (company_id = (SELECT public.get_company_id()));
