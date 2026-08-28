-- Migration: Add Country Filter Index on leads_efficacy
-- Timestamp: 2026-08-27 17:17:00
-- Description:
-- Creates composite index on (company_id, country, created_at DESC, id DESC)
-- to allow instant filtering and pagination by country on /dashboard/leads (leads_efficacy)
-- without sequential table scans or timeouts.

CREATE INDEX IF NOT EXISTS idx_leads_efficacy_company_country_created_id 
ON public.leads_efficacy (company_id, country, created_at DESC, id DESC) 
WHERE country IS NOT NULL;
