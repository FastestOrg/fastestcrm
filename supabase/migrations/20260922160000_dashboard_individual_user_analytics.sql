-- Migration: 20260922160000_dashboard_individual_user_analytics.sql
-- Upgrades get_dashboard_analytics() RPC function to support individual sales representative and team hierarchy scoping.

-- 1. Drop old function signature to prevent overload conflict in PostgREST
DROP FUNCTION IF EXISTS public.get_dashboard_analytics(uuid, int);

-- 2. Create upgraded function with p_user_id and p_user_ids scoping
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(
    p_company_id uuid,
    p_limit_recent int DEFAULT 5,
    p_user_id uuid DEFAULT NULL,
    p_user_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_table_name text;
    v_industry text;
    v_today_start timestamptz := date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
    v_snap_total bigint;
    v_snap_status_dist jsonb;
    v_snap_daily_intake jsonb;
    v_leads_today bigint := 0;
    v_paid_today bigint := 0;
    v_rev_today numeric := 0;
    v_total_rev numeric := 0;
    v_proj_rev numeric := 0;
    v_pipeline_val numeric := 0;
    v_total_leads bigint := 0;
    v_recent_leads jsonb := '[]'::jsonb;
    v_action_leads jsonb := '[]'::jsonb;
    v_intake_trend jsonb := '[]'::jsonb;
    v_status_distribution jsonb := '[]'::jsonb;
    v_has_reminder boolean := false;
    v_has_product boolean := false;
    v_has_phone boolean := false;
    v_has_email boolean := false;
    v_has_sales_owner boolean := false;
    v_has_rev_received boolean := false;
    v_has_rev_projected boolean := false;
    v_has_status boolean := false;
    v_has_created_at boolean := false;
    v_has_updated_at boolean := false;
    v_user_filter text := '';
    v_user_incentive_pct numeric := 5.0;
BEGIN
    -- 1. Identify target table
    SELECT custom_leads_table, LOWER(industry) 
    INTO v_table_name, v_industry 
    FROM public.companies 
    WHERE id = p_company_id;

    IF v_table_name IS NULL OR v_table_name = '' THEN
        IF v_industry = 'real_estate' THEN v_table_name := 'leads_real_estate';
        ELSIF v_industry = 'saas' THEN v_table_name := 'leads_saas';
        ELSIF v_industry = 'healthcare' THEN v_table_name := 'leads_healthcare';
        ELSIF v_industry = 'insurance' THEN v_table_name := 'leads_insurance';
        ELSIF v_industry = 'travel' THEN v_table_name := 'leads_travel';
        ELSE v_table_name := 'leads';
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = v_table_name
    ) THEN
        v_table_name := 'leads';
    END IF;

    -- Check columns
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'reminder_at') INTO v_has_reminder;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'product_purchased') INTO v_has_product;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'email') INTO v_has_email;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'phone') INTO v_has_phone;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'sales_owner_id') INTO v_has_sales_owner;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'revenue_received') INTO v_has_rev_received;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'revenue_projected') INTO v_has_rev_projected;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'status') INTO v_has_status;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'created_at') INTO v_has_created_at;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'updated_at') INTO v_has_updated_at;

    -- Build user scoping filter if applicable
    IF v_has_sales_owner THEN
        IF p_user_id IS NOT NULL THEN
            v_user_filter := format(' AND sales_owner_id = %L', p_user_id);
            -- Retrieve custom incentive percent if defined
            SELECT COALESCE(incentive_percent, 5.0) INTO v_user_incentive_pct
            FROM public.profiles
            WHERE id = p_user_id;
            IF v_user_incentive_pct IS NULL THEN
                v_user_incentive_pct := 5.0;
            END IF;
        ELSIF p_user_ids IS NOT NULL AND array_length(p_user_ids, 1) > 0 THEN
            v_user_filter := format(' AND sales_owner_id = ANY(%L::uuid[])', p_user_ids);
        END IF;
    END IF;

    -- 2. Read snapshot only when viewing full company (no user filter)
    IF v_user_filter = '' THEN
        SELECT total_leads, status_distribution, daily_intake
        INTO v_snap_total, v_snap_status_dist, v_snap_daily_intake
        FROM public.company_analytics_snapshots
        WHERE company_id = p_company_id;
    END IF;

    -- 3. Today's and cumulative metrics
    IF v_has_updated_at THEN
        EXECUTE format('
            SELECT COUNT(*)::bigint FROM public.%I
            WHERE company_id = %L %s AND updated_at >= %L',
            v_table_name, p_company_id, v_user_filter, v_today_start)
        INTO v_leads_today;
    ELSIF v_has_created_at THEN
        EXECUTE format('
            SELECT COUNT(*)::bigint FROM public.%I
            WHERE company_id = %L %s AND created_at >= %L',
            v_table_name, p_company_id, v_user_filter, v_today_start)
        INTO v_leads_today;
    END IF;

    IF v_has_status AND v_has_updated_at THEN
        EXECUTE format('
            SELECT COUNT(*)::bigint FROM public.%I
            WHERE company_id = %L %s AND status = ''paid'' AND updated_at >= %L',
            v_table_name, p_company_id, v_user_filter, v_today_start)
        INTO v_paid_today;
    END IF;

    IF v_has_rev_received AND v_has_updated_at THEN
        EXECUTE format('
            SELECT COALESCE(SUM(revenue_received), 0) FROM public.%I
            WHERE company_id = %L %s AND updated_at >= %L AND revenue_received > 0',
            v_table_name, p_company_id, v_user_filter, v_today_start)
        INTO v_rev_today;

        EXECUTE format('
            SELECT COALESCE(SUM(revenue_received), 0) FROM public.%I
            WHERE company_id = %L %s AND revenue_received > 0',
            v_table_name, p_company_id, v_user_filter)
        INTO v_total_rev;
    END IF;

    IF v_has_rev_projected AND v_has_status THEN
        EXECUTE format('
            SELECT COALESCE(SUM(revenue_projected), 0) FROM public.%I
            WHERE company_id = %L %s AND status = ''paid'' AND revenue_projected > 0',
            v_table_name, p_company_id, v_user_filter)
        INTO v_proj_rev;

        EXECUTE format('
            SELECT COALESCE(SUM(revenue_projected), 0) FROM public.%I
            WHERE company_id = %L %s AND status IN (''interested'', ''follow_up'') AND revenue_projected > 0',
            v_table_name, p_company_id, v_user_filter)
        INTO v_pipeline_val;
    END IF;

    -- Total leads count
    IF v_user_filter != '' THEN
        EXECUTE format('
            SELECT COUNT(*)::bigint FROM public.%I
            WHERE company_id = %L %s',
            v_table_name, p_company_id, v_user_filter)
        INTO v_total_leads;
    ELSIF v_snap_total IS NOT NULL AND v_snap_total > 0 THEN
        v_total_leads := v_snap_total;
    ELSE
        IF v_table_name != 'leads' THEN
            SELECT COALESCE(reltuples::bigint, 0) 
            FROM pg_class 
            WHERE oid = format('public.%I', v_table_name)::regclass 
            INTO v_total_leads;
            IF v_total_leads < 0 THEN v_total_leads := 0; END IF;
        ELSE
            SELECT COUNT(*)::bigint FROM public.leads WHERE company_id = p_company_id INTO v_total_leads;
        END IF;
    END IF;

    -- Status distribution
    IF v_user_filter = '' AND v_snap_status_dist IS NOT NULL AND jsonb_array_length(v_snap_status_dist) > 0 THEN
        v_status_distribution := v_snap_status_dist;
    ELSE
        IF v_has_status THEN
            EXECUTE format('
                WITH raw_statuses AS (
                    SELECT COALESCE(status, ''new'') AS status_key, COUNT(*)::int AS status_count
                    FROM public.%I
                    WHERE company_id = %L %s
                    GROUP BY status
                    ORDER BY status_count DESC
                    LIMIT 5
                )
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        ''name'', CASE status_key
                            WHEN ''paid'' THEN ''Paid''
                            WHEN ''interested'' THEN ''Interested''
                            WHEN ''follow_up'' THEN ''Follow Up''
                            WHEN ''dropped'' THEN ''Dropped''
                            WHEN ''new'' THEN ''New''
                            ELSE INITCAP(REPLACE(status_key, ''_'', '' ''))
                        END,
                        ''count'', status_count,
                        ''fill'', CASE status_key
                            WHEN ''paid'' THEN ''#10b981''
                            WHEN ''interested'' THEN ''#6366f1''
                            WHEN ''follow_up'' THEN ''#f59e0b''
                            WHEN ''dropped'' THEN ''#ef4444''
                            WHEN ''new'' THEN ''#3b82f6''
                            ELSE ''#6b7280''
                        END
                    )
                ), ''[]''::jsonb)
                FROM raw_statuses', v_table_name, p_company_id, v_user_filter)
            INTO v_status_distribution;
        END IF;
    END IF;

    -- 4. 7-Day Intake Trend
    IF v_user_filter != '' AND v_has_created_at THEN
        EXECUTE format('
            WITH days AS (
                SELECT generate_series(
                    (CURRENT_TIMESTAMP AT TIME ZONE ''UTC'' - INTERVAL ''6 days'')::date,
                    (CURRENT_TIMESTAMP AT TIME ZONE ''UTC'')::date,
                    ''1 day''::interval
                )::date AS day
            ),
            daily_counts AS (
                SELECT date_trunc(''day'', created_at AT TIME ZONE ''UTC'')::date AS day,
                       COUNT(*)::bigint AS cnt,
                       %s AS rev
                FROM public.%I
                WHERE company_id = %L %s
                  AND created_at >= (CURRENT_TIMESTAMP AT TIME ZONE ''UTC'' - INTERVAL ''6 days'')::date
                GROUP BY 1
            )
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    ''dateStr'', to_char(d.day, ''YYYY-MM-DD''),
                    ''label'', to_char(d.day, ''Mon DD''),
                    ''count'', COALESCE(c.cnt, 0),
                    ''revenue'', COALESCE(c.rev, 0)
                ) ORDER BY d.day ASC
            ), ''[]''::jsonb)
            FROM days d
            LEFT JOIN daily_counts c ON d.day = c.day',
            CASE WHEN v_has_rev_received THEN 'COALESCE(SUM(revenue_received), 0)' ELSE '0::numeric' END,
            v_table_name,
            p_company_id,
            v_user_filter)
        INTO v_intake_trend;
    ELSE
        WITH days AS (
            SELECT generate_series(
                (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' - INTERVAL '6 days')::date,
                (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
                '1 day'::interval
            )::date AS day
        )
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'dateStr', to_char(d.day, 'YYYY-MM-DD'),
                'label', to_char(d.day, 'Mon DD'),
                'count', CASE 
                    WHEN d.day = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date THEN v_leads_today
                    WHEN v_snap_daily_intake IS NOT NULL AND v_snap_daily_intake ? to_char(d.day, 'YYYY-MM-DD') 
                        THEN COALESCE((v_snap_daily_intake ->> to_char(d.day, 'YYYY-MM-DD'))::bigint, 0)
                    ELSE 0
                END,
                'revenue', 0
            ) ORDER BY d.day ASC
        ), '[]'::jsonb)
        INTO v_intake_trend
        FROM days d;
    END IF;

    -- 5. Recent Leads
    IF v_has_created_at THEN
        EXECUTE format('
            SELECT COALESCE(jsonb_agg(r), ''[]''::jsonb)
            FROM (
                SELECT 
                    id, 
                    name, 
                    %s as email, 
                    %s as phone, 
                    status, 
                    created_at, 
                    updated_at,
                    %s as revenue_received,
                    %s as revenue_projected
                FROM public.%I
                WHERE company_id = %L %s
                ORDER BY created_at DESC
                LIMIT %s
            ) r', 
            CASE WHEN v_has_email THEN 'COALESCE(email, '''')' ELSE '''''' END,
            CASE WHEN v_has_phone THEN 'COALESCE(phone, '''')' ELSE '''''' END,
            CASE WHEN v_has_rev_received THEN 'COALESCE(revenue_received, 0)' ELSE '0::numeric' END,
            CASE WHEN v_has_rev_projected THEN 'COALESCE(revenue_projected, 0)' ELSE '0::numeric' END,
            v_table_name, 
            p_company_id, 
            v_user_filter,
            GREATEST(1, LEAST(p_limit_recent, 20))
        ) INTO v_recent_leads;
    END IF;

    -- 6. Action Leads
    IF v_has_updated_at THEN
        EXECUTE format('
            SELECT COALESCE(jsonb_agg(a), ''[]''::jsonb)
            FROM (
                SELECT 
                    id, 
                    name, 
                    %s as email, 
                    %s as phone, 
                    status, 
                    created_at, 
                    updated_at, 
                    %s as reminder_at,
                    %s as product_purchased,
                    %s as sales_owner_id
                FROM public.%I
                WHERE company_id = %L %s
                  AND (
                      %s
                      OR status IN (''interested'', ''follow_up'', ''new'')
                  )
                ORDER BY updated_at DESC
                LIMIT 25
            ) a',
            CASE WHEN v_has_email THEN 'COALESCE(email, '''')' ELSE '''''' END,
            CASE WHEN v_has_phone THEN 'COALESCE(phone, '''')' ELSE '''''' END,
            CASE WHEN v_has_reminder THEN 'reminder_at' ELSE 'NULL::timestamptz' END,
            CASE WHEN v_has_product THEN 'product_purchased' ELSE 'NULL::text' END,
            CASE WHEN v_has_sales_owner THEN 'sales_owner_id' ELSE 'NULL::uuid' END,
            v_table_name,
            p_company_id,
            v_user_filter,
            CASE WHEN v_has_reminder THEN 'reminder_at IS NOT NULL' ELSE 'FALSE' END
        ) INTO v_action_leads;
    END IF;

    -- 7. Assemble final response
    RETURN jsonb_build_object(
        'kpis', jsonb_build_object(
            'leads_today', COALESCE(v_leads_today, 0),
            'paid_today', COALESCE(v_paid_today, 0),
            'revenue_today', COALESCE(v_rev_today, 0),
            'total_revenue', COALESCE(v_total_rev, 0),
            'projected_revenue', COALESCE(v_proj_rev, 0),
            'pipeline_value', COALESCE(v_pipeline_val, 0),
            'total_incentive', COALESCE(v_total_rev * (v_user_incentive_pct / 100.0), 0),
            'total_leads', COALESCE(v_total_leads, 0)
        ),
        'intake_trend', COALESCE(v_intake_trend, '[]'::jsonb),
        'status_distribution', COALESCE(v_status_distribution, '[]'::jsonb),
        'recent_leads', COALESCE(v_recent_leads, '[]'::jsonb),
        'action_leads', COALESCE(v_action_leads, '[]'::jsonb),
        'table_name', v_table_name
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(uuid, int, uuid, uuid[]) TO authenticated, service_role, anon;
