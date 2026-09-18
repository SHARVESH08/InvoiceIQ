-- =============================================================================
-- InvoiceIQ — Migration 041: Per-user notification inbox
--
-- Events that matter to a person (a franchise invite, stock running out, a PO
-- being confirmed) currently surface only as a badge somewhere, or not at all.
-- This gives every user a durable, per-user inbox.
--
-- Design notes:
--
--   • Rows are owned by a USER, not a company. A franchise owner holds seats in
--     several companies and must see notifications from all of them; company_id
--     is kept alongside for filtering and display, not for ownership.
--
--   • Creation goes through create_notification(), which is SECURITY DEFINER and
--     deliberately NOT granted to `authenticated`. Notifications are written FOR
--     other users (invite the target company's admins, warn every admin about
--     low stock), which a caller-scoped RLS policy can't express. Keeping the
--     writer callable only from other definer functions and triggers means there
--     is no path for a user to fabricate notifications for anyone.
--
--   • dedupe_key + a partial unique index stop repeat events from stacking up:
--     an unread "Rice is low on stock" is updated in place rather than inserted
--     again on every subsequent sale.
-- =============================================================================

CREATE TYPE public.notification_type_enum AS ENUM (
  'franchise_invite',
  'franchise_response',
  'low_stock',
  'po_status',
  'task_due',
  'system'
);

CREATE TABLE public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  -- Which company the event belongs to. NULL for account-level notices.
  company_id  uuid        REFERENCES public.companies(id)        ON DELETE CASCADE,
  type        public.notification_type_enum NOT NULL,
  title       text        NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  body        text        CHECK (body IS NULL OR length(body) <= 1000),
  -- In-app destination for the row's click target, e.g. '/settings/franchise'.
  link        text        CHECK (link IS NULL OR link ~ '^/'),
  -- Collapses repeat events while still unread. NULL opts out of deduping.
  dedupe_key  text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- The inbox: newest first, per user.
CREATE INDEX idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

-- The bell's unread count. Partial, because read rows are the vast majority
-- over time and never participate in this query.
CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id)
  WHERE read_at IS NULL;

-- One live notification per (user, dedupe_key). Scoped to unread rows so the
-- same event can legitimately recur after the user has dealt with it.
CREATE UNIQUE INDEX idx_notifications_dedupe
  ON public.notifications(user_id, dedupe_key)
  WHERE read_at IS NULL AND dedupe_key IS NOT NULL;

-- ─── Grants + RLS ────────────────────────────────────────────────────────────
-- SELECT/UPDATE only: users read their inbox and mark rows read. INSERT and
-- DELETE are intentionally withheld — writes happen through create_notification.

GRANT SELECT, UPDATE ON public.notifications TO authenticated;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE  ROW LEVEL SECURITY;

CREATE POLICY "own_notifications_select"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Mark-as-read only. WITH CHECK repeats the ownership test so a user cannot
-- reassign a row to someone else in the same statement.
CREATE POLICY "own_notifications_update"
  ON public.notifications FOR UPDATE
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── Writer ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id    uuid,
  p_company_id uuid,
  p_type       public.notification_type_enum,
  p_title      text,
  p_body       text DEFAULT NULL,
  p_link       text DEFAULT NULL,
  p_dedupe_key text DEFAULT NULL
)
  RETURNS uuid
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_title IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, company_id, type, title, body, link, dedupe_key)
  VALUES (p_user_id, p_company_id, p_type, p_title, p_body, p_link, p_dedupe_key)
  ON CONFLICT (user_id, dedupe_key) WHERE read_at IS NULL AND dedupe_key IS NOT NULL
  DO UPDATE SET
    title      = EXCLUDED.title,
    body       = EXCLUDED.body,
    link       = EXCLUDED.link,
    created_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- No GRANT to authenticated: callable only from other SECURITY DEFINER
-- functions and triggers, which run as the owner.
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, public.notification_type_enum, text, text, text, text)
  FROM authenticated, anon, public;

-- ─── Fan-out helper: notify a company's members ──────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_company_members(
  p_company_id uuid,
  p_roles      text[],
  p_type       public.notification_type_enum,
  p_title      text,
  p_body       text DEFAULT NULL,
  p_link       text DEFAULT NULL,
  p_dedupe_key text DEFAULT NULL
)
  RETURNS integer
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_count integer := 0;
  v_user  uuid;
