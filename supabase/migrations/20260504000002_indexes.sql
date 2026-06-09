-- =============================================================================
-- InvoiceIQ — Migration 002: Indexes
-- Applied after: 20260504000001_schema.sql
-- Note: PostgreSQL does NOT auto-create indexes on FK columns. Every FK column
--       that participates in a JOIN or WHERE clause needs an explicit index.
-- =============================================================================

-- company_users
CREATE INDEX idx_company_users_company_id ON public.company_users(company_id);
CREATE INDEX idx_company_users_user_id    ON public.company_users(user_id);

-- products
CREATE INDEX idx_products_company_id ON public.products(company_id);

-- inventory
CREATE INDEX idx_inventory_company_id ON public.inventory(company_id);
CREATE INDEX idx_inventory_product_id ON public.inventory(product_id);
CREATE INDEX idx_inventory_godown_id  ON public.inventory(godown_id);

-- godowns
CREATE INDEX idx_godowns_company_id ON public.godowns(company_id);
-- WR-03: Partial unique index enforcing at most one default godown per company.
-- Required by the CR-04 inventory decrement fix which selects WHERE is_default = true.
-- Without this, application code could set multiple godowns as default, causing
-- the inventory decrement to pick an arbitrary row (LIMIT 1 is then non-deterministic).
CREATE UNIQUE INDEX idx_godowns_one_default_per_company
  ON public.godowns (company_id)
  WHERE is_default = true;

-- customers
CREATE INDEX idx_customers_company_id ON public.customers(company_id);

-- suppliers
CREATE INDEX idx_suppliers_company_id ON public.suppliers(company_id);

-- invoices
CREATE INDEX idx_invoices_company_id      ON public.invoices(company_id);
CREATE INDEX idx_invoices_customer_id     ON public.invoices(customer_id);
CREATE INDEX idx_invoices_public_id       ON public.invoices(public_id);
CREATE INDEX idx_invoices_payment_status  ON public.invoices(payment_status);
CREATE INDEX idx_invoices_customer_email  ON public.invoices(customer_email);
CREATE INDEX idx_invoices_customer_phone  ON public.invoices(customer_phone);

-- invoice_items
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_company_id ON public.invoice_items(company_id);

-- payments
CREATE INDEX idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX idx_payments_company_id ON public.payments(company_id);

-- audit_log
CREATE INDEX idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_changed_at   ON public.audit_log(changed_at);

-- whatsapp_sessions
CREATE INDEX idx_whatsapp_sessions_company ON public.whatsapp_sessions(company_id);

-- gst_period_data
CREATE INDEX idx_gst_period_data_company ON public.gst_period_data(company_id);

-- invoice_sequences
CREATE INDEX idx_invoice_sequences_company ON public.invoice_sequences(company_id);
