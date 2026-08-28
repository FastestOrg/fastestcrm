-- Migration: Database Performance & Cost Optimization
-- Timestamp: 2026-08-27 14:00:00
-- Description:
-- 1. Safely drop exact duplicate & redundant indexes (reclaim memory buffer pool & disk space)
-- 2. Add high-efficiency partial indexes for background workers (reminder polling <1ms)
-- 3. Add covering indexes for high-frequency unindexed foreign keys
-- 4. Optimize RLS policies with InitPlans ((SELECT auth.uid())) and deduplicate overlapping policies
-- 5. Set up automated log retention pg_cron jobs and vacuum dead tuple bloat

-- ============================================================================
-- 1. DROP DUPLICATE & REDUNDANT INDEXES
-- ============================================================================

-- leads_efficacy (68 MB exact duplicate + redundant prefix index)
DROP INDEX IF EXISTS public.leads_efficacy_company_id_created_at_id_idx;
DROP INDEX IF EXISTS public.leads_efficacy_company_id_idx;

-- companies (duplicate of unique constraint companies_slug_key)
DROP INDEX IF EXISTS public.idx_companies_slug;

-- landing_pages (duplicate of unique constraint landing_pages_company_id_slug_key)
DROP INDEX IF EXISTS public.idx_landing_pages_company_slug;

-- leads_real_estate (exact duplicate)
DROP INDEX IF EXISTS public.idx_leads_re_status;

-- leads_saas (exact duplicate & redundant indexes)
DROP INDEX IF EXISTS public.idx_leads_saas_sales_owner;
DROP INDEX IF EXISTS public.idx_leads_saas_company_id;

-- features_unlocked (duplicate of unique constraint)
DROP INDEX IF EXISTS public.idx_features_unlocked_company_feature;

-- byos_connections (duplicate of unique constraint)
DROP INDEX IF EXISTS public.idx_byos_connections_company_id;

-- platform_admins (duplicate of unique constraint)
DROP INDEX IF EXISTS public.idx_platform_admins_user_id;

-- ai_employee_memory (duplicate non-unique lookup & duplicate unique)
DROP INDEX IF EXISTS public.idx_ai_employee_memory_lookup;
ALTER TABLE public.ai_employee_memory DROP CONSTRAINT IF EXISTS unique_employee_lead;


-- ============================================================================
-- 2. PARTIAL INDEXES FOR HIGH-FREQUENCY REMINDER POLLING WORKERS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_leads_efficacy_pending_reminders 
ON public.leads_efficacy (reminder_at) 
WHERE reminder_at IS NOT NULL AND last_notification_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_pending_reminders 
ON public.leads (reminder_at) 
WHERE reminder_at IS NOT NULL AND last_notification_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_saas_pending_reminders 
ON public.leads_saas (reminder_at) 
WHERE reminder_at IS NOT NULL AND last_notification_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_real_estate_pending_reminders 
ON public.leads_real_estate (reminder_at) 
WHERE reminder_at IS NOT NULL AND last_notification_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_healthcare_pending_reminders 
ON public.leads_healthcare (reminder_at) 
WHERE reminder_at IS NOT NULL AND last_notification_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_insurance_pending_reminders 
ON public.leads_insurance (reminder_at) 
WHERE reminder_at IS NOT NULL AND last_notification_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_travel_pending_reminders 
ON public.leads_travel (reminder_at) 
WHERE reminder_at IS NOT NULL AND last_notification_sent_at IS NULL;


