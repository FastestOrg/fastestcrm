-- ==============================================================================
-- Production Migration: P0 Speed Optimizations
-- Description:
-- 1. Enables pg_trgm extension and adds GIN trigram indexes for sub-10ms searches
--    across leads and all industry / custom leads tables.
-- 2. Creates get_dashboard_analytics() pushdown RPC function for sub-15ms
--    dashboard loading, replacing 1,000-row client-side JSON downloads.
-- 3. Grants execute permissions to authenticated and service_role.
-- ==============================================================================

-- ==============================================================================
-- 1. ENABLE EXTENSION & CREATE GIN TRIGRAM INDEXES FOR SEARCH
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
DECLARE
    tbl_record RECORD;
    v_has_email BOOLEAN;
    v_has_phone BOOLEAN;
    v_has_college BOOLEAN;
    v_has_property BOOLEAN;
    v_has_company_name BOOLEAN;
BEGIN
    FOR tbl_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND (table_name = 'leads' OR table_name LIKE 'leads_%')
          AND table_name NOT IN ('leads_history', 'leads_scoring')
    LOOP
        -- Check column existence
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'email'
        ) INTO v_has_email;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'phone'
        ) INTO v_has_phone;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'college'
        ) INTO v_has_college;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'property_name'
        ) INTO v_has_property;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'company_name'
        ) INTO v_has_company_name;

        -- 1. GIN Trigram Index on 'name'
        EXECUTE format('
            CREATE INDEX IF NOT EXISTS %I 
            ON public.%I USING gin (name gin_trgm_ops)',
            'idx_' || tbl_record.table_name || '_name_trgm',
            tbl_record.table_name
        );

        -- 2. GIN Trigram Index on 'phone' (if column exists)
        IF v_has_phone THEN
            EXECUTE format('
                CREATE INDEX IF NOT EXISTS %I 
                ON public.%I USING gin (phone gin_trgm_ops)',
                'idx_' || tbl_record.table_name || '_phone_trgm',
                tbl_record.table_name
            );
        END IF;

        -- 3. GIN Trigram Index on 'email' (if column exists)
        IF v_has_email THEN
            EXECUTE format('
                CREATE INDEX IF NOT EXISTS %I 
                ON public.%I USING gin (email gin_trgm_ops)',
                'idx_' || tbl_record.table_name || '_email_trgm',
                tbl_record.table_name
            );
        END IF;

        -- 4. GIN Trigram Index on 'college' (if column exists)
        IF v_has_college THEN
            EXECUTE format('
                CREATE INDEX IF NOT EXISTS %I 
                ON public.%I USING gin (college gin_trgm_ops)',
                'idx_' || tbl_record.table_name || '_college_trgm',
                tbl_record.table_name
            );
        END IF;

        -- 5. GIN Trigram Index on 'property_name' (if column exists, e.g. Real Estate)
        IF v_has_property THEN
            EXECUTE format('
                CREATE INDEX IF NOT EXISTS %I 
                ON public.%I USING gin (property_name gin_trgm_ops)',
                'idx_' || tbl_record.table_name || '_prop_name_trgm',
                tbl_record.table_name
            );
        END IF;

        -- 6. GIN Trigram Index on 'company_name' (if column exists, e.g. SaaS)
        IF v_has_company_name THEN
            EXECUTE format('
                CREATE INDEX IF NOT EXISTS %I 
                ON public.%I USING gin (company_name gin_trgm_ops)',
                'idx_' || tbl_record.table_name || '_comp_name_trgm',
                tbl_record.table_name
            );
        END IF;

    END LOOP;
END $$;


