-- Migration: Database Index De-duplication, WAL Replication Pruning & Activity Log Retention
-- Timestamp: 2026-09-28 10:30:00
-- Targets: Disk IOPS, Memory Buffer Hit Rate (93% -> 99%), Storage Billing
-- Description:
-- 1. Drops exact duplicate and redundant indexes across leads_efficacy, leads_weskill, leads,
--    leads_real_estate, leads_saas, leads_insurance, leads_travel, and leads_healthcare (reclaims ~750MB+ memory/disk buffers)
-- 2. Removes unused WAL replication from `leads` table in supabase_realtime publication to stop replication thrashing,
--    and ensures `notifications` is properly published for real-time frontend delivery
-- 3. Sets up safe batch pruning and automated scheduled maintenance for lead_activity_log via pg_cron

-- ============================================================================
-- 1. DROP EXACT DUPLICATE & REDUNDANT INDEXES ACROSS ALL LEAD TABLES
-- ============================================================================

-- leads_efficacy (reclaims ~710 MB disk & buffer cache)
DROP INDEX IF EXISTS public.idx_leads_efficacy_co_owner_created;
DROP INDEX IF EXISTS public.idx_leads_efficacy_co_status_created;
DROP INDEX IF EXISTS public.idx_leads_efficacy_company_source_created_id;
DROP INDEX IF EXISTS public.idx_leads_efficacy_co_updated_at;
DROP INDEX IF EXISTS public.idx_leads_efficacy_comp_updated;
DROP INDEX IF EXISTS public.idx_leads_efficacy_co_rev_received;
DROP INDEX IF EXISTS public.idx_leads_efficacy_comp_revenue;

-- leads_weskill (reclaims ~6.5 MB)
DROP INDEX IF EXISTS public.idx_leads_weskill_comp_owner_created;
DROP INDEX IF EXISTS public.idx_leads_weskill_company_created_id;
DROP INDEX IF EXISTS public.idx_leads_weskill_comp_updated;
DROP INDEX IF EXISTS public.idx_leads_weskill_comp_revenue;
DROP INDEX IF EXISTS public.leads_weskill_company_id_idx;

-- leads (standard table)
DROP INDEX IF EXISTS public.idx_leads_company_created_id;
DROP INDEX IF EXISTS public.leads_company_id_idx;
DROP INDEX IF EXISTS public.idx_leads_comp_updated;
DROP INDEX IF EXISTS public.idx_leads_comp_revenue;

-- leads_real_estate
DROP INDEX IF EXISTS public.idx_leads_re_comp_owner_created;
DROP INDEX IF EXISTS public.idx_leads_real_estate_comp_updated;
DROP INDEX IF EXISTS public.idx_leads_real_estate_comp_revenue;
DROP INDEX IF EXISTS public.idx_leads_re_company_created;

-- leads_saas
DROP INDEX IF EXISTS public.idx_leads_saas_comp_owner_created;
DROP INDEX IF EXISTS public.idx_leads_saas_company_created_id;
DROP INDEX IF EXISTS public.idx_leads_saas_comp_updated;
DROP INDEX IF EXISTS public.idx_leads_saas_comp_revenue;

-- leads_insurance
DROP INDEX IF EXISTS public.idx_leads_insurance_company_created_id;
DROP INDEX IF EXISTS public.idx_leads_insurance_comp_updated;
DROP INDEX IF EXISTS public.idx_leads_insurance_comp_revenue;

-- leads_travel
DROP INDEX IF EXISTS public.idx_leads_travel_company_created_id;
DROP INDEX IF EXISTS public.idx_leads_travel_comp_updated;
DROP INDEX IF EXISTS public.idx_leads_travel_comp_revenue;

-- leads_healthcare
DROP INDEX IF EXISTS public.idx_leads_healthcare_company_created_id;
DROP INDEX IF EXISTS public.idx_leads_healthcare_comp_updated;
DROP INDEX IF EXISTS public.idx_leads_healthcare_comp_revenue;


-- ============================================================================
-- 2. OPTIMIZE SUPABASE REALTIME REPLICATION (PRUNE WAL CHURN)
-- ============================================================================
-- Leads is never subscribed via WebSocket in frontend (clients use TanStack Query cache invalidation).
-- Removing it stops heavy WAL streaming during bulk CSV imports and updates.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.leads;
    END IF;
END $$;

-- Notifications IS subscribed by the frontend bell (useNotifications.ts). Ensure it is in the publication.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;


-- ============================================================================
-- 3. ACTIVITY LOG RETENTION & SCHEDULED CLEANUP
-- ============================================================================

-- Function to prune activity logs safely in batches with a configurable retention window (default 30 days)
CREATE OR REPLACE FUNCTION public.prune_old_lead_activity_logs(
    p_retention_days integer DEFAULT 30,
    p_batch_size integer DEFAULT 25000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cutoff timestamptz;
    v_total_deleted bigint := 0;
    v_batch_deleted integer := 0;
    v_max_iterations integer := 200; -- Safety cap to prevent transaction timeout
    v_iteration integer := 0;
BEGIN
    -- 1. Ensure all activity prior to today is aggregated into daily rollup
    PERFORM public.refresh_company_employee_activity_daily();

    -- 2. Calculate cutoff timestamp
    v_cutoff := date_trunc('day', now()) - (p_retention_days || ' days')::interval;

    -- 3. Batch deletion to prevent long table exclusive locks
    LOOP
        v_iteration := v_iteration + 1;
        IF v_iteration > v_max_iterations THEN
            EXIT;
        END IF;

        DELETE FROM public.lead_activity_log
        WHERE id IN (
            SELECT id 
            FROM public.lead_activity_log
            WHERE created_at < v_cutoff
            LIMIT p_batch_size
        );
        GET DIAGNOSTICS v_batch_deleted = ROW_COUNT;
        
        v_total_deleted := v_total_deleted + v_batch_deleted;
        
        IF v_batch_deleted < p_batch_size THEN
            EXIT;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success',
        'cutoff', v_cutoff,
        'deleted_rows', v_total_deleted,
        'iterations', v_iteration,
        'executed_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.prune_old_lead_activity_logs(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prune_old_lead_activity_logs(integer, integer) TO service_role;

-- Scheduled pg_cron jobs:
-- 1. Nightly employee activity rollup refresh (at 00:25 UTC every day)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remove older duplicate if exists
        PERFORM cron.unschedule(jobid) 
        FROM cron.job 
        WHERE jobname = 'nightly-employee-activity-daily-refresh';

        PERFORM cron.schedule(
            'nightly-employee-activity-daily-refresh',
            '25 0 * * *',
            'SELECT public.refresh_company_employee_activity_daily();'
        );

        -- Weekly activity log retention prune (at 03:30 UTC every Sunday)
        PERFORM cron.unschedule(jobid) 
        FROM cron.job 
        WHERE jobname = 'weekly-prune-lead-activity-logs';

        PERFORM cron.schedule(
            'weekly-prune-lead-activity-logs',
            '30 3 * * 0',
            'SELECT public.prune_old_lead_activity_logs(30, 25000);'
        );
    END IF;
END $$;
