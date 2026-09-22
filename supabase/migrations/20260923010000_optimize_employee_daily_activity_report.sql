-- ==============================================================================
-- Migration: High-Performance Daily Rollup & Lambda Architecture for
-- Employee Daily Activity & Recency Audit Reporting
-- ==============================================================================

-- 1. Create Compact Daily Summary Rollup Table
CREATE TABLE IF NOT EXISTS public.company_employee_activity_daily (
    company_id UUID NOT NULL,
    day DATE NOT NULL,
    user_id UUID NOT NULL,
    total_actions INT NOT NULL DEFAULT 0,
    unique_leads_worked INT NOT NULL DEFAULT 0,
    action_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (company_id, day, user_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_activity_daily_comp_day
    ON public.company_employee_activity_daily (company_id, day DESC);

CREATE INDEX IF NOT EXISTS idx_employee_activity_daily_comp_user
    ON public.company_employee_activity_daily (company_id, user_id, day DESC);

ALTER TABLE public.company_employee_activity_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read activity daily of their company" ON public.company_employee_activity_daily;
CREATE POLICY "Users can read activity daily of their company" ON public.company_employee_activity_daily
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- 2. Backfill Historical Rollup Table for Days Before Today
WITH action_agg AS (
    SELECT 
        company_id,
        date_trunc('day', created_at)::date as day,
        user_id,
        action,
        count(*) as action_count,
        count(DISTINCT lead_id) as unique_leads_count
    FROM public.lead_activity_log
    WHERE user_id IS NOT NULL
      AND created_at < date_trunc('day', now())
    GROUP BY company_id, date_trunc('day', created_at)::date, user_id, action
)
INSERT INTO public.company_employee_activity_daily (
    company_id,
    day,
    user_id,
    total_actions,
    unique_leads_worked,
    action_counts
)
SELECT 
    company_id,
    day,
    user_id,
    sum(action_count)::int as total_actions,
    sum(unique_leads_count)::int as unique_leads_worked,
    jsonb_object_agg(action, action_count) as action_counts
FROM action_agg
GROUP BY company_id, day, user_id
ON CONFLICT (company_id, day, user_id) DO UPDATE
SET total_actions = EXCLUDED.total_actions,
    unique_leads_worked = EXCLUDED.unique_leads_worked,
    action_counts = EXCLUDED.action_counts;

-- 3. Maintenance Refresh Function
CREATE OR REPLACE FUNCTION public.refresh_company_employee_activity_daily(
    p_company_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    WITH action_agg AS (
        SELECT 
            company_id,
            date_trunc('day', created_at)::date as day,
            user_id,
            action,
            count(*) as action_count,
            count(DISTINCT lead_id) as unique_leads_count
        FROM public.lead_activity_log
        WHERE user_id IS NOT NULL
          AND created_at < date_trunc('day', now())
          AND (p_company_id IS NULL OR company_id = p_company_id)
        GROUP BY company_id, date_trunc('day', created_at)::date, user_id, action
    )
    INSERT INTO public.company_employee_activity_daily (
        company_id,
        day,
        user_id,
        total_actions,
        unique_leads_worked,
        action_counts
    )
    SELECT 
        company_id,
        day,
        user_id,
        sum(action_count)::int as total_actions,
        sum(unique_leads_count)::int as unique_leads_worked,
        jsonb_object_agg(action, action_count) as action_counts
FROM action_agg
    GROUP BY company_id, day, user_id
    ON CONFLICT (company_id, day, user_id) DO UPDATE
    SET total_actions = EXCLUDED.total_actions,
        unique_leads_worked = EXCLUDED.unique_leads_worked,
        action_counts = EXCLUDED.action_counts;
END;
$$;

-- 4. High-Performance Lambda Architecture RPC Function
CREATE OR REPLACE FUNCTION public.get_employee_daily_activity_report(
    p_company_id uuid,
    p_start_date timestamptz DEFAULT date_trunc('day', now()),
    p_end_date timestamptz DEFAULT now(),
    p_user_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_has_daily_rollup boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.company_employee_activity_daily
        WHERE company_id = p_company_id
        LIMIT 1
    ) INTO v_has_daily_rollup;

    IF v_has_daily_rollup THEN
        -- =========================================================================
        -- PATH A: FAST LAMBDA ARCHITECTURE (Daily Rollup for past + Live for today)
        -- =========================================================================
        WITH profiles_scope AS (
            SELECT id, company_id, full_name, email, avatar_url
            FROM public.profiles
            WHERE company_id = p_company_id
              AND (is_deactivated IS NULL OR is_deactivated = false)
              AND (p_user_ids IS NULL OR id = ANY(p_user_ids))
        ),
        today_raw AS (
            SELECT 
                user_id,
                lead_id,
                action
            FROM public.lead_activity_log
            WHERE company_id = p_company_id
              AND created_at >= GREATEST(p_start_date, date_trunc('day', now()))
              AND created_at <= p_end_date
              AND user_id IS NOT NULL
              AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
        ),
        today_action_counts AS (
            SELECT user_id, action, count(*) as cnt
            FROM today_raw
            GROUP BY user_id, action
        ),
        today_action_json AS (
            SELECT user_id, jsonb_object_agg(action, cnt) as action_counts
            FROM today_action_counts
            GROUP BY user_id
        ),
        today_summary AS (
            SELECT 
                CURRENT_DATE as day,
                tr.user_id,
                count(DISTINCT tr.lead_id)::int as unique_leads_worked,
                count(*)::int as total_actions,
                COALESCE(taj.action_counts, '{}'::jsonb) as action_counts
            FROM today_raw tr
            LEFT JOIN today_action_json taj ON taj.user_id = tr.user_id
            GROUP BY tr.user_id, taj.action_counts
        ),
        combined_activities AS (
            SELECT day, user_id, total_actions, unique_leads_worked, action_counts
            FROM public.company_employee_activity_daily
            WHERE company_id = p_company_id
              AND day >= p_start_date::date
              AND day <= LEAST(p_end_date::date, (CURRENT_DATE - 1))
              AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
            UNION ALL
            SELECT day, user_id, total_actions, unique_leads_worked, action_counts
            FROM today_summary
        ),
        user_actions_combined AS (
            SELECT 
                ca.user_id,
                kv.key as action,
                sum((kv.value)::text::int)::int as action_count
            FROM combined_activities ca,
            LATERAL jsonb_each(ca.action_counts) kv
            GROUP BY ca.user_id, kv.key
        ),
        user_action_counts_json AS (
            SELECT 
                user_id,
                jsonb_object_agg(action, action_count) as action_counts
            FROM user_actions_combined
            GROUP BY user_id
        ),
        user_metrics AS (
            SELECT 
                ca.user_id,
                sum(ca.unique_leads_worked)::int as unique_leads_worked,
                sum(ca.total_actions)::int as total_actions,
                COALESCE(uacj.action_counts, '{}'::jsonb) as action_counts
            FROM combined_activities ca
            LEFT JOIN user_action_counts_json uacj ON uacj.user_id = ca.user_id
            GROUP BY ca.user_id, uacj.action_counts
        ),
        latest_activities AS (
            SELECT 
                p.id as user_id,
                la.last_active_at,
                la.action,
                la.lead_id,
                la.lead_name,
                la.old_status,
                la.new_status,
                la.details,
                la.seconds_ago
            FROM profiles_scope p
            LEFT JOIN LATERAL (
                SELECT 
                    l.created_at as last_active_at,
                    l.action,
                    l.lead_id,
                    l.lead_name,
                    l.old_status,
                    l.new_status,
                    l.details,
                    EXTRACT(EPOCH FROM (now() - l.created_at))::int as seconds_ago
                FROM public.lead_activity_log l
                WHERE l.company_id = p.company_id
                  AND l.user_id = p.id
                ORDER BY l.created_at DESC
                LIMIT 1
            ) la ON true
        ),
        employee_agg AS (
            SELECT 
                p.id as user_id,
                COALESCE(p.full_name, split_part(p.email, '@', 1), 'Team Member') as name,
                p.email,
                p.avatar_url,
                COALESCE(um.unique_leads_worked, 0) as unique_leads_worked,
                COALESCE(um.total_actions, 0) as total_actions,
                COALESCE(um.action_counts, '{}'::jsonb) as action_counts,
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
                                WHEN la.seconds_ago <= 900 THEN 'active_now'
                                WHEN la.seconds_ago <= 3600 THEN 'idle'
                                WHEN la.seconds_ago <= 86400 THEN 'earlier_today'
                                ELSE 'inactive'
                            END
                        )
                    ELSE NULL
                END as last_activity
            FROM profiles_scope p
            LEFT JOIN user_metrics um ON um.user_id = p.id
            LEFT JOIN latest_activities la ON la.user_id = p.id
            ORDER BY unique_leads_worked DESC, total_actions DESC, name ASC
        ),
        daily_trend AS (
            SELECT 
                ca.day::timestamptz as day_date,
                ca.user_id,
                COALESCE(p.full_name, 'Unknown') as name,
                ca.unique_leads_worked as unique_leads,
                ca.total_actions
            FROM combined_activities ca
            LEFT JOIN profiles_scope p ON p.id = ca.user_id
            ORDER BY ca.day ASC, ca.unique_leads_worked DESC
        )
        SELECT jsonb_build_object(
            'summary', jsonb_build_object(
                'total_unique_leads_worked', COALESCE((SELECT sum(unique_leads_worked)::int FROM combined_activities), 0),
                'total_actions', COALESCE((SELECT sum(total_actions)::int FROM combined_activities), 0),
                'active_employees_count', (SELECT count(*) FROM employee_agg WHERE unique_leads_worked > 0),
                'total_employees_count', (SELECT count(*) FROM profiles_scope),
                'active_now_count', (SELECT count(*) FROM employee_agg WHERE last_activity->>'status_badge' = 'active_now'),
                'top_performer', (
                    SELECT jsonb_build_object(
                        'user_id', user_id,
                        'name', name,
                        'email', email,
                        'unique_leads_worked', unique_leads_worked,
                        'total_actions', total_actions
                    )
                    FROM employee_agg
                    WHERE unique_leads_worked > 0
                    LIMIT 1
                )
            ),
            'employees', COALESCE((
                SELECT jsonb_agg(
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
                )
                FROM employee_agg
            ), '[]'::jsonb),
            'daily_trend', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'date', day_date,
                        'user_id', user_id,
                        'name', name,
                        'unique_leads', unique_leads,
                        'total_actions', total_actions
                    )
                    ORDER BY day_date ASC, unique_leads DESC
                )
                FROM daily_trend
            ), '[]'::jsonb),
            'start_date', p_start_date,
            'end_date', p_end_date
        ) INTO v_result;

    ELSE
        -- =========================================================================
        -- PATH B: FALLBACK FOR TABLES WITHOUT DAILY ROLLUPS
        -- =========================================================================
        WITH profiles_scope AS (
            SELECT id, company_id, full_name, email, avatar_url
            FROM public.profiles
            WHERE company_id = p_company_id
              AND (is_deactivated IS NULL OR is_deactivated = false)
              AND (p_user_ids IS NULL OR id = ANY(p_user_ids))
        ),
        period_activities AS MATERIALIZED (
            SELECT 
                l.user_id,
                l.lead_id,
                l.action,
                l.created_at
            FROM public.lead_activity_log l
            WHERE l.company_id = p_company_id
              AND l.created_at >= p_start_date
              AND l.created_at <= p_end_date
              AND l.user_id IS NOT NULL
              AND (p_user_ids IS NULL OR l.user_id = ANY(p_user_ids))
        ),
        user_action_counts AS (
            SELECT 
                user_id,
                action,
                count(*) as cnt
            FROM period_activities
            GROUP BY user_id, action
        ),
        user_action_objs AS (
            SELECT 
                user_id,
                jsonb_object_agg(action, cnt) as action_counts
            FROM user_action_counts
            GROUP BY user_id
        ),
        user_period_metrics AS (
            SELECT 
                pa.user_id,
                count(*) as unique_leads_worked,
                sum(pa.action_count)::int as total_actions,
                COALESCE(uao.action_counts, '{}'::jsonb) as action_counts
            FROM (
                SELECT user_id, lead_id, count(*) as action_count
                FROM period_activities
                GROUP BY user_id, lead_id
            ) pa
            LEFT JOIN user_action_objs uao ON uao.user_id = pa.user_id
            GROUP BY pa.user_id, uao.action_counts
        ),
        latest_activities AS (
            SELECT 
                p.id as user_id,
                la.last_active_at,
                la.action,
                la.lead_id,
                la.lead_name,
                la.old_status,
                la.new_status,
                la.details,
                la.seconds_ago
            FROM profiles_scope p
            LEFT JOIN LATERAL (
                SELECT 
                    l.created_at as last_active_at,
                    l.action,
                    l.lead_id,
                    l.lead_name,
                    l.old_status,
                    l.new_status,
                    l.details,
                    EXTRACT(EPOCH FROM (now() - l.created_at))::int as seconds_ago
                FROM public.lead_activity_log l
                WHERE l.company_id = p.company_id
                  AND l.user_id = p.id
                ORDER BY l.created_at DESC
                LIMIT 1
            ) la ON true
        ),
        employee_agg AS (
            SELECT 
                p.id as user_id,
                COALESCE(p.full_name, split_part(p.email, '@', 1), 'Team Member') as name,
                p.email,
                p.avatar_url,
                COALESCE(upm.unique_leads_worked, 0) as unique_leads_worked,
                COALESCE(upm.total_actions, 0) as total_actions,
                COALESCE(upm.action_counts, '{}'::jsonb) as action_counts,
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
                                WHEN la.seconds_ago <= 900 THEN 'active_now'
                                WHEN la.seconds_ago <= 3600 THEN 'idle'
                                WHEN la.seconds_ago <= 86400 THEN 'earlier_today'
                                ELSE 'inactive'
                            END
                        )
                    ELSE NULL
                END as last_activity
            FROM profiles_scope p
            LEFT JOIN user_period_metrics upm ON upm.user_id = p.id
            LEFT JOIN latest_activities la ON la.user_id = p.id
            ORDER BY unique_leads_worked DESC, total_actions DESC, name ASC
        ),
        daily_counts AS (
            SELECT 
                date_trunc('day', pa.created_at) as day_date,
                pa.user_id,
                COALESCE(p.full_name, 'Unknown') as name,
                count(DISTINCT pa.lead_id) as unique_leads_count,
                count(*) as total_actions
            FROM period_activities pa
            LEFT JOIN profiles_scope p ON p.id = pa.user_id
            GROUP BY 1, 2, 3
            ORDER BY 1 ASC, unique_leads_count DESC
        ),
        overall_totals AS (
            SELECT 
                COUNT(DISTINCT lead_id) as total_unique_leads,
                COUNT(*) as total_actions
            FROM period_activities
        )
        SELECT jsonb_build_object(
            'summary', jsonb_build_object(
                'total_unique_leads_worked', COALESCE((SELECT total_unique_leads FROM overall_totals), 0),
                'total_actions', COALESCE((SELECT total_actions FROM overall_totals), 0),
                'active_employees_count', (SELECT count(*) FROM employee_agg WHERE unique_leads_worked > 0),
                'total_employees_count', (SELECT count(*) FROM profiles_scope),
                'active_now_count', (SELECT count(*) FROM employee_agg WHERE last_activity->>'status_badge' = 'active_now'),
                'top_performer', (
                    SELECT jsonb_build_object(
                        'user_id', user_id,
                        'name', name,
                        'email', email,
                        'unique_leads_worked', unique_leads_worked,
                        'total_actions', total_actions
                    )
                    FROM employee_agg
                    WHERE unique_leads_worked > 0
                    LIMIT 1
                )
            ),
            'employees', COALESCE((
                SELECT jsonb_agg(
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
                )
                FROM employee_agg
            ), '[]'::jsonb),
            'daily_trend', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'date', day_date,
                        'user_id', user_id,
                        'name', name,
                        'unique_leads', unique_leads,
                        'total_actions', total_actions
                    )
                    ORDER BY day_date ASC, unique_leads DESC
                )
                FROM daily_counts
            ), '[]'::jsonb),
            'start_date', p_start_date,
            'end_date', p_end_date
        ) INTO v_result;
    END IF;

    RETURN v_result;
END;
$$;