-- ==============================================================================
-- 2. SERVER-SIDE DASHBOARD ANALYTICS RPC
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(
    p_company_id uuid,
    p_limit_recent int DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_table_name text;
    v_industry text;
    v_kpis jsonb;
    v_intake_trend jsonb;
    v_status_distribution jsonb;
    v_recent_leads jsonb;
    v_action_leads jsonb;
    v_has_reminder boolean := false;
    v_has_product boolean := false;
    v_has_history boolean := false;
    v_has_phone boolean := false;
    v_has_email boolean := false;
    v_has_sales_owner boolean := false;
    v_has_rev_received boolean := false;
    v_has_rev_projected boolean := false;
BEGIN
    -- 1. Identify target table for company
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

    -- Safety check: ensure table exists in public schema
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = v_table_name
    ) THEN
        v_table_name := 'leads';
    END IF;

    -- Check optional columns dynamically
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'reminder_at'
    ) INTO v_has_reminder;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'product_purchased'
    ) INTO v_has_product;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'lead_history'
    ) INTO v_has_history;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'email'
    ) INTO v_has_email;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'phone'
    ) INTO v_has_phone;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'sales_owner_id'
    ) INTO v_has_sales_owner;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'revenue_received'
    ) INTO v_has_rev_received;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'revenue_projected'
    ) INTO v_has_rev_projected;

    -- 2. Aggregate Core KPIs in single scan
    EXECUTE format('
        WITH lead_data AS (
            SELECT 
                l.id,
                l.status,
                %s as sales_owner_id,
                l.created_at,
                l.updated_at,
                %s as rev_received,
                %s as rev_projected,
                COALESCE(p.incentive_percent, 0) as inc_percent
            FROM public.%I l
            LEFT JOIN public.profiles p ON %s = p.id
            WHERE l.company_id = %L
        )
        SELECT jsonb_build_object(
            ''leads_today'', COUNT(*) FILTER (WHERE updated_at >= date_trunc(''day'', CURRENT_TIMESTAMP AT TIME ZONE ''UTC'')),
            ''paid_today'', COUNT(*) FILTER (WHERE status = ''paid'' AND updated_at >= date_trunc(''day'', CURRENT_TIMESTAMP AT TIME ZONE ''UTC'')),
            ''revenue_today'', COALESCE(SUM(rev_received) FILTER (WHERE updated_at >= date_trunc(''day'', CURRENT_TIMESTAMP AT TIME ZONE ''UTC'')), 0),
            ''total_revenue'', COALESCE(SUM(rev_received), 0),
            ''projected_revenue'', COALESCE(SUM(rev_projected) FILTER (WHERE status = ''paid''), 0),
            ''pipeline_value'', COALESCE(SUM(rev_projected) FILTER (WHERE status IN (''interested'', ''follow_up'')), 0),
            ''total_incentive'', COALESCE(SUM(rev_received * (inc_percent / 100.0)), 0),
            ''total_leads'', COUNT(*)
        )
        FROM lead_data',
        CASE WHEN v_has_sales_owner THEN 'l.sales_owner_id' ELSE 'NULL::uuid' END,
        CASE WHEN v_has_rev_received THEN 'COALESCE(l.revenue_received, 0)' ELSE '0::numeric' END,
        CASE WHEN v_has_rev_projected THEN 'COALESCE(l.revenue_projected, 0)' ELSE '0::numeric' END,
        v_table_name,
        CASE WHEN v_has_sales_owner THEN 'l.sales_owner_id' ELSE 'NULL::uuid' END,
        p_company_id
    ) INTO v_kpis;

    -- 3. Aggregate 7-Day Intake Trend (Using standard calendar series)
    EXECUTE format('
        WITH days AS (
            SELECT generate_series(
                (CURRENT_TIMESTAMP AT TIME ZONE ''UTC'' - INTERVAL ''6 days'')::date,
                (CURRENT_TIMESTAMP AT TIME ZONE ''UTC'')::date,
                ''1 day''::interval
            )::date AS day
        ),
        daily_counts AS (
            SELECT 
                created_at::date AS lead_day,
                COUNT(*)::int AS day_count,
                COALESCE(SUM(%s), 0) AS day_rev
            FROM public.%I
            WHERE company_id = %L
              AND created_at >= (CURRENT_TIMESTAMP AT TIME ZONE ''UTC'' - INTERVAL ''6 days'')::date
            GROUP BY created_at::date
        )
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                ''dateStr'', to_char(d.day, ''YYYY-MM-DD''),
                ''label'', to_char(d.day, ''Mon DD''),
                ''count'', COALESCE(dc.day_count, 0),
                ''revenue'', COALESCE(dc.day_rev, 0)
            ) ORDER BY d.day ASC
        ), ''[]''::jsonb)
        FROM days d
        LEFT JOIN daily_counts dc ON d.day = dc.lead_day',
        CASE WHEN v_has_rev_received THEN 'COALESCE(revenue_received, 0)' ELSE '0::numeric' END,
        v_table_name, 
        p_company_id
    ) INTO v_intake_trend;

    -- 4. Aggregate Status Breakdown
    EXECUTE format('
        WITH raw_statuses AS (
            SELECT 
                COALESCE(status, ''new'') AS status_key,
                COUNT(*)::int AS status_count
            FROM public.%I
            WHERE company_id = %L
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
        FROM raw_statuses', v_table_name, p_company_id)
    INTO v_status_distribution;

    -- 5. Recent Leads (Limited to top 5)
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
            WHERE company_id = %L
            ORDER BY created_at DESC
            LIMIT %s
        ) r', 
        CASE WHEN v_has_email THEN 'COALESCE(email, '''')' ELSE '''''' END,
        CASE WHEN v_has_phone THEN 'COALESCE(phone, '''')' ELSE '''''' END,
        CASE WHEN v_has_rev_received THEN 'COALESCE(revenue_received, 0)' ELSE '0::numeric' END,
        CASE WHEN v_has_rev_projected THEN 'COALESCE(revenue_projected, 0)' ELSE '0::numeric' END,
        v_table_name, 
        p_company_id, 
        GREATEST(1, LEAST(p_limit_recent, 20))
    ) INTO v_recent_leads;

    -- 6. Action Leads for AI Sales Playbook / ActionCenter (Up to 25 priority leads)
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
                %s as sales_owner_id,
                %s as lead_history
            FROM public.%I
            WHERE company_id = %L
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
        CASE WHEN v_has_history THEN 'lead_history' ELSE 'NULL::jsonb' END,
        v_table_name,
        p_company_id,
        CASE WHEN v_has_reminder THEN 'reminder_at IS NOT NULL' ELSE 'FALSE' END
    ) INTO v_action_leads;

    -- 7. Assemble final response
    RETURN jsonb_build_object(
        'kpis', COALESCE(v_kpis, '{}'::jsonb),
        'intake_trend', COALESCE(v_intake_trend, '[]'::jsonb),
        'status_distribution', COALESCE(v_status_distribution, '[]'::jsonb),
        'recent_leads', COALESCE(v_recent_leads, '[]'::jsonb),
        'action_leads', COALESCE(v_action_leads, '[]'::jsonb),
        'table_name', v_table_name
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_analytics(uuid, int) TO service_role;
