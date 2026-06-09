-- =============================================================================
-- InvoiceIQ — Migration 001: Schema (ENUMs + Tables)
-- Applied: supabase db push
-- Depends on: nothing
-- Required by: 002_indexes, 003_functions, 004_triggers, 005_rls, 006_pg_cron
-- =============================================================================

-- ─── Enum Types ──────────────────────────────────────────────────────────────

CREATE TYPE public.gst_type_enum          AS ENUM ('regular', 'composition', 'unregistered');
CREATE TYPE public.company_type_enum      AS ENUM ('OEM', 'Distributor', 'Retailer');
CREATE TYPE public.user_role_enum         AS ENUM ('admin', 'accountant', 'salesperson', 'ca');
CREATE TYPE public.invoice_type_enum      AS ENUM ('B2B', 'B2CS', 'B2CL');
CREATE TYPE public.payment_status_enum    AS ENUM ('unpaid', 'partial', 'paid');
CREATE TYPE public.payment_method_enum    AS ENUM ('cash', 'upi', 'bank_transfer', 'razorpay', 'cheque');
CREATE TYPE public.po_status_enum         AS ENUM ('draft', 'sent', 'partial', 'received', 'cancelled');
CREATE TYPE public.wa_session_status_enum AS ENUM ('active', 'closed');
CREATE TYPE public.alert_type_enum        AS ENUM ('low_stock', 'price_change');
CREATE TYPE public.gst_period_type_enum   AS ENUM ('GSTR-1', 'GSTR-3B', 'GSTR-9');
CREATE TYPE public.gst_period_status_enum AS ENUM ('draft', 'ready', 'filed');

-- ─── Table 1: companies ──────────────────────────────────────────────────────

