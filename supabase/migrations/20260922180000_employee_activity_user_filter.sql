-- ==============================================================================
-- Migration: Add p_user_ids to get_employee_daily_activity_report
-- Supports individual and hierarchy scoping for employee activity audit
-- ==============================================================================

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
    -- 1. Total employees in company (or filtered set)
    SELECT count(*) INTO v_total_employees_count
    FROM public.profiles
    WHERE company_id = p_company_id
      AND (is_deactivated IS NULL OR is_deactivated = false)
      AND (p_user_ids IS NULL OR id = ANY(p_user_ids));

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
              AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
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
          AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
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
                            WHEN la.seconds_ago <= 900 THEN 'active_now'
                            WHEN la.seconds_ago <= 3600 THEN 'idle'
                            WHEN la.seconds_ago <= 86400 THEN 'earlier_today'
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
          AND (p_user_ids IS NULL OR p.id = ANY(p_user_ids))
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

    -- Compute overall totals in period
    SELECT 
        COUNT(DISTINCT lead_id),
        COUNT(*)
    INTO v_total_unique_leads, v_total_actions
    FROM public.lead_activity_log
    WHERE company_id = p_company_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date
      AND user_id IS NOT NULL
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids));

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
          AND (p_user_ids IS NULL OR l.user_id = ANY(p_user_ids))
        GROUP BY 1, 2, 3
        ORDER BY 1 ASC, unique_leads_count DESC
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'date', day_date,
                'user_id', user_id,
                'name', COALESCE(name, 'Unknown'),
                'unique_leads', unique_leads_count,
                'total_actions', total_actions
            )
            ORDER BY day_date ASC, unique_leads_count DESC
        ),
        '[]'::jsonb
    ) INTO v_daily_trend
    FROM daily_counts;

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
