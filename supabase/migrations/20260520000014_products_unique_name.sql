-- Prevent duplicate product names within a company
ALTER TABLE public.products
  ADD CONSTRAINT products_company_name_unique UNIQUE (company_id, name);
