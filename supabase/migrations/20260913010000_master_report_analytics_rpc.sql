-- ==============================================================================
-- Production Migration: Master Server-Side Report Analytics RPC
-- Author: FastestCRM Senior Data Engineering
-- High-Performance Pushdown Aggregation for Master Reports Dashboard
-- ==============================================================================

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
    v_sql text;
    v_where text := '1=1';
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

    -- Check if table has product_purchased column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = v_table_name AND column_name = 'product_purchased'
    ) INTO v_has_products;

    -- 2. Build where clause
    v_where := format('l.company_id = %L', p_company_id);

    IF p_start_date IS NOT NULL THEN
        v_where := v_where || format(' AND l.created_at >= %L', p_start_date);
    END IF;
    IF p_end_date IS NOT NULL THEN
        v_where := v_where || format(' AND l.created_at <= %L', p_end_date);
    END IF;

    IF p_owner_ids IS NOT NULL AND array_length(p_owner_ids, 1) > 0 THEN
        v_where := v_where || format(' AND l.sales_owner_id = ANY(%L::uuid[])', p_owner_ids);
    END IF;

    IF p_statuses IS NOT NULL AND array_length(p_statuses, 1) > 0 THEN
        v_where := v_where || format(' AND l.status = ANY(%L::text[])', p_statuses);
    END IF;

    IF p_sources IS NOT NULL AND array_length(p_sources, 1) > 0 THEN
        v_where := v_where || format(' AND LOWER(TRIM(COALESCE(l.lead_source, ''''))) = ANY(%L::text[])', p_sources);
    END IF;

    IF v_has_products AND p_products IS NOT NULL AND array_length(p_products, 1) > 0 THEN
        v_where := v_where || format(' AND l.product_purchased = ANY(%L::text[])', p_products);
    END IF;

    IF p_revenue_status = 'with_revenue' THEN
        v_where := v_where || ' AND COALESCE(l.revenue_received, 0) > 0';
    ELSIF p_revenue_status = 'zero_revenue' THEN
        v_where := v_where || ' AND COALESCE(l.revenue_received, 0) <= 0';
    END IF;

    IF p_search IS NOT NULL AND TRIM(p_search) != '' THEN
        v_where := v_where || format(' AND (l.name ILIKE %L OR l.email ILIKE %L OR l.phone ILIKE %L)', 
                                     '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%');
    END IF;

    -- 3. Construct dynamic aggregation query
    v_sql := format('
        WITH filtered_leads AS (
            SELECT 
                l.id,
                l.status,
                l.sales_owner_id,
                LOWER(TRIM(COALESCE(l.lead_source, ''organic''))) as clean_source,
                %s as clean_product,
                COALESCE(l.revenue_received, 0) as rev_received,
                COALESCE(l.revenue_projected, 0) as rev_projected,
                date_trunc(''month'', l.created_at) as created_month
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
            SELECT sales_owner_id, status, COUNT(*) as sc_count
            FROM filtered_leads
            GROUP BY sales_owner_id, status
        ),
        owner_status_json AS (
            SELECT sales_owner_id, jsonb_object_agg(status, sc_count) as sc_json
            FROM status_counts_by_owner
            GROUP BY sales_owner_id
        ),
        owner_agg AS (
            SELECT 
                fl.sales_owner_id as owner_id,
                COALESCE(p.full_name, split_part(p.email, ''@'', 1), ''Unassigned'') as owner_name,
                COUNT(*) as total_leads,
                COUNT(*) FILTER (WHERE fl.status = ''paid'' OR fl.rev_received > 0) as won_leads,
                COALESCE(SUM(fl.rev_received), 0) as revenue,
                COALESCE(osj.sc_json, ''{}''::jsonb) as status_counts
            FROM filtered_leads fl
            LEFT JOIN public.profiles p ON p.id = fl.sales_owner_id
            LEFT JOIN owner_status_json osj ON osj.sales_owner_id IS NOT DISTINCT FROM fl.sales_owner_id
            GROUP BY fl.sales_owner_id, p.full_name, p.email, osj.sc_json
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
    v_where,
    v_table_name
    );

    EXECUTE v_sql INTO v_result;
    RETURN v_result;
END;
$$;
