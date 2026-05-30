-- Add ai_calling_button_active to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS ai_calling_button_active BOOLEAN NOT NULL DEFAULT false;
