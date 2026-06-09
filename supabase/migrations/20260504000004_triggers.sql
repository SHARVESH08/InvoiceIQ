-- =============================================================================
-- InvoiceIQ — Migration 004: Triggers
-- Applied after: 20260504000003_functions.sql
-- Depends on functions: audit_log_trigger, decrement_inventory_on_invoice_item,
--                       create_default_godown, set_invoice_number
-- =============================================================================

-- ─── Audit Log Triggers (SCHEMA-06) ──────────────────────────────────────────
-- AFTER trigger on all 17 business tables.
-- audit_log itself is excluded (bigserial PK, not uuid; auditing audit_log causes recursion).
-- SECURITY DEFINER function bypasses RLS to INSERT into audit_log.

CREATE OR REPLACE TRIGGER audit_companies
  AFTER INSERT OR UPDATE OR DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_company_users
  AFTER INSERT OR UPDATE OR DELETE ON public.company_users
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_customer_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_godowns
  AFTER INSERT OR UPDATE OR DELETE ON public.godowns
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_inventory
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_customers
  AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_suppliers
  AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_invoice_items
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_purchase_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_purchase_order_items
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_whatsapp_sessions
  AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_pricing_alerts
  AFTER INSERT OR UPDATE OR DELETE ON public.pricing_alerts
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_gst_period_data
  AFTER INSERT OR UPDATE OR DELETE ON public.gst_period_data
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- WR-02: audit_invoice_sequences trigger removed.
-- Auditing invoice_sequences (an internal counter table) produces noise with no
-- forensic value — every invoice creation generates a spurious audit row for the
-- sequence increment. The invoice number itself is already audited via audit_invoices.
-- Keeping this trigger would create a 4-level trigger chain:
--   BEFORE INSERT invoices → generate_invoice_number → UPDATE invoice_sequences
--   → AFTER UPDATE invoice_sequences → INSERT audit_log
-- The invoice number on invoices is the business record; the counter is an
-- implementation detail and does not need an audit trail.

-- ─── Inventory Decrement Trigger (SCHEMA-05) ─────────────────────────────────
-- BEFORE INSERT on invoice_items.
-- BEFORE (not AFTER): can raise EXCEPTION to abort the INSERT if stock is insufficient.
-- Calls decrement_inventory_on_invoice_item() which uses FOR UPDATE NOWAIT.

CREATE OR REPLACE TRIGGER decrement_inventory_before_invoice_item
  BEFORE INSERT ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_inventory_on_invoice_item();

-- ─── Default Godown Trigger (D-07) ───────────────────────────────────────────
-- AFTER INSERT on companies.
-- Creates one 'Main Warehouse' godown (is_default=true) for every new company.
-- AFTER (not BEFORE): needs NEW.id to be set, which is available after row insert.

CREATE OR REPLACE TRIGGER create_default_godown_on_company
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.create_default_godown();

-- ─── Invoice Numbering Trigger (D-11, SCHEMA-07) ─────────────────────────────
-- BEFORE INSERT on invoices.
-- Calls set_invoice_number() which calls generate_invoice_number().
-- BEFORE: modifies NEW.invoice_number before the row is written.

CREATE OR REPLACE TRIGGER set_invoice_number_before_insert
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();
