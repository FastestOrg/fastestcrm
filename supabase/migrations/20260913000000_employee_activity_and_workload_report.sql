-- ==============================================================================
-- Production Migration: Employee Daily Activity & Contact Recency Reporting
-- Author: FastestCRM Senior Data Engineering
-- ==============================================================================

-- 1. Create Dedicated High-Performance Lead Activity Log Table
CREATE TABLE IF NOT EXISTS public.lead_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    lead_id UUID NOT NULL,
    lead_table TEXT NOT NULL DEFAULT 'leads',
    user_id UUID,
    action TEXT NOT NULL,
    new_status TEXT,
    old_status TEXT,
    lead_name TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Row Level Security
ALTER TABLE public.lead_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read activity of their company" ON public.lead_activity_log;
CREATE POLICY "Users can read activity of their company" ON public.lead_activity_log
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service and triggers can insert activity" ON public.lead_activity_log;
CREATE POLICY "Service and triggers can insert activity" ON public.lead_activity_log
    FOR INSERT WITH CHECK (true);

-- 3. Composite B-Tree Indexes for sub-10ms queries
CREATE INDEX IF NOT EXISTS idx_lead_activity_log_comp_created
    ON public.lead_activity_log (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_activity_log_comp_user_created
    ON public.lead_activity_log (company_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_activity_log_lead_id
    ON public.lead_activity_log (lead_id);

-- 4. Update Lead Trigger to Automatically Log Activity
CREATE OR REPLACE FUNCTION "public"."handle_lead_update_history"() 
RETURNS trigger AS $$
DECLARE
    history_entry jsonb;
    old_status text;
    new_status text;
    history_array jsonb := '[]'::jsonb;
    actor_id uuid;
    tbl_name text;
    v_company_id uuid;
    v_lead_name text;
    effective_user_id uuid;
BEGIN
    actor_id := auth.uid();
    tbl_name := TG_TABLE_NAME;
    v_company_id := NEW.company_id;
    v_lead_name := NEW.name;

    -- Check if it is INSERT
    IF TG_OP = 'INSERT' THEN
        effective_user_id := COALESCE(NEW.created_by_id, actor_id);

        -- 1. Log Lead Creation
        history_entry := jsonb_build_object(
            'action', 'create',
            'user_id', effective_user_id,
            'timestamp', now()
        );
        history_array := history_array || jsonb_build_array(history_entry);

        IF v_company_id IS NOT NULL THEN
            INSERT INTO public.lead_activity_log (
                company_id, lead_id, lead_table, user_id, action, lead_name, details, created_at
            ) VALUES (
                v_company_id, NEW.id, tbl_name, effective_user_id, 'create', v_lead_name, history_entry, now()
            );
        END IF;

        -- 2. Log Initial Assignments
        IF NEW.pre_sales_owner_id IS NOT NULL THEN
            history_entry := jsonb_build_object(
                'action', 'assign_pre_sales',
                'assignee_id', NEW.pre_sales_owner_id,
                'user_id', actor_id,
                'timestamp', now()
            );
            history_array := history_array || jsonb_build_array(history_entry);

            IF v_company_id IS NOT NULL THEN
                INSERT INTO public.lead_activity_log (
                    company_id, lead_id, lead_table, user_id, action, lead_name, details, created_at
                ) VALUES (
                    v_company_id, NEW.id, tbl_name, actor_id, 'assign_pre_sales', v_lead_name, history_entry, now()
                );
            END IF;
        END IF;

        IF NEW.sales_owner_id IS NOT NULL THEN
            history_entry := jsonb_build_object(
                'action', 'assign_sales',
                'assignee_id', NEW.sales_owner_id,
                'user_id', actor_id,
                'timestamp', now()
            );
            history_array := history_array || jsonb_build_array(history_entry);

            IF v_company_id IS NOT NULL THEN
                INSERT INTO public.lead_activity_log (
                    company_id, lead_id, lead_table, user_id, action, lead_name, details, created_at
                ) VALUES (
                    v_company_id, NEW.id, tbl_name, actor_id, 'assign_sales', v_lead_name, history_entry, now()
                );
            END IF;
        END IF;

        IF NEW.post_sales_owner_id IS NOT NULL THEN
            history_entry := jsonb_build_object(
                'action', 'assign_post_sales',
                'assignee_id', NEW.post_sales_owner_id,
                'user_id', actor_id,
                'timestamp', now()
            );
            history_array := history_array || jsonb_build_array(history_entry);

            IF v_company_id IS NOT NULL THEN
                INSERT INTO public.lead_activity_log (
                    company_id, lead_id, lead_table, user_id, action, lead_name, details, created_at
                ) VALUES (
                    v_company_id, NEW.id, tbl_name, actor_id, 'assign_post_sales', v_lead_name, history_entry, now()
                );
            END IF;
        END IF;

        NEW.lead_history := COALESCE(NEW.lead_history, '[]'::jsonb) || history_array;

    -- Check if it is UPDATE
    ELSIF TG_OP = 'UPDATE' THEN
        -- 1. Status Changes
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            old_status := OLD.status;
            new_status := NEW.status;

            history_entry := jsonb_build_object(
                'action', 'status_change',
                'user_id', actor_id,
                'old_status', old_status,
                'new_status', new_status,
                'timestamp', now()
            );
            history_array := history_array || jsonb_build_array(history_entry);

            IF v_company_id IS NOT NULL THEN
                INSERT INTO public.lead_activity_log (
                    company_id, lead_id, lead_table, user_id, action, old_status, new_status, lead_name, details, created_at
                ) VALUES (
                    v_company_id, NEW.id, tbl_name, actor_id, 'status_change', old_status, new_status, v_lead_name, history_entry, now()
                );
            END IF;
        END IF;

        -- 2. Notes Changes (Critical for contact activity)
        IF NEW.notes IS DISTINCT FROM OLD.notes AND NEW.notes IS NOT NULL THEN
            history_entry := jsonb_build_object(
                'action', 'note_update',
                'user_id', actor_id,
                'timestamp', now()
            );
            history_array := history_array || jsonb_build_array(history_entry);

            IF v_company_id IS NOT NULL THEN
                INSERT INTO public.lead_activity_log (
                    company_id, lead_id, lead_table, user_id, action, lead_name, details, created_at
                ) VALUES (
                    v_company_id, NEW.id, tbl_name, actor_id, 'note_update', v_lead_name, history_entry, now()
                );
            END IF;
        END IF;

        -- 3. Owner Changes
        IF NEW.pre_sales_owner_id IS DISTINCT FROM OLD.pre_sales_owner_id THEN
            IF NEW.pre_sales_owner_id IS NOT NULL THEN
                history_entry := jsonb_build_object(
                    'action', 'assign_pre_sales',
                    'assignee_id', NEW.pre_sales_owner_id,
                    'user_id', actor_id,
                    'timestamp', now()
                );
            ELSE
                history_entry := jsonb_build_object(
                    'action', 'unassign_pre_sales',
                    'user_id', actor_id,
                    'timestamp', now()
                );
            END IF;
            history_array := history_array || jsonb_build_array(history_entry);

            IF v_company_id IS NOT NULL THEN
                INSERT INTO public.lead_activity_log (
                    company_id, lead_id, lead_table, user_id, action, lead_name, details, created_at
                ) VALUES (
                    v_company_id, NEW.id, tbl_name, actor_id, history_entry->>'action', v_lead_name, history_entry, now()
                );
            END IF;
        END IF;

        IF NEW.sales_owner_id IS DISTINCT FROM OLD.sales_owner_id THEN
            IF NEW.sales_owner_id IS NOT NULL THEN
                history_entry := jsonb_build_object(
                    'action', 'assign_sales',
                    'assignee_id', NEW.sales_owner_id,
                    'user_id', actor_id,
                    'timestamp', now()
                );
            ELSE
                history_entry := jsonb_build_object(
                    'action', 'unassign_sales',
                    'user_id', actor_id,
                    'timestamp', now()
                );
            END IF;
            history_array := history_array || jsonb_build_array(history_entry);

            IF v_company_id IS NOT NULL THEN
                INSERT INTO public.lead_activity_log (
                    company_id, lead_id, lead_table, user_id, action, lead_name, details, created_at
                ) VALUES (
                    v_company_id, NEW.id, tbl_name, actor_id, history_entry->>'action', v_lead_name, history_entry, now()
                );
            END IF;
        END IF;

        IF NEW.post_sales_owner_id IS DISTINCT FROM OLD.post_sales_owner_id THEN
            IF NEW.post_sales_owner_id IS NOT NULL THEN
                history_entry := jsonb_build_object(
                    'action', 'assign_post_sales',
                    'assignee_id', NEW.post_sales_owner_id,
                    'user_id', actor_id,
                    'timestamp', now()
                );
            ELSE
                history_entry := jsonb_build_object(
                    'action', 'unassign_post_sales',
                    'user_id', actor_id,
                    'timestamp', now()
                );
            END IF;
            history_array := history_array || jsonb_build_array(history_entry);

            IF v_company_id IS NOT NULL THEN
                INSERT INTO public.lead_activity_log (
                    company_id, lead_id, lead_table, user_id, action, lead_name, details, created_at
                ) VALUES (
                    v_company_id, NEW.id, tbl_name, actor_id, history_entry->>'action', v_lead_name, history_entry, now()
                );
            END IF;
        END IF;

        -- 4. General Edit (if no other history recorded but fields changed)
        IF jsonb_array_length(history_array) = 0 AND actor_id IS NOT NULL THEN
            history_entry := jsonb_build_object(
                'action', 'lead_edit',
                'user_id', actor_id,
                'timestamp', now()
            );
            history_array := history_array || jsonb_build_array(history_entry);

            IF v_company_id IS NOT NULL THEN
                INSERT INTO public.lead_activity_log (
                    company_id, lead_id, lead_table, user_id, action, lead_name, details, created_at
                ) VALUES (
                    v_company_id, NEW.id, tbl_name, actor_id, 'lead_edit', v_lead_name, history_entry, now()
                );
            END IF;
        END IF;

        -- Append the new history items to the existing history array
        IF jsonb_array_length(history_array) > 0 THEN
            NEW.lead_history := COALESCE(OLD.lead_history, '[]'::jsonb) || history_array;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC Function: Aggregated Employee Activity & Workload Report
CREATE OR REPLACE FUNCTION public.get_employee_daily_activity_report(
    p_company_id uuid,
    p_start_date timestamptz DEFAULT date_trunc('day', now()),
    p_end_date timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_summary jsonb;
    v_employees jsonb;
    v_daily_trend jsonb;
    v_top_performer jsonb;
    v_total_unique_leads int;
    v_total_actions int;
    v_active_employees_count int;
    v_total_employees_count int;
    v_active_now_count int := 0;
BEGIN
    -- 1. Total employees in company
    SELECT count(*) INTO v_total_employees_count
    FROM public.profiles
    WHERE company_id = p_company_id
      AND (is_deactivated IS NULL OR is_deactivated = false);

    -- 2. Aggregate metrics per employee for the period
    WITH period_metrics AS (
        SELECT 
            user_id,
            COUNT(DISTINCT lead_id) as unique_leads_worked,
            COUNT(*) as total_actions,
            jsonb_object_agg(action, action_count) as action_counts
        FROM (
            SELECT 
                user_id,
                lead_id,
                action,
                COUNT(*) OVER (PARTITION BY user_id, action) as action_count
            FROM public.lead_activity_log
            WHERE company_id = p_company_id
              AND created_at >= p_start_date
              AND created_at <= p_end_date
              AND user_id IS NOT NULL
        ) sub
        GROUP BY user_id
    ),
    -- 3. Last activity per employee (all-time or latest available)
    latest_activities AS (
        SELECT DISTINCT ON (user_id)
            user_id,
            lead_id,
            lead_name,
            action,
            old_status,
            new_status,
            details,
            created_at as last_active_at,
            EXTRACT(EPOCH FROM (now() - created_at))::int as seconds_ago
        FROM public.lead_activity_log
        WHERE company_id = p_company_id
          AND user_id IS NOT NULL
        ORDER BY user_id, created_at DESC
    ),
    employee_agg AS (
        SELECT 
            p.id as user_id,
            COALESCE(p.full_name, split_part(p.email, '@', 1), 'Team Member') as name,
            p.email,
            p.avatar_url,
            COALESCE(pm.unique_leads_worked, 0) as unique_leads_worked,
            COALESCE(pm.total_actions, 0) as total_actions,
            COALESCE(pm.action_counts, '{}'::jsonb) as action_counts,
            CASE 
                WHEN la.last_active_at IS NOT NULL THEN
                    jsonb_build_object(
                        'timestamp', la.last_active_at,
                        'action', la.action,
                        'lead_id', la.lead_id,
                        'lead_name', la.lead_name,
                        'old_status', la.old_status,
                        'new_status', la.new_status,
                        'details', la.details,
                        'seconds_ago', la.seconds_ago,
                        'status_badge', CASE 
                            WHEN la.seconds_ago <= 900 THEN 'active_now'       -- < 15 min
                            WHEN la.seconds_ago <= 3600 THEN 'idle'            -- < 1 hour
                            WHEN la.seconds_ago <= 86400 THEN 'earlier_today'  -- < 24 hours
                            ELSE 'inactive'
                        END
                    )
                ELSE NULL
            END as last_activity
        FROM public.profiles p
        LEFT JOIN period_metrics pm ON pm.user_id = p.id
        LEFT JOIN latest_activities la ON la.user_id = p.id
        WHERE p.company_id = p_company_id
          AND (p.is_deactivated IS NULL OR p.is_deactivated = false)
        ORDER BY unique_leads_worked DESC, total_actions DESC, name ASC
    )
    SELECT 
        jsonb_agg(
            jsonb_build_object(
                'user_id', user_id,
                'name', name,
                'email', email,
                'avatar_url', avatar_url,
                'unique_leads_worked', unique_leads_worked,
                'total_actions', total_actions,
                'action_counts', action_counts,
                'last_activity', last_activity
            )
        ) INTO v_employees
    FROM employee_agg;

    -- Compute overall company totals in period
    SELECT 
        COUNT(DISTINCT lead_id),
        COUNT(*)
    INTO v_total_unique_leads, v_total_actions
    FROM public.lead_activity_log
    WHERE company_id = p_company_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date
      AND user_id IS NOT NULL;

    -- Count active employees and active_now
    SELECT 
        COUNT(*) FILTER (WHERE (elem->>'unique_leads_worked')::int > 0),
        COUNT(*) FILTER (WHERE elem->'last_activity'->>'status_badge' = 'active_now')
    INTO v_active_employees_count, v_active_now_count
    FROM jsonb_array_elements(COALESCE(v_employees, '[]'::jsonb)) elem;

    -- Top performer
    SELECT elem INTO v_top_performer
    FROM jsonb_array_elements(COALESCE(v_employees, '[]'::jsonb)) elem
    WHERE (elem->>'unique_leads_worked')::int > 0
    ORDER BY (elem->>'unique_leads_worked')::int DESC
    LIMIT 1;

    -- Daily Trend (for charts)
    WITH daily_counts AS (
        SELECT 
            date_trunc('day', l.created_at) as day_date,
            l.user_id,
            p.full_name as name,
            COUNT(DISTINCT l.lead_id) as unique_leads_count,
            COUNT(*) as total_actions
        FROM public.lead_activity_log l
        JOIN public.profiles p ON p.id = l.user_id
        WHERE l.company_id = p_company_id
          AND l.created_at >= p_start_date
          AND l.created_at <= p_end_date
        GROUP BY 1, 2, 3
        ORDER BY 1 ASC, unique_leads_count DESC
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'date', day_date,
                'user_id', user_id,
                'name', name,
                'unique_leads', unique_leads_count,
                'total_actions', total_actions
            )
        ), 
        '[]'::jsonb
    ) INTO v_daily_trend
    FROM daily_counts;

    -- Assemble final summary
    v_summary := jsonb_build_object(
        'total_unique_leads_worked', COALESCE(v_total_unique_leads, 0),
        'total_actions', COALESCE(v_total_actions, 0),
        'active_employees_count', COALESCE(v_active_employees_count, 0),
        'total_employees_count', COALESCE(v_total_employees_count, 0),
        'active_now_count', COALESCE(v_active_now_count, 0),
        'top_performer', v_top_performer
    );

    RETURN jsonb_build_object(
        'summary', v_summary,
        'employees', COALESCE(v_employees, '[]'::jsonb),
        'daily_trend', COALESCE(v_daily_trend, '[]'::jsonb),
        'start_date', p_start_date,
        'end_date', p_end_date
    );
END;
$$;

-- 6. RPC Function: Detailed Activity Timeline for a Specific Employee
CREATE OR REPLACE FUNCTION public.get_employee_activity_timeline(
    p_company_id uuid,
    p_user_id uuid,
    p_start_date timestamptz DEFAULT date_trunc('day', now()),
    p_end_date timestamptz DEFAULT now(),
    p_limit int DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_timeline jsonb;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'lead_id', lead_id,
                'lead_name', COALESCE(lead_name, 'Unknown Lead'),
                'action', action,
                'old_status', old_status,
                'new_status', new_status,
                'details', details,
                'created_at', created_at,
                'seconds_ago', EXTRACT(EPOCH FROM (now() - created_at))::int
            )
            ORDER BY created_at DESC
        ),
        '[]'::jsonb
    ) INTO v_timeline
    FROM (
        SELECT id, lead_id, lead_name, action, old_status, new_status, details, created_at
        FROM public.lead_activity_log
        WHERE company_id = p_company_id
          AND user_id = p_user_id
          AND created_at >= p_start_date
          AND created_at <= p_end_date
        ORDER BY created_at DESC
        LIMIT p_limit
    ) sub;

    RETURN v_timeline;
END;
$$;