CREATE TABLE public.companies (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  gstin        text        CHECK (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
  gst_type     public.gst_type_enum    NOT NULL DEFAULT 'regular',
  company_type public.company_type_enum NOT NULL,
  state_code   text        NOT NULL,
  address      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── Table 2: company_users ──────────────────────────────────────────────────

CREATE TABLE public.company_users (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  role        public.user_role_enum NOT NULL DEFAULT 'salesperson',
  invited_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

-- ─── Table 3: customer_profiles ──────────────────────────────────────────────
-- Cross-tenant: NO company_id. Model B RLS only. Users own their profile.

CREATE TABLE public.customer_profiles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone      text,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Table 4: godowns ────────────────────────────────────────────────────────
-- Defined before inventory (inventory.godown_id FK → godowns.id)

CREATE TABLE public.godowns (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  address    text,
  is_default boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Table 5: products ───────────────────────────────────────────────────────

CREATE TABLE public.products (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text          NOT NULL,
  hsn_code    text          CHECK (length(hsn_code) <= 8),
  unit        text          NOT NULL DEFAULT 'pcs',
  base_price  numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate    numeric(5,2)  NOT NULL DEFAULT 0,
  description text,
  created_at  timestamptz   NOT NULL DEFAULT now()
);

-- ─── Table 6: inventory ──────────────────────────────────────────────────────
-- godown_id NOT NULL (D-08): every stock record belongs to exactly one godown

CREATE TABLE public.inventory (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id    uuid          NOT NULL REFERENCES public.products(id)  ON DELETE CASCADE,
  godown_id     uuid          NOT NULL REFERENCES public.godowns(id)   ON DELETE RESTRICT,
  quantity      numeric(12,3) NOT NULL DEFAULT 0,
  reorder_level numeric(12,3) NOT NULL DEFAULT 0,
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (product_id, godown_id)
);

-- ─── Table 7: customers ──────────────────────────────────────────────────────

CREATE TABLE public.customers (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  gstin            text,
  phone            text,
  email            text,
  billing_address  jsonb,
  shipping_address jsonb,
  state_code       text,
  credit_limit     numeric(12,2) NOT NULL DEFAULT 0,
  customer_type    text          NOT NULL DEFAULT 'b2c'
                   CHECK (customer_type IN ('b2b', 'b2c')),
  customer_profile_id uuid      REFERENCES public.customer_profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── Table 8: suppliers ──────────────────────────────────────────────────────

CREATE TABLE public.suppliers (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  gstin      text,
  phone      text,
  email      text,
  address    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Table 9: invoices ───────────────────────────────────────────────────────
-- public_id: random UUID separate from PK — prevents enumeration attacks (SCHEMA-03)
-- customer_email / customer_phone: nullable, denormalized for Model B RLS (SCHEMA-04, INVOICE-04)
--   Phase 4 populates these at INSERT time. Phase 1 adds them as nullable so the
--   RLS policy in 005_rls.sql can reference these columns without DDL error.

CREATE TABLE public.invoices (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id       uuid          NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  company_id      uuid          NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  customer_id     uuid          NOT NULL REFERENCES public.customers(id),
  invoice_number  text,
  invoice_date    date          NOT NULL DEFAULT CURRENT_DATE,
  due_date        date,
  invoice_type    public.invoice_type_enum NOT NULL DEFAULT 'B2CS',
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  taxable_amount  numeric(12,2) NOT NULL DEFAULT 0,
  cgst_amount     numeric(12,2) NOT NULL DEFAULT 0,
  sgst_amount     numeric(12,2) NOT NULL DEFAULT 0,
  igst_amount     numeric(12,2) NOT NULL DEFAULT 0,
  total_amount    numeric(12,2) NOT NULL DEFAULT 0,
  payment_status  public.payment_status_enum NOT NULL DEFAULT 'unpaid',
  customer_email  text,
  customer_phone  text,
  payment_link_url text,
  pdf_url         text,
  notes           text,
  state_code      text,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

-- ─── Table 10: invoice_items ─────────────────────────────────────────────────

CREATE TABLE public.invoice_items (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       uuid          NOT NULL REFERENCES public.invoices(id)  ON DELETE CASCADE,
  product_id       uuid          REFERENCES public.products(id),
  company_id       uuid          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  description      text,
  quantity         numeric(12,3) NOT NULL DEFAULT 1,
  unit_price       numeric(12,2) NOT NULL DEFAULT 0,
  discount_percent numeric(5,2)  NOT NULL DEFAULT 0,
  taxable_amount   numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate         numeric(5,2)  NOT NULL DEFAULT 0,
  cgst_rate        numeric(5,2)  NOT NULL DEFAULT 0,
  sgst_rate        numeric(5,2)  NOT NULL DEFAULT 0,
  igst_rate        numeric(5,2)  NOT NULL DEFAULT 0,
  cgst_amount      numeric(12,2) NOT NULL DEFAULT 0,
  sgst_amount      numeric(12,2) NOT NULL DEFAULT 0,
  igst_amount      numeric(12,2) NOT NULL DEFAULT 0,
  total_amount     numeric(12,2) NOT NULL DEFAULT 0,
  hsn_code         text,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

-- ─── Table 11: payments ──────────────────────────────────────────────────────

CREATE TABLE public.payments (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id          uuid          NOT NULL REFERENCES public.invoices(id)  ON DELETE CASCADE,
  amount              numeric(12,2) NOT NULL,
  payment_method      public.payment_method_enum NOT NULL,
  razorpay_payment_id text,
  paid_at             timestamptz   NOT NULL DEFAULT now(),
  notes               text,
  created_at          timestamptz   NOT NULL DEFAULT now()
);

-- ─── Table 12: purchase_orders ───────────────────────────────────────────────

CREATE TABLE public.purchase_orders (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id       uuid          NOT NULL REFERENCES public.suppliers(id),
  po_number         text,
  status            public.po_status_enum NOT NULL DEFAULT 'draft',
  total_amount      numeric(12,2) NOT NULL DEFAULT 0,
  expected_delivery date,
  created_at        timestamptz   NOT NULL DEFAULT now()
);

-- ─── Table 13: purchase_order_items ──────────────────────────────────────────

CREATE TABLE public.purchase_order_items (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id             uuid          NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id        uuid          NOT NULL REFERENCES public.products(id),
  company_id        uuid          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quantity_ordered  numeric(12,3) NOT NULL DEFAULT 0,
  quantity_received numeric(12,3) NOT NULL DEFAULT 0,
  unit_price        numeric(12,2) NOT NULL DEFAULT 0,
  total_amount      numeric(12,2) NOT NULL DEFAULT 0
);

-- ─── Table 14: whatsapp_sessions ─────────────────────────────────────────────

CREATE TABLE public.whatsapp_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_phone  text        NOT NULL,
  conversation_id text,
  state           text        NOT NULL DEFAULT 'init',
  cart            jsonb,
  last_message_at timestamptz,
  expires_at      timestamptz,
  status          public.wa_session_status_enum NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Table 15: audit_log ─────────────────────────────────────────────────────
-- No company_id (cross-table audit, written by SECURITY DEFINER trigger).
-- changed_by is NULLABLE — auth.uid() returns NULL when trigger fires via
-- service_role connection (no user JWT). A NOT NULL constraint would cause ALL
-- service-role-triggered DML to fail.

CREATE TABLE public.audit_log (
  id         bigserial   PRIMARY KEY,
  table_name text        NOT NULL,
  record_id  uuid,
  action     text        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet
);

-- ─── Table 16: pricing_alerts ────────────────────────────────────────────────

CREATE TABLE public.pricing_alerts (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id   uuid          NOT NULL REFERENCES public.products(id)  ON DELETE CASCADE,
  alert_type   public.alert_type_enum NOT NULL,
  threshold    numeric(12,2),
  is_active    boolean       NOT NULL DEFAULT true,
  triggered_at timestamptz,
  created_at   timestamptz   NOT NULL DEFAULT now()
);

-- ─── Table 17: gst_period_data ───────────────────────────────────────────────

CREATE TABLE public.gst_period_data (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_type public.gst_period_type_enum   NOT NULL,
  fy          text        NOT NULL,
  period      text        NOT NULL,
  status      public.gst_period_status_enum NOT NULL DEFAULT 'draft',
  filed_at    timestamptz,
  data        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Supporting Table: invoice_sequences (D-09) ──────────────────────────────
-- PK (company_id, fy) — generate_invoice_number() uses SELECT FOR UPDATE on this row.

CREATE TABLE public.invoice_sequences (
  company_id uuid    NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fy         text    NOT NULL,
  last_seq   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, fy)
);
