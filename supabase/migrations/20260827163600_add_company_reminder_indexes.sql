-- Migration: Add Company Reminder Composite Indexes
-- Timestamp: 2026-08-27 16:36:00
-- Description:
-- Adds composite indexes on (company_id, reminder_at ASC) WHERE reminder_at IS NOT NULL
-- across all industry lead tables to ensure the Tasks page and calendar load instantly (<1s)
-- instead of doing a 16s sequential scan on large tables.

CREATE INDEX IF NOT EXISTS idx_leads_efficacy_company_reminders 
ON public.leads_efficacy (company_id, reminder_at ASC) 
WHERE reminder_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_company_reminders 
ON public.leads (company_id, reminder_at ASC) 
WHERE reminder_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_saas_company_reminders 
ON public.leads_saas (company_id, reminder_at ASC) 
WHERE reminder_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_real_estate_company_reminders 
ON public.leads_real_estate (company_id, reminder_at ASC) 
WHERE reminder_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_healthcare_company_reminders 
ON public.leads_healthcare (company_id, reminder_at ASC) 
WHERE reminder_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_insurance_company_reminders 
ON public.leads_insurance (company_id, reminder_at ASC) 
WHERE reminder_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_travel_company_reminders 
ON public.leads_travel (company_id, reminder_at ASC) 
WHERE reminder_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_weskill_company_reminders 
ON public.leads_weskill (company_id, reminder_at ASC) 
WHERE reminder_at IS NOT NULL;