BEGIN
  FOR v_user IN
    SELECT cu.user_id
    FROM public.company_users cu
    WHERE cu.company_id = p_company_id
      -- NULL p_roles means "everyone in the company".
      AND (p_roles IS NULL OR cu.role::text = ANY(p_roles))
  LOOP
    PERFORM public.create_notification(
      v_user, p_company_id, p_type, p_title, p_body, p_link, p_dedupe_key
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_company_members(uuid, text[], public.notification_type_enum, text, text, text, text)
  FROM authenticated, anon, public;

-- ─── Reader: unread count for the bell ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT COUNT(*)::integer
  FROM public.notifications
  WHERE user_id = auth.uid()
    AND read_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;

-- =============================================================================
-- Event source 1: franchise invites
-- Amends the migration 035 RPCs so the people who must ACT on an invite are
-- actually told it exists, instead of having to visit Settings on a hunch.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.invite_company_to_franchise(p_group_id uuid, p_company_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_invite_id  uuid;
  v_group_name text;
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

  SELECT name INTO v_group_name FROM public.franchise_groups WHERE id = p_group_id;

  -- Only admins can accept, so only admins are notified.
  PERFORM public.notify_company_members(
    p_company_id,
    ARRAY['admin'],
    'franchise_invite',
    'Franchise invitation',
    format('%s has invited your company to join their franchise group.', COALESCE(v_group_name, 'A franchise group')),
    '/settings/franchise',
    'franchise_invite:' || v_invite_id::text
  );

  RETURN v_invite_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'An invite for this company is already pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_company_to_franchise(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_franchise_invite(p_invite_id uuid, p_accept boolean)
  RETURNS void
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_invite       public.franchise_invites%ROWTYPE;
  v_company_name text;
  v_owner        uuid;
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

  SELECT name INTO v_company_name FROM public.companies WHERE id = v_invite.company_id;

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

  -- Close the loop for the owners who sent the invite.
  FOR v_owner IN
    SELECT fo.user_id FROM public.franchise_owners fo WHERE fo.group_id = v_invite.group_id
  LOOP
    PERFORM public.create_notification(
      v_owner,
      NULL,
      'franchise_response',
      CASE WHEN p_accept THEN 'Franchise invite accepted' ELSE 'Franchise invite declined' END,
      format('%s %s your invitation.',
             COALESCE(v_company_name, 'A company'),
             CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END),
      '/hq/showrooms',
      'franchise_response:' || p_invite_id::text
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_franchise_invite(uuid, boolean) TO authenticated;

-- =============================================================================
-- Event source 2: low stock
-- Fires when a pricing_alerts low_stock row becomes active. Deduped per
-- product, so a product selling all day produces one unread notification.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_low_stock_alert()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_product_name text;
BEGIN
  IF NEW.alert_type <> 'low_stock' OR NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only fire on the false -> true edge, not on every touch.
  IF TG_OP = 'UPDATE' AND OLD.is_active IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_product_name FROM public.products WHERE id = NEW.product_id;

  PERFORM public.notify_company_members(
    NEW.company_id,
    ARRAY['admin', 'manager'],
    'low_stock',
    'Low stock',
    format('%s has fallen to or below its reorder level.', COALESCE(v_product_name, 'A product')),
    '/inventory?filter=low_stock',
    'low_stock:' || NEW.product_id::text
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER notify_on_low_stock_alert
  AFTER INSERT OR UPDATE ON public.pricing_alerts
  FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock_alert();

-- =============================================================================
-- Event source 3: purchase order status changes
-- Notifies the counterparty — the OEM that raised the PO and the Distributor
-- fulfilling it each hear about transitions the other side drives.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_po_status_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_po_label text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_po_label := COALESCE(NEW.po_number, 'A purchase order');

  -- Buyer side: told when the distributor acts on their PO.
  IF NEW.status IN ('confirmed', 'rejected', 'dispatched') THEN
    PERFORM public.notify_company_members(
      NEW.company_id,
      ARRAY['admin', 'manager'],
      'po_status',
      format('PO %s', NEW.status),
      format('%s was marked %s.', v_po_label, NEW.status),
      '/dashboard/purchase-orders',
      'po_status:' || NEW.id::text || ':' || NEW.status
    );
  END IF;

  -- Distributor side: told when a new PO lands, or when goods are received.
  IF NEW.status IN ('sent', 'received') AND NEW.distributor_company_id IS NOT NULL THEN
    PERFORM public.notify_company_members(
      NEW.distributor_company_id,
      ARRAY['admin', 'manager'],
      'po_status',
      CASE WHEN NEW.status = 'sent' THEN 'New purchase order' ELSE 'Purchase order received' END,
      format('%s was marked %s.', v_po_label, NEW.status),
      '/dashboard/purchase-orders',
      'po_status:' || NEW.id::text || ':' || NEW.status
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER notify_on_po_status_change
  AFTER UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_po_status_change();
