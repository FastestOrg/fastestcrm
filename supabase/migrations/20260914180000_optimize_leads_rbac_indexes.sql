-- ============================================================================
-- Migration: Optimize Leads RBAC Indexes & Free RAM
-- Description: Drops 480MB+ of unused duplicate indexes on leads_efficacy
--              and creates high-performance composite covering indexes for
--              multi-tenant RBAC pagination on leads_efficacy, leads_weskill,
--              leads_real_estate, and leads_saas.
-- ============================================================================

-- 1. Drop unused duplicate/dead indexes on leads_efficacy (Reclaims ~480MB RAM & disk)
DROP INDEX IF EXISTS public.idx_leads_efficacy_company_created_at;
DROP INDEX IF EXISTS public.idx_leads_efficacy_company_status_owner_created_id;
DROP INDEX IF EXISTS public.idx_leads_efficacy_company_country_created_id;
DROP INDEX IF EXISTS public.idx_leads_efficacy_company_owner_created_id;
DROP INDEX IF EXISTS public.idx_leads_efficacy_company_status_created_id;
DROP INDEX IF EXISTS public.idx_leads_efficacy_company_reminder_null;
DROP INDEX IF EXISTS public.idx_leads_efficacy_pending_reminders;

-- 2. Ensure composite index for company + sales_owner + created_at + id on leads_efficacy
CREATE INDEX IF NOT EXISTS idx_leads_efficacy_company_owner_created
ON public.leads_efficacy (company_id, sales_owner_id, created_at DESC, id DESC);

-- 3. Composite covering index for leads_weskill
CREATE INDEX IF NOT EXISTS idx_leads_weskill_comp_owner_created
ON public.leads_weskill (company_id, sales_owner_id, created_at DESC, id DESC);

-- 4. Composite covering index for leads_real_estate
CREATE INDEX IF NOT EXISTS idx_leads_re_comp_owner_created
ON public.leads_real_estate (company_id, sales_owner_id, created_at DESC, id DESC);

-- 5. Composite covering index for leads_saas
CREATE INDEX IF NOT EXISTS idx_leads_saas_comp_owner_created
ON public.leads_saas (company_id, sales_owner_id, created_at DESC, id DESC);
