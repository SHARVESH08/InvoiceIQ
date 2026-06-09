-- Phase 13: Onboarding walkthrough state (D-08)

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS onboarding_step INT NOT NULL DEFAULT 0;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
