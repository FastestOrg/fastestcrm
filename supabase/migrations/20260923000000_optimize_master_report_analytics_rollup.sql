-- ==============================================================================
-- Production Migration: High-Scale Master Report Analytics (Lambda Architecture)
-- Author: FastestCRM Engineering
-- Eliminates statement timeouts (code 57014) on 2,000,000+ lead tables.
-- ==============================================================================

-- 1. Create Daily Analytics Rollup Table
CREATE TABLE IF NOT EXISTS public.company_lead_analytics_daily (
    id bigserial PRIMARY KEY,
    company_id uuid NOT NULL,
    day date NOT NULL,
    sales_owner_id uuid,
    status text NOT NULL DEFAULT 'new',
    lead_source text NOT NULL DEFAULT 'organic',
    product text NOT NULL DEFAULT 'General',
    total_leads bigint NOT NULL DEFAULT 0,
    paid_leads bigint NOT NULL DEFAULT 0,
    won_revenue numeric NOT NULL DEFAULT 0,
    pipeline_revenue numeric NOT NULL DEFAULT 0,
    active_leads bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_company_lead_daily UNIQUE(company_id, day, sales_owner_id, status, lead_source, product)
);

ALTER TABLE public.company_lead_analytics_daily 
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_lead_daily_company_day 
ON public.company_lead_analytics_daily(company_id, day DESC);

CREATE INDEX IF NOT EXISTS idx_lead_daily_company_owner 
ON public.company_lead_analytics_daily(company_id, sales_owner_id, day DESC);

-- 2. Function to populate / refresh daily rollup for a company
CREATE OR REPLACE FUNCTION public.refresh_company_lead_analytics_daily(
    p_company_id uuid DEFAULT NULL,
    p_days_back int DEFAULT 90
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r_comp RECORD;
    v_tbl text;
    v_has_products boolean;
    v_start_date date := CURRENT_DATE - p_days_back;
BEGIN
    FOR r_comp IN 
        SELECT c.id, c.custom_leads_table, LOWER(c.industry) as industry 
        FROM public.companies c
        WHERE (p_company_id IS NULL OR c.id = p_company_id)
    LOOP
        v_tbl := r_comp.custom_leads_table;
        IF v_tbl IS NULL OR v_tbl = '' THEN
            IF r_comp.industry = 'real_estate' THEN v_tbl := 'leads_real_estate';
            ELSIF r_comp.industry = 'saas' THEN v_tbl := 'leads_saas';
            ELSIF r_comp.industry = 'healthcare' THEN v_tbl := 'leads_healthcare';
            ELSIF r_comp.industry = 'insurance' THEN v_tbl := 'leads_insurance';
            ELSIF r_comp.industry = 'travel' THEN v_tbl := 'leads_travel';
            ELSE v_tbl := 'leads';
            END IF;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = v_tbl
        ) THEN
            CONTINUE;
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = 'product_purchased'
        ) INTO v_has_products;

        -- Aggregate historical days up to yesterday
        EXECUTE format('
            INSERT INTO public.company_lead_analytics_daily (
                company_id,
                day,
                sales_owner_id,
                status,
                lead_source,
                product,
                total_leads,
                paid_leads,
                won_revenue,
                pipeline_revenue,
                active_leads,
                updated_at
            )
            SELECT 
                company_id,
                date_trunc(''day'', created_at)::date as day,
                sales_owner_id,
                COALESCE(status, ''new'') as status,
                LOWER(TRIM(COALESCE(lead_source, ''organic''))) as lead_source,
                %s as product,
                COUNT(*) as total_leads,
                COUNT(*) FILTER (WHERE status = ''paid'' OR COALESCE(revenue_received, 0) > 0) as paid_leads,
                COALESCE(SUM(revenue_received), 0) as won_revenue,
                COALESCE(SUM(revenue_projected), 0) as pipeline_revenue,
                COUNT(*) FILTER (WHERE status NOT IN (''paid'', ''lost'', ''junk'', ''not_intrested'', ''not_interested'')) as active_leads,
                now()
            FROM public.%I
            WHERE company_id = %L
              AND created_at < CURRENT_DATE
              %s
            GROUP BY 1, 2, 3, 4, 5, 6
            ON CONFLICT (company_id, day, sales_owner_id, status, lead_source, product)
            DO UPDATE SET
                total_leads = EXCLUDED.total_leads,
                paid_leads = EXCLUDED.paid_leads,
                won_revenue = EXCLUDED.won_revenue,
                pipeline_revenue = EXCLUDED.pipeline_revenue,
                active_leads = EXCLUDED.active_leads,
                updated_at = now();
        ',
        CASE WHEN v_has_products THEN 'COALESCE(product_purchased, ''General'')' ELSE '''General''' END,
        v_tbl,
        r_comp.id,
        CASE WHEN p_days_back > 0 THEN format('AND created_at >= %L', v_start_date) ELSE '' END
        );
    END LOOP;