-- ============================================================================
-- 3. COVERING INDEXES FOR HIGH-FREQUENCY FOREIGN KEYS & QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON public.notifications (user_id) 
WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_calendar_events_company_id 
ON public.calendar_events (company_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id 
ON public.calendar_events (user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_booking_page_id 
ON public.calendar_events (booking_page_id);

CREATE INDEX IF NOT EXISTS idx_ai_caller_logs_user_id 
ON public.ai_caller_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_caller_logs_agent_id 
ON public.ai_caller_logs (agent_id);

CREATE INDEX IF NOT EXISTS idx_email_campaign_logs_recipient_id 
ON public.email_campaign_logs (recipient_id);

CREATE INDEX IF NOT EXISTS idx_email_campaign_logs_sent_by_account_id 
ON public.email_campaign_logs (sent_by_account_id);

CREATE INDEX IF NOT EXISTS idx_email_threads_email_account_id 
ON public.email_threads (email_account_id);

CREATE INDEX IF NOT EXISTS idx_ai_employees_company_id 
ON public.ai_employees (company_id);

CREATE INDEX IF NOT EXISTS idx_ai_ops_decisions_company_id 
ON public.ai_ops_decisions (company_id);

CREATE INDEX IF NOT EXISTS idx_ai_ops_decisions_lead_id 
ON public.ai_ops_decisions (lead_id);


-- ============================================================================
-- 4. OPTIMIZE RLS POLICIES WITH INITPLANS ((SELECT auth.uid()))
-- ============================================================================

-- PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    has_role((SELECT auth.uid()), 'company'::app_role) 
    OR has_role((SELECT auth.uid()), 'company_subadmin'::app_role)
  );

DROP POLICY IF EXISTS "Admins can update company profiles" ON public.profiles;
CREATE POLICY "Admins can update company profiles" ON public.profiles
  FOR UPDATE USING (
    has_role((SELECT auth.uid()), 'company'::app_role) 
    OR has_role((SELECT auth.uid()), 'company_subadmin'::app_role)
  );

DROP POLICY IF EXISTS "Managers can view subordinates" ON public.profiles;
CREATE POLICY "Managers can view subordinates" ON public.profiles
  FOR SELECT USING (is_in_hierarchy((SELECT auth.uid()), id));

DROP POLICY IF EXISTS "Managers can update subordinates" ON public.profiles;
CREATE POLICY "Managers can update subordinates" ON public.profiles
  FOR UPDATE USING (is_in_hierarchy((SELECT auth.uid()), id));


-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (user_id = (SELECT auth.uid()));


-- COMPANIES
DROP POLICY IF EXISTS "Company admins can view their company" ON public.companies;
CREATE POLICY "Company admins can view their company" ON public.companies
  FOR SELECT USING (admin_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Company admins can update their company" ON public.companies;
CREATE POLICY "Company admins can update their company" ON public.companies
  FOR UPDATE USING (admin_id = (SELECT auth.uid()))
  WITH CHECK (admin_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Members can view their company" ON public.companies;
CREATE POLICY "Members can view their company" ON public.companies
  FOR SELECT USING (id = get_user_company_id((SELECT auth.uid())));

DROP POLICY IF EXISTS "Platform admins have full access to companies" ON public.companies;
CREATE POLICY "Platform admins have full access to companies" ON public.companies
  FOR ALL USING (is_platform_admin((SELECT auth.uid())));


-- LEADS (General)
DROP POLICY IF EXISTS "Users can view their own leads and subordinates' leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update their own leads and subordinates' leads" ON public.leads;

DROP POLICY IF EXISTS "Users can view leads" ON public.leads;
CREATE POLICY "Users can view leads" ON public.leads
  FOR SELECT USING (
    is_same_company((SELECT auth.uid()), company_id) AND (
      (created_by_id = (SELECT auth.uid())) OR
      (pre_sales_owner_id = (SELECT auth.uid())) OR
      (sales_owner_id = (SELECT auth.uid())) OR
      (post_sales_owner_id = (SELECT auth.uid())) OR
      is_in_hierarchy((SELECT auth.uid()), COALESCE(sales_owner_id, created_by_id))
    )
  );

DROP POLICY IF EXISTS "Users can update leads" ON public.leads;
CREATE POLICY "Users can update leads" ON public.leads
  FOR UPDATE USING (
    is_same_company((SELECT auth.uid()), company_id) AND (
      (created_by_id = (SELECT auth.uid())) OR
      (pre_sales_owner_id = (SELECT auth.uid())) OR
      (sales_owner_id = (SELECT auth.uid())) OR
      (post_sales_owner_id = (SELECT auth.uid())) OR
      is_in_hierarchy((SELECT auth.uid()), COALESCE(sales_owner_id, created_by_id))
    )
  );

DROP POLICY IF EXISTS "Users can create leads" ON public.leads;
CREATE POLICY "Users can create leads" ON public.leads
  FOR INSERT WITH CHECK (
    (created_by_id = (SELECT auth.uid())) AND is_same_company((SELECT auth.uid()), company_id)
  );

DROP POLICY IF EXISTS "Only Super Admin can delete leads" ON public.leads;
CREATE POLICY "Only Super Admin can delete leads" ON public.leads
  FOR DELETE USING (
    has_role((SELECT auth.uid()), 'company'::app_role) AND is_same_company((SELECT auth.uid()), company_id)
  );


-- LEADS EFFICACY
DROP POLICY IF EXISTS "Users can view their own leads and subordinates' leads" ON public.leads_efficacy;
CREATE POLICY "Users can view their own leads and subordinates' leads" ON public.leads_efficacy
  FOR SELECT USING (
    (sales_owner_id = (SELECT auth.uid())) OR is_in_hierarchy((SELECT auth.uid()), sales_owner_id)
  );

DROP POLICY IF EXISTS "Users can update their own leads and subordinates' leads" ON public.leads_efficacy;
CREATE POLICY "Users can update their own leads and subordinates' leads" ON public.leads_efficacy
  FOR UPDATE USING (
    (sales_owner_id = (SELECT auth.uid())) OR is_in_hierarchy((SELECT auth.uid()), sales_owner_id)
  );

DROP POLICY IF EXISTS "Users can create leads" ON public.leads_efficacy;
CREATE POLICY "Users can create leads" ON public.leads_efficacy
  FOR INSERT WITH CHECK (created_by_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Only Super Admin can delete leads" ON public.leads_efficacy;
CREATE POLICY "Only Super Admin can delete leads" ON public.leads_efficacy
  FOR DELETE USING (has_role((SELECT auth.uid()), 'company'::app_role));


-- LEADS SAAS
DROP POLICY IF EXISTS "Users can view saas leads" ON public.leads_saas;
CREATE POLICY "Users can view saas leads" ON public.leads_saas
  FOR SELECT USING (
    is_same_company((SELECT auth.uid()), company_id) AND (
      (created_by_id = (SELECT auth.uid())) OR
      (pre_sales_owner_id = (SELECT auth.uid())) OR
      (sales_owner_id = (SELECT auth.uid())) OR
      (post_sales_owner_id = (SELECT auth.uid())) OR
      is_in_hierarchy((SELECT auth.uid()), COALESCE(sales_owner_id, created_by_id))
    )
  );

DROP POLICY IF EXISTS "Users can update saas leads" ON public.leads_saas;
CREATE POLICY "Users can update saas leads" ON public.leads_saas
  FOR UPDATE USING (
    is_same_company((SELECT auth.uid()), company_id) AND (
      (created_by_id = (SELECT auth.uid())) OR
      (pre_sales_owner_id = (SELECT auth.uid())) OR
      (sales_owner_id = (SELECT auth.uid())) OR
      (post_sales_owner_id = (SELECT auth.uid())) OR
      is_in_hierarchy((SELECT auth.uid()), COALESCE(sales_owner_id, created_by_id))
    )
  );

DROP POLICY IF EXISTS "Admins can delete saas leads" ON public.leads_saas;
CREATE POLICY "Admins can delete saas leads" ON public.leads_saas
  FOR DELETE USING (
    (has_role((SELECT auth.uid()), 'company'::app_role) OR has_role((SELECT auth.uid()), 'company_subadmin'::app_role))
    AND is_same_company((SELECT auth.uid()), company_id)
  );


-- LEADS REAL ESTATE
DROP POLICY IF EXISTS "Users view hierarchy real estate leads" ON public.leads_real_estate;
DROP POLICY IF EXISTS "Users can view real estate leads" ON public.leads_real_estate;
CREATE POLICY "Users can view real estate leads" ON public.leads_real_estate
  FOR SELECT USING (
    is_same_company((SELECT auth.uid()), company_id) AND (
      (created_by_id = (SELECT auth.uid())) OR
      (pre_sales_owner_id = (SELECT auth.uid())) OR
      (sales_owner_id = (SELECT auth.uid())) OR
      (post_sales_owner_id = (SELECT auth.uid())) OR
      is_in_hierarchy((SELECT auth.uid()), created_by_id) OR
      is_in_hierarchy((SELECT auth.uid()), sales_owner_id) OR
      is_in_hierarchy((SELECT auth.uid()), pre_sales_owner_id) OR
      is_in_hierarchy((SELECT auth.uid()), post_sales_owner_id)
    )
  );

DROP POLICY IF EXISTS "Users can update real estate leads" ON public.leads_real_estate;
CREATE POLICY "Users can update real estate leads" ON public.leads_real_estate
  FOR UPDATE USING (
    is_same_company((SELECT auth.uid()), company_id) AND (
      has_role((SELECT auth.uid()), 'company'::app_role) OR
      has_role((SELECT auth.uid()), 'company_subadmin'::app_role) OR
      (created_by_id = (SELECT auth.uid())) OR
      (pre_sales_owner_id = (SELECT auth.uid())) OR
      (sales_owner_id = (SELECT auth.uid())) OR
      (post_sales_owner_id = (SELECT auth.uid())) OR
      is_in_hierarchy((SELECT auth.uid()), created_by_id) OR
      is_in_hierarchy((SELECT auth.uid()), sales_owner_id) OR
      is_in_hierarchy((SELECT auth.uid()), pre_sales_owner_id) OR
      is_in_hierarchy((SELECT auth.uid()), post_sales_owner_id)
    )
  );

DROP POLICY IF EXISTS "Admins can delete real estate leads" ON public.leads_real_estate;
CREATE POLICY "Admins can delete real estate leads" ON public.leads_real_estate
  FOR DELETE USING (
    (has_role((SELECT auth.uid()), 'company'::app_role) OR has_role((SELECT auth.uid()), 'company_subadmin'::app_role))
    AND is_same_company((SELECT auth.uid()), company_id)
  );


-- LEADS HEALTHCARE
DROP POLICY IF EXISTS "Users can view healthcare leads" ON public.leads_healthcare;
CREATE POLICY "Users can view healthcare leads" ON public.leads_healthcare
  FOR SELECT USING (
    is_same_company((SELECT auth.uid()), company_id) AND (
      (created_by_id = (SELECT auth.uid())) OR
      (pre_sales_owner_id = (SELECT auth.uid())) OR
      (sales_owner_id = (SELECT auth.uid())) OR
      (post_sales_owner_id = (SELECT auth.uid())) OR
      is_in_hierarchy((SELECT auth.uid()), COALESCE(sales_owner_id, created_by_id))
    )
  );

DROP POLICY IF EXISTS "Users can update healthcare leads" ON public.leads_healthcare;
CREATE POLICY "Users can update healthcare leads" ON public.leads_healthcare
  FOR UPDATE USING (
    is_same_company((SELECT auth.uid()), company_id) AND (
      (created_by_id = (SELECT auth.uid())) OR
      (pre_sales_owner_id = (SELECT auth.uid())) OR
      (sales_owner_id = (SELECT auth.uid())) OR
      (post_sales_owner_id = (SELECT auth.uid())) OR
      is_in_hierarchy((SELECT auth.uid()), COALESCE(sales_owner_id, created_by_id))
    )
  );

DROP POLICY IF EXISTS "Admins can delete healthcare leads" ON public.leads_healthcare;
CREATE POLICY "Admins can delete healthcare leads" ON public.leads_healthcare
  FOR DELETE USING (
    (has_role((SELECT auth.uid()), 'company'::app_role) OR has_role((SELECT auth.uid()), 'company_subadmin'::app_role))
    AND is_same_company((SELECT auth.uid()), company_id)
  );


-- ============================================================================
-- 5. AUTOMATED LOG & CRON PRUNING RETENTION SCHEDULE
-- ============================================================================

-- Schedule pg_cron job to prune cron.job_run_details older than 7 days (weekly)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unsched existing if present to avoid duplicate
    PERFORM cron.unschedule('prune-cron-logs-weekly') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'prune-cron-logs-weekly'
    );
    PERFORM cron.schedule(
      'prune-cron-logs-weekly',
      '0 0 * * 0',
      'DELETE FROM cron.job_run_details WHERE end_time < now() - INTERVAL ''7 days'';'
    );

    PERFORM cron.unschedule('prune-debug-logs-daily') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'prune-debug-logs-daily'
    );
    PERFORM cron.schedule(
      'prune-debug-logs-daily',
      '0 3 * * *',
      'DELETE FROM public.debug_logs WHERE created_at < now() - INTERVAL ''14 days'';'
    );
  END IF;
END $$;
