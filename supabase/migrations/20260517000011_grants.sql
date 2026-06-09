-- =============================================================================
-- InvoiceIQ — Migration 011: Table-level GRANTs for authenticated role
-- RLS was enabled on all tables but no GRANT was issued — causing
-- "permission denied for table" errors for all authenticated operations.
-- =============================================================================

-- Business data tables — full CRUD for authenticated users (RLS enforces company scoping)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_users        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.godowns              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_sessions    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_alerts       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gst_period_data      TO authenticated;

-- customer_profiles — cross-tenant read; authenticated users can manage their own profile
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_profiles    TO authenticated;

-- audit_log — append-only; no UPDATE or DELETE for authenticated
GRANT SELECT, INSERT                 ON public.audit_log            TO authenticated;

-- invoice_sequences — managed by generate_invoice_number() SECURITY DEFINER function only
GRANT SELECT                         ON public.invoice_sequences     TO authenticated;

-- anon role — only what the public invoice page needs (no business data)
GRANT SELECT                         ON public.customer_profiles     TO anon;
