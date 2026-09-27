-- Migration: Fast Faceted Filter Options RPC with Recursive CTE Skip Scan & Covering Indexes
-- Timestamp: 2026-09-27 21:45:00
-- Description: Upgrades get_faceted_filter_options() to use Recursive CTE Loose Index Scan (Skip Scan)
-- and index-friendly ANY() equality filters, eliminating statement timeouts on multi-million row tables.

-- 1. Ensure composite indexes for country + lead_source and country + status on tables having country
CREATE INDEX IF NOT EXISTS idx_leads_efficacy_company_country_source 
ON public.leads_efficacy (company_id, country, lead_source);

CREATE INDEX IF NOT EXISTS idx_leads_efficacy_company_country_status 
ON public.leads_efficacy (company_id, country, status);

-- 2. Upgrade get_faceted_filter_options function
DROP FUNCTION IF EXISTS public.get_faceted_filter_options(text, uuid, text[], jsonb, uuid[]);
DROP FUNCTION IF EXISTS public.get_faceted_filter_options(text, uuid, text[], jsonb, uuid[], uuid[]);

CREATE OR REPLACE FUNCTION public.get_faceted_filter_options(
    p_table_name text,
    p_company_id uuid,
    p_target_columns text[],
    p_filters jsonb,
    p_accessible_user_ids uuid[] DEFAULT NULL,
    p_active_owner_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_col text;
    v_filter_key text;
    v_filter_vals jsonb;
    v_where_clauses text[];
    v_where_sql text;
    v_col_query text;
    v_col_vals text[];
    v_result jsonb := '{}'::jsonb;
    v_valid_cols text[];
    v_has_other_filters boolean;
    v_has_unassigned_leads boolean;
    v_status_vals text[];
    v_filter_val_arr text[];
BEGIN
    -- 1. Validate table exists in public schema
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = p_table_name
    ) THEN
        RETURN '{}'::jsonb;
    END IF;

    -- 2. Fetch list of all valid columns for this table
    SELECT array_agg(column_name::text) INTO v_valid_cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table_name;

    IF v_valid_cols IS NULL THEN
        RETURN '{}'::jsonb;
    END IF;

    -- 3. Loop through each requested target column
    FOREACH v_col IN ARRAY p_target_columns
    LOOP
        -- Check column is valid on table
        IF NOT (v_col = ANY(v_valid_cols)) THEN
            CONTINUE;
        END IF;

        -- Check if any other filters exist that constrain this column
        v_has_other_filters := false;
        FOR v_filter_key, v_filter_vals IN SELECT * FROM jsonb_each(p_filters)
        LOOP
            IF v_filter_key <> v_col 
               AND NOT (v_filter_key = 'owner' AND v_col = 'sales_owner_id')
               AND NOT (v_filter_key = 'sales_owner_id' AND v_col = 'owner')
               AND NOT (v_filter_key = 'product' AND v_col = 'product_purchased')
               AND NOT (v_filter_key = 'product_purchased' AND v_col = 'product')
            THEN
                IF jsonb_typeof(v_filter_vals) = 'array' AND jsonb_array_length(v_filter_vals) > 0 THEN
                    v_has_other_filters := true;
                    EXIT;
                END IF;
            END IF;
        END LOOP;

        -- If no other filters constrain this column, skip querying it (frontend uses master options)
        IF NOT v_has_other_filters THEN
            CONTINUE;
        END IF;

        -- Initialize WHERE clauses
        IF v_col <> 'sales_owner_id' THEN
            v_where_clauses := ARRAY[
                format('%I IS NOT NULL', v_col),
                format('%I <> %L', v_col, '')
            ];
        ELSE
            v_where_clauses := ARRAY['1=1'];
        END IF;

        IF p_company_id IS NOT NULL AND ('company_id' = ANY(v_valid_cols)) THEN
            v_where_clauses := array_append(v_where_clauses, format('company_id = %L', p_company_id));
        END IF;

        -- Enforce user hierarchy scoping if restricted
        IF p_accessible_user_ids IS NOT NULL AND array_length(p_accessible_user_ids, 1) > 0 AND ('sales_owner_id' = ANY(v_valid_cols)) THEN
            v_where_clauses := array_append(
                v_where_clauses,
                format('sales_owner_id = ANY(%L::uuid[])', p_accessible_user_ids)
            );
        END IF;

        -- Apply all active filters EXCEPT for the current column
        FOR v_filter_key, v_filter_vals IN SELECT * FROM jsonb_each(p_filters)
        LOOP
            IF v_filter_key = v_col 
               OR (v_filter_key = 'owner' AND v_col = 'sales_owner_id')
               OR (v_filter_key = 'sales_owner_id' AND v_col = 'owner')
               OR (v_filter_key = 'product' AND v_col = 'product_purchased')
               OR (v_filter_key = 'product_purchased' AND v_col = 'product')
            THEN
                CONTINUE;
            END IF;

            DECLARE
                v_db_col text := v_filter_key;
                v_has_unassigned boolean := false;
                v_real_ids text[] := ARRAY[]::text[];
                v_arr_elem jsonb;
            BEGIN
                IF v_filter_key = 'owner' THEN
                    v_db_col := 'sales_owner_id';
                ELSIF v_filter_key = 'product' THEN
                    v_db_col := 'product_purchased';
                END IF;

                -- Ensure db_col is valid on table
                IF NOT (v_db_col = ANY(v_valid_cols)) THEN
                    CONTINUE;
                END IF;

                IF jsonb_typeof(v_filter_vals) = 'array' AND jsonb_array_length(v_filter_vals) > 0 THEN
                    IF v_db_col = 'sales_owner_id' THEN
                        FOR v_arr_elem IN SELECT * FROM jsonb_array_elements(v_filter_vals)
                        LOOP
                            IF v_arr_elem #>> '{}' = 'unassigned' THEN
                                v_has_unassigned := true;
                            ELSE
                                v_real_ids := array_append(v_real_ids, v_arr_elem #>> '{}');
                            END IF;
                        END LOOP;

                        IF v_has_unassigned THEN
                            IF p_active_owner_ids IS NOT NULL AND array_length(p_active_owner_ids, 1) > 0 THEN
                                IF array_length(v_real_ids, 1) > 0 THEN
                                    v_where_clauses := array_append(
                                        v_where_clauses,
                                        format('(sales_owner_id IS NULL OR NOT (sales_owner_id = ANY(%L::uuid[])) OR sales_owner_id = ANY(%L::uuid[]))', p_active_owner_ids, v_real_ids)
                                    );
                                ELSE
                                    v_where_clauses := array_append(
                                        v_where_clauses,
                                        format('(sales_owner_id IS NULL OR NOT (sales_owner_id = ANY(%L::uuid[])))', p_active_owner_ids)
                                    );
                                END IF;
                            ELSE
                                IF array_length(v_real_ids, 1) > 0 THEN
                                    v_where_clauses := array_append(
                                        v_where_clauses,
                                        format('(sales_owner_id IS NULL OR sales_owner_id = ANY(%L::uuid[]))', v_real_ids)
                                    );
                                ELSE
                                    v_where_clauses := array_append(v_where_clauses, 'sales_owner_id IS NULL');
                                END IF;
                            END IF;
                        ELSIF array_length(v_real_ids, 1) > 0 THEN
                            v_where_clauses := array_append(
                                v_where_clauses,
                                format('sales_owner_id = ANY(%L::uuid[])', v_real_ids)
                            );
                        END IF;
                    ELSIF v_db_col = 'status' THEN
                        SELECT array_agg(LOWER(REPLACE(x.val, ' ', '_'))) INTO v_status_vals
                        FROM (SELECT jsonb_array_elements_text(v_filter_vals) AS val) x;

                        IF v_status_vals IS NOT NULL AND array_length(v_status_vals, 1) > 0 THEN
                            IF array_length(v_status_vals, 1) = 1 THEN
                                v_where_clauses := array_append(
                                    v_where_clauses,
                                    format('status = %L', v_status_vals[1])
                                );
                            ELSE
                                v_where_clauses := array_append(
                                    v_where_clauses,
                                    format('status = ANY(%L)', v_status_vals)
                                );
                            END IF;
                        END IF;
                    ELSE
                        -- Use clean single equality when 1 value, or ANY() for multiple values
                        SELECT array_agg(x.val) INTO v_filter_val_arr
                        FROM (SELECT jsonb_array_elements_text(v_filter_vals) AS val) x;

                        IF v_filter_val_arr IS NOT NULL AND array_length(v_filter_val_arr, 1) > 0 THEN
                            IF array_length(v_filter_val_arr, 1) = 1 THEN
                                v_where_clauses := array_append(
                                    v_where_clauses,
                                    format('%I = %L', v_db_col, v_filter_val_arr[1])
                                );
                            ELSE
                                v_where_clauses := array_append(
                                    v_where_clauses,
                                    format('%I = ANY(%L)', v_db_col, v_filter_val_arr)
                                );
                            END IF;
                        END IF;
                    END IF;
                END IF;
            END;
        END LOOP;

        v_where_sql := array_to_string(v_where_clauses, ' AND ');

        -- Execute distinct query for current column with other filters applied
        BEGIN
            IF v_col = 'sales_owner_id' THEN
                -- Check if any matching leads are unassigned (NULL or not in active owners)
                IF p_active_owner_ids IS NOT NULL AND array_length(p_active_owner_ids, 1) > 0 THEN
                    EXECUTE format(
                        'SELECT EXISTS(SELECT 1 FROM public.%I WHERE %s AND (sales_owner_id IS NULL OR NOT (sales_owner_id = ANY(%L::uuid[]))))',
                        p_table_name, v_where_sql, p_active_owner_ids
                    ) INTO v_has_unassigned_leads;

                    EXECUTE format(
                        'SELECT ARRAY(
                            SELECT DISTINCT sales_owner_id::text 
                            FROM public.%I 
                            WHERE %s AND sales_owner_id = ANY(%L::uuid[])
                            LIMIT 250
                        )',
                        p_table_name, v_where_sql, p_active_owner_ids
                    ) INTO v_col_vals;
                ELSE
                    EXECUTE format(
                        'SELECT EXISTS(SELECT 1 FROM public.%I WHERE %s AND sales_owner_id IS NULL)',
                        p_table_name, v_where_sql
                    ) INTO v_has_unassigned_leads;

                    EXECUTE format(
                        'SELECT ARRAY(
                            SELECT DISTINCT sales_owner_id::text 
                            FROM public.%I 
                            WHERE %s AND sales_owner_id IS NOT NULL
                            LIMIT 250
                        )',
                        p_table_name, v_where_sql
                    ) INTO v_col_vals;
                END IF;

                IF v_has_unassigned_leads THEN
                    v_col_vals := array_append(COALESCE(v_col_vals, ARRAY[]::text[]), 'unassigned');
                END IF;
            ELSE
                -- 1. Try ultra-fast Recursive CTE Loose Index Scan (Skip Scan)
                BEGIN
                    v_col_query := format(
                        'WITH RECURSIVE t AS (
                           (
                             SELECT %I AS val
                             FROM public.%I
                             WHERE %s
                               AND %I IS NOT NULL
                               AND %I <> %L
                             ORDER BY %I ASC
                             LIMIT 1
                           )
                           UNION ALL
                           SELECT (
                             SELECT %I
                             FROM public.%I
                             WHERE %s
                               AND %I IS NOT NULL
                               AND %I <> %L
                               AND %I > t.val
                             ORDER BY %I ASC
                             LIMIT 1
                           )
                           FROM t
                           WHERE t.val IS NOT NULL
                        )
                        SELECT ARRAY(
                          SELECT val::text FROM t 
                          WHERE val IS NOT NULL 
                          ORDER BY val ASC
                          LIMIT 250
                        )',
                        v_col, p_table_name, v_where_sql, v_col, v_col, '', v_col,
                        v_col, p_table_name, v_where_sql, v_col, v_col, '', v_col, v_col
                    );
                    EXECUTE v_col_query INTO v_col_vals;
                EXCEPTION WHEN OTHERS THEN
                    -- Fallback to standard DISTINCT query with local limit
                    v_col_query := format(
                        'SELECT ARRAY(
                            SELECT DISTINCT %I::text 
                            FROM public.%I 
                            WHERE %s 
                              AND %I IS NOT NULL 
                              AND %I::text <> %L 
                            ORDER BY %I::text ASC 
                            LIMIT 250
                        )',
                        v_col, p_table_name, v_where_sql, v_col, v_col, '', v_col
                    );
                    EXECUTE v_col_query INTO v_col_vals;
                END;
            END IF;

            v_result := jsonb_set(
                v_result, 
                ARRAY[v_col], 
                COALESCE(to_jsonb(v_col_vals), '[]'::jsonb)
            );
        EXCEPTION WHEN OTHERS THEN
            v_result := jsonb_set(v_result, ARRAY[v_col], '[]'::jsonb);
        END;
    END LOOP;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faceted_filter_options(text, uuid, text[], jsonb, uuid[], uuid[]) TO authenticated, service_role, anon;