END;
$$;

-- 3. High-Performance Lambda Architecture Master Report Analytics RPC
CREATE OR REPLACE FUNCTION public.get_master_report_analytics(
    p_company_id uuid,
    p_start_date timestamptz DEFAULT NULL,
    p_end_date timestamptz DEFAULT NULL,
    p_owner_ids uuid[] DEFAULT NULL,
    p_statuses text[] DEFAULT NULL,
    p_sources text[] DEFAULT NULL,
    p_products text[] DEFAULT NULL,
    p_revenue_status text DEFAULT 'all',
    p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_table_name text;
    v_industry text;
    v_has_products boolean := false;
    v_use_rollup boolean := false;
    v_sql text;
    v_where_rollup text := '1=1';
    v_where_live text := '1=1';
    v_where_raw text := '1=1';
    v_result jsonb;
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

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = v_table_name
    ) THEN
        v_table_name := 'leads';
    END IF;

    -- Check if table has product_purchased column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = v_table_name AND column_name = 'product_purchased'
    ) INTO v_has_products;

    -- Check if company has data in daily rollup and no text search is requested
    IF (p_search IS NULL OR TRIM(p_search) = '') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.company_lead_analytics_daily 
            WHERE company_id = p_company_id 
            LIMIT 1
        ) INTO v_use_rollup;
    END IF;

    -- =========================================================================
    -- PATH A: LAMBDA ARCHITECTURE (Rollup for past days + Live for today)
    -- =========================================================================
    IF v_use_rollup THEN
        v_where_rollup := format('company_id = %L AND day < CURRENT_DATE', p_company_id);
        v_where_live := format('l.company_id = %L AND l.created_at >= CURRENT_DATE', p_company_id);

        IF p_start_date IS NOT NULL THEN
            v_where_rollup := v_where_rollup || format(' AND day >= %L::date', p_start_date);
            v_where_live := v_where_live || format(' AND l.created_at >= %L', p_start_date);
        END IF;

        IF p_end_date IS NOT NULL THEN
            v_where_rollup := v_where_rollup || format(' AND day <= %L::date', p_end_date);
            v_where_live := v_where_live || format(' AND l.created_at <= %L', p_end_date);
        END IF;

        IF p_owner_ids IS NOT NULL AND array_length(p_owner_ids, 1) > 0 THEN
            v_where_rollup := v_where_rollup || format(' AND sales_owner_id = ANY(%L::uuid[])', p_owner_ids);
            v_where_live := v_where_live || format(' AND l.sales_owner_id = ANY(%L::uuid[])', p_owner_ids);
        END IF;

        IF p_statuses IS NOT NULL AND array_length(p_statuses, 1) > 0 THEN
            v_where_rollup := v_where_rollup || format(' AND status = ANY(%L::text[])', p_statuses);
            v_where_live := v_where_live || format(' AND l.status = ANY(%L::text[])', p_statuses);
        END IF;

        IF p_sources IS NOT NULL AND array_length(p_sources, 1) > 0 THEN
            v_where_rollup := v_where_rollup || format(' AND lead_source = ANY(%L::text[])', p_sources);
            v_where_live := v_where_live || format(' AND LOWER(TRIM(COALESCE(l.lead_source, ''''))) = ANY(%L::text[])', p_sources);
        END IF;

        IF p_products IS NOT NULL AND array_length(p_products, 1) > 0 THEN
            v_where_rollup := v_where_rollup || format(' AND product = ANY(%L::text[])', p_products);
            IF v_has_products THEN
                v_where_live := v_where_live || format(' AND l.product_purchased = ANY(%L::text[])', p_products);
            END IF;
        END IF;

        IF p_revenue_status = 'with_revenue' THEN
            v_where_rollup := v_where_rollup || ' AND won_revenue > 0';
            v_where_live := v_where_live || ' AND COALESCE(l.revenue_received, 0) > 0';
        ELSIF p_revenue_status = 'zero_revenue' THEN
            v_where_rollup := v_where_rollup || ' AND won_revenue <= 0';
            v_where_live := v_where_live || ' AND COALESCE(l.revenue_received, 0) <= 0';
        END IF;

        v_sql := format('
            WITH historical_summary AS (
                SELECT 
                    status,
                    sales_owner_id,
                    lead_source,
                    product,
                    total_leads,
                    paid_leads,
                    won_revenue,
                    pipeline_revenue,
                    active_leads,
                    date_trunc(''month'', day)::date as created_month
                FROM public.company_lead_analytics_daily
                WHERE %s
            ),
            live_today AS (
                SELECT 
                    COALESCE(l.status, ''new'') as status,
                    l.sales_owner_id,
                    LOWER(TRIM(COALESCE(l.lead_source, ''organic''))) as lead_source,
                    %s as product,
                    1::bigint as total_leads,
                    CASE WHEN l.status = ''paid'' OR COALESCE(l.revenue_received, 0) > 0 THEN 1::bigint ELSE 0::bigint END as paid_leads,
                    COALESCE(l.revenue_received, 0) as won_revenue,
                    COALESCE(l.revenue_projected, 0) as pipeline_revenue,
                    CASE WHEN l.status NOT IN (''paid'', ''lost'', ''junk'', ''not_intrested'', ''not_interested'') THEN 1::bigint ELSE 0::bigint END as active_leads,
                    date_trunc(''month'', l.created_at)::date as created_month
                FROM public.%I l
                WHERE %s
            ),
            combined_summary AS MATERIALIZED (
                SELECT * FROM historical_summary
                UNION ALL
                SELECT * FROM live_today
            ),
            kpi_agg AS (
                SELECT 
                    COALESCE(SUM(total_leads), 0) as total_leads,
                    COALESCE(SUM(paid_leads), 0) as paid_leads,
                    COALESCE(SUM(won_revenue), 0) as won_revenue,
                    COALESCE(SUM(pipeline_revenue), 0) as pipeline_revenue,
                    COALESCE(SUM(active_leads), 0) as active_leads
                FROM combined_summary
            ),
            status_agg AS (
                SELECT 
                    status,
                    SUM(total_leads) as count,
                    SUM(paid_leads) as won_count,
                    SUM(won_revenue) as revenue
                FROM combined_summary
                GROUP BY status
                ORDER BY count DESC
            ),
            status_counts_by_owner AS (
                SELECT 
                    sales_owner_id, 
                    status, 
                    SUM(total_leads) as sc_count,
                    SUM(paid_leads) as sc_won,
                    SUM(won_revenue) as sc_revenue
                FROM combined_summary
                GROUP BY sales_owner_id, status
            ),
            owner_agg AS (
                SELECT 
                    sco.sales_owner_id as owner_id,
                    COALESCE(p.full_name, split_part(p.email, ''@'', 1), ''Unassigned'') as owner_name,
                    SUM(sco.sc_count) as total_leads,
                    SUM(sco.sc_won) as won_leads,
                    SUM(sco.sc_revenue) as revenue,
                    jsonb_object_agg(sco.status, sco.sc_count) as status_counts
                FROM status_counts_by_owner sco
                LEFT JOIN public.profiles p ON p.id = sco.sales_owner_id
                GROUP BY sco.sales_owner_id, p.full_name, p.email
                ORDER BY total_leads DESC
            ),
            source_agg AS (
                SELECT 
                    lead_source as source,
                    SUM(total_leads) as volume,
                    SUM(paid_leads) as converted,
                    SUM(won_revenue) as revenue
                FROM combined_summary
                WHERE lead_source IS NOT NULL AND lead_source != ''''
                GROUP BY lead_source
                ORDER BY volume DESC
            ),
            product_agg AS (
                SELECT 
                    product,
                    SUM(total_leads) as volume,
                    SUM(paid_leads) as converted,
                    SUM(won_revenue) as revenue
                FROM combined_summary
                WHERE product IS NOT NULL AND product != ''''
                GROUP BY product
                ORDER BY volume DESC
            ),
            month_agg AS (
                SELECT 
                    to_char(created_month, ''YYYY-MM'') as month_key,
                    to_char(created_month, ''Mon YYYY'') as month_label,
                    SUM(total_leads) as leads,
                    SUM(paid_leads) as paid,
                    SUM(won_revenue) as revenue
                FROM combined_summary
                GROUP BY created_month
                ORDER BY created_month ASC
            )
            SELECT jsonb_build_object(
                ''table_name'', %L,
                ''kpis'', (
                    SELECT jsonb_build_object(
                        ''total_leads'', total_leads,
                        ''paid_leads'', paid_leads,
                        ''won_revenue'', won_revenue,
                        ''pipeline_revenue'', pipeline_revenue,
                        ''active_leads'', active_leads,
                        ''conversion_rate'', CASE WHEN total_leads > 0 THEN ROUND((paid_leads::numeric / total_leads::numeric) * 100, 1) ELSE 0 END,
                        ''avg_deal_size'', CASE WHEN paid_leads > 0 THEN ROUND(won_revenue / paid_leads, 0) ELSE 0 END
                    ) FROM kpi_agg
                ),
                ''status_breakdown'', COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            ''status'', status,
                            ''count'', count,
                            ''won_count'', won_count,
                            ''revenue'', revenue
                        )
                    ) FROM status_agg
                ), ''[]''::jsonb),
                ''owner_breakdown'', COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            ''owner_id'', owner_id,
                            ''owner_name'', owner_name,
                            ''total_leads'', total_leads,
                            ''won_leads'', won_leads,
                            ''revenue'', revenue,
                            ''conversion_rate'', CASE WHEN total_leads > 0 THEN ROUND((won_leads::numeric / total_leads::numeric) * 100, 1) ELSE 0 END,
                            ''status_counts'', status_counts
                        )
                    ) FROM owner_agg
                ), ''[]''::jsonb),
                ''source_breakdown'', COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            ''source'', source,
                            ''volume'', volume,
                            ''converted'', converted,
                            ''revenue'', revenue,
                            ''conversion_rate'', CASE WHEN volume > 0 THEN ROUND((converted::numeric / volume::numeric) * 100, 1) ELSE 0 END,
                            ''share_percent'', CASE WHEN (SELECT total_leads FROM kpi_agg) > 0 THEN ROUND((volume::numeric / (SELECT total_leads FROM kpi_agg)::numeric) * 100, 1) ELSE 0 END
                        )
                    ) FROM source_agg
                ), ''[]''::jsonb),
                ''product_breakdown'', COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            ''product'', product,
                            ''volume'', volume,
                            ''converted'', converted,
                            ''revenue'', revenue,
                            ''conversion_rate'', CASE WHEN volume > 0 THEN ROUND((converted::numeric / volume::numeric) * 100, 1) ELSE 0 END
                        )
                    ) FROM product_agg
                ), ''[]''::jsonb),
                ''month_breakdown'', COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            ''month_key'', month_key,
                            ''month_label'', month_label,
                            ''leads'', leads,
                            ''paid'', paid,
                            ''revenue'', revenue
                        )
                    ) FROM month_agg
                ), ''[]''::jsonb)
            );
        ',
        v_where_rollup,
        CASE WHEN v_has_products THEN 'COALESCE(l.product_purchased, ''General'')' ELSE '''General''' END,
        v_table_name,
        v_where_live,
        v_table_name
        );

        EXECUTE v_sql INTO v_result;
        RETURN v_result;
    END IF;

    -- =========================================================================
    -- PATH B: FAST SINGLE-PASS SCAN (When search is active or no rollup data)
    -- =========================================================================
    v_where_raw := format('l.company_id = %L', p_company_id);

    IF p_start_date IS NOT NULL THEN
        v_where_raw := v_where_raw || format(' AND l.created_at >= %L', p_start_date);
    END IF;
    IF p_end_date IS NOT NULL THEN
        v_where_raw := v_where_raw || format(' AND l.created_at <= %L', p_end_date);
    END IF;

    IF p_owner_ids IS NOT NULL AND array_length(p_owner_ids, 1) > 0 THEN
        v_where_raw := v_where_raw || format(' AND l.sales_owner_id = ANY(%L::uuid[])', p_owner_ids);
    END IF;

    IF p_statuses IS NOT NULL AND array_length(p_statuses, 1) > 0 THEN
        v_where_raw := v_where_raw || format(' AND l.status = ANY(%L::text[])', p_statuses);
    END IF;

    IF p_sources IS NOT NULL AND array_length(p_sources, 1) > 0 THEN
        v_where_raw := v_where_raw || format(' AND LOWER(TRIM(COALESCE(l.lead_source, ''''))) = ANY(%L::text[])', p_sources);
    END IF;

    IF v_has_products AND p_products IS NOT NULL AND array_length(p_products, 1) > 0 THEN
        v_where_raw := v_where_raw || format(' AND l.product_purchased = ANY(%L::text[])', p_products);
    END IF;

    IF p_revenue_status = 'with_revenue' THEN
        v_where_raw := v_where_raw || ' AND COALESCE(l.revenue_received, 0) > 0';
    ELSIF p_revenue_status = 'zero_revenue' THEN
        v_where_raw := v_where_raw || ' AND COALESCE(l.revenue_received, 0) <= 0';
    END IF;

    IF p_search IS NOT NULL AND TRIM(p_search) != '' THEN
        v_where_raw := v_where_raw || format(' AND (l.name ILIKE %L OR l.email ILIKE %L OR l.phone ILIKE %L)', 
                                     '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');
    END IF;

    v_sql := format('
        WITH filtered_leads AS MATERIALIZED (
            SELECT 
                l.status,
                l.sales_owner_id,
                LOWER(TRIM(COALESCE(l.lead_source, ''organic''))) as clean_source,
                %s as clean_product,
                COALESCE(l.revenue_received, 0) as rev_received,
                COALESCE(l.revenue_projected, 0) as rev_projected,
                date_trunc(''month'', l.created_at)::date as created_month
            FROM public.%I l
            WHERE %s
        ),
        kpi_agg AS (
            SELECT 
                COUNT(*) as total_leads,
                COUNT(*) FILTER (WHERE status = ''paid'' OR rev_received > 0) as paid_leads,
                COALESCE(SUM(rev_received), 0) as won_revenue,
                COALESCE(SUM(rev_projected), 0) as pipeline_revenue,
                COUNT(*) FILTER (WHERE status NOT IN (''paid'', ''lost'', ''junk'', ''not_intrested'', ''not_interested'')) as active_leads
            FROM filtered_leads
        ),
        status_agg AS (
            SELECT 
                status,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE status = ''paid'' OR rev_received > 0) as won_count,
                COALESCE(SUM(rev_received), 0) as revenue
            FROM filtered_leads
            GROUP BY status
            ORDER BY count DESC
        ),
        status_counts_by_owner AS (
            SELECT 
                sales_owner_id, 
                status, 
                COUNT(*) as sc_count,
                COUNT(*) FILTER (WHERE status = ''paid'' OR rev_received > 0) as sc_won,
                COALESCE(SUM(rev_received), 0) as sc_revenue
            FROM filtered_leads
            GROUP BY sales_owner_id, status
        ),
        owner_agg AS (
            SELECT 
                sco.sales_owner_id as owner_id,
                COALESCE(p.full_name, split_part(p.email, ''@'', 1), ''Unassigned'') as owner_name,
                SUM(sco.sc_count) as total_leads,
                SUM(sco.sc_won) as won_leads,
                SUM(sco.sc_revenue) as revenue,
                jsonb_object_agg(sco.status, sco.sc_count) as status_counts
            FROM status_counts_by_owner sco
            LEFT JOIN public.profiles p ON p.id = sco.sales_owner_id
            GROUP BY sco.sales_owner_id, p.full_name, p.email
            ORDER BY total_leads DESC
        ),
        source_agg AS (
            SELECT 
                clean_source as source,
                COUNT(*) as volume,
                COUNT(*) FILTER (WHERE status = ''paid'' OR rev_received > 0) as converted,
                COALESCE(SUM(rev_received), 0) as revenue
            FROM filtered_leads
            WHERE clean_source IS NOT NULL AND clean_source != ''''
            GROUP BY clean_source
            ORDER BY volume DESC
        ),
        product_agg AS (
            SELECT 
                clean_product as product,
                COUNT(*) as volume,
                COUNT(*) FILTER (WHERE status = ''paid'' OR rev_received > 0) as converted,
                COALESCE(SUM(rev_received), 0) as revenue
            FROM filtered_leads
            WHERE clean_product IS NOT NULL AND clean_product != ''''
            GROUP BY clean_product
            ORDER BY volume DESC
        ),
        month_agg AS (
            SELECT 
                to_char(created_month, ''YYYY-MM'') as month_key,
                to_char(created_month, ''Mon YYYY'') as month_label,
                COUNT(*) as leads,
                COUNT(*) FILTER (WHERE status = ''paid'' OR rev_received > 0) as paid,
                COALESCE(SUM(rev_received), 0) as revenue
            FROM filtered_leads
            GROUP BY created_month
            ORDER BY created_month ASC
        )
        SELECT jsonb_build_object(
            ''table_name'', %L,
            ''kpis'', (
                SELECT jsonb_build_object(
                    ''total_leads'', total_leads,
                    ''paid_leads'', paid_leads,
                    ''won_revenue'', won_revenue,
                    ''pipeline_revenue'', pipeline_revenue,
                    ''active_leads'', active_leads,
                    ''conversion_rate'', CASE WHEN total_leads > 0 THEN ROUND((paid_leads::numeric / total_leads::numeric) * 100, 1) ELSE 0 END,
                    ''avg_deal_size'', CASE WHEN paid_leads > 0 THEN ROUND(won_revenue / paid_leads, 0) ELSE 0 END
                ) FROM kpi_agg
            ),
            ''status_breakdown'', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        ''status'', status,
                        ''count'', count,
                        ''won_count'', won_count,
                        ''revenue'', revenue
                    )
                ) FROM status_agg
            ), ''[]''::jsonb),
            ''owner_breakdown'', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        ''owner_id'', owner_id,
                        ''owner_name'', owner_name,
                        ''total_leads'', total_leads,
                        ''won_leads'', won_leads,
                        ''revenue'', revenue,
                        ''conversion_rate'', CASE WHEN total_leads > 0 THEN ROUND((won_leads::numeric / total_leads::numeric) * 100, 1) ELSE 0 END,
                        ''status_counts'', status_counts
                    )
                ) FROM owner_agg
            ), ''[]''::jsonb),
            ''source_breakdown'', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        ''source'', source,
                        ''volume'', volume,
                        ''converted'', converted,
                        ''revenue'', revenue,
                        ''conversion_rate'', CASE WHEN volume > 0 THEN ROUND((converted::numeric / volume::numeric) * 100, 1) ELSE 0 END,
                        ''share_percent'', CASE WHEN (SELECT total_leads FROM kpi_agg) > 0 THEN ROUND((volume::numeric / (SELECT total_leads FROM kpi_agg)::numeric) * 100, 1) ELSE 0 END
                    )
                ) FROM source_agg
            ), ''[]''::jsonb),
            ''product_breakdown'', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        ''product'', product,
                        ''volume'', volume,
                        ''converted'', converted,
                        ''revenue'', revenue,
                        ''conversion_rate'', CASE WHEN volume > 0 THEN ROUND((converted::numeric / volume::numeric) * 100, 1) ELSE 0 END
                    )
                ) FROM product_agg
            ), ''[]''::jsonb),
            ''month_breakdown'', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        ''month_key'', month_key,
                        ''month_label'', month_label,
                        ''leads'', leads,
                        ''paid'', paid,
                        ''revenue'', revenue
                    )
                ) FROM month_agg
            ), ''[]''::jsonb)
        );
    ',
    CASE WHEN v_has_products THEN 'COALESCE(l.product_purchased, ''General'')' ELSE '''General''' END,
    v_table_name,
    v_where_raw,
    v_table_name
    );

    EXECUTE v_sql INTO v_result;
    RETURN v_result;
END;
$$;

-- 4. Permissions
GRANT SELECT ON public.company_lead_analytics_daily TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_master_report_analytics(uuid, timestamptz, timestamptz, uuid[], text[], text[], text[], text, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_company_lead_analytics_daily(uuid, int) TO authenticated, anon, service_role;

-- 5. Initial populate of rollup for existing companies
SELECT public.refresh_company_lead_analytics_daily(NULL, 0);
