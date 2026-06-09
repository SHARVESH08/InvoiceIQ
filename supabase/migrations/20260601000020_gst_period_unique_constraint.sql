-- Phase 10 GST Assistant: UNIQUE constraint on gst_period_data
-- Enables safe UPSERT via ON CONFLICT (company_id, period_type, fy, period)
-- Prevents duplicate period rows that could mask filed-state guard checks (T-10-06)

ALTER TABLE public.gst_period_data
  ADD CONSTRAINT gst_period_data_unique UNIQUE (company_id, period_type, fy, period);
