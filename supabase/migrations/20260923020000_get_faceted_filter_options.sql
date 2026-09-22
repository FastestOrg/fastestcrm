-- Migration: Faceted Filter Options RPC for Cascading Dropdowns
-- Timestamp: 2026-09-23 02:00:00
-- Description: Computes available distinct column values constrained by other active filters,
-- ensuring filter dropdowns only show options that exist in compatible leads.

CREATE OR REPLACE FUNCTION public.get_faceted_filter_options(
    p_table_name text,
    p_company_id uuid,
    p_target_columns text[],
    p_filters jsonb,
    p_accessible_user_ids uuid[] DEFAULT NULL
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
    v_quoted_vals text;
    v_valid_cols text[];
    v_has_other_filters boolean;
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
        v_where_clauses := ARRAY[
            format('%I IS NOT NULL', v_col),
            format('%I::text <> %L', v_col, '')
        ];

        IF p_company_id IS NOT NULL THEN
            v_where_clauses := array_append(v_where_clauses, format('company_id = %L', p_company_id));
        END IF;

        -- Enforce user hierarchy scoping if restricted
        IF p_accessible_user_ids IS NOT NULL AND array_length(p_accessible_user_ids, 1) > 0 THEN
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

                        IF v_has_unassigned AND array_length(v_real_ids, 1) > 0 THEN
                            v_where_clauses := array_append(
                                v_where_clauses,
                                format('(sales_owner_id IS NULL OR sales_owner_id = ANY(%L::uuid[]))', v_real_ids)
                            );
                        ELSIF v_has_unassigned THEN
                            v_where_clauses := array_append(v_where_clauses, 'sales_owner_id IS NULL');
                        ELSIF array_length(v_real_ids, 1) > 0 THEN
                            v_where_clauses := array_append(
                                v_where_clauses,
                                format('sales_owner_id = ANY(%L::uuid[])', v_real_ids)
                            );
                        END IF;
                    ELSE
                        SELECT string_agg(quote_literal(x.val), ', ') INTO v_quoted_vals
                        FROM (SELECT jsonb_array_elements_text(v_filter_vals) AS val) x;

                        IF v_quoted_vals IS NOT NULL AND v_quoted_vals <> '' THEN
                            v_where_clauses := array_append(
                                v_where_clauses,
                                format('%I::text IN (%s)', v_db_col, v_quoted_vals)
                            );
                        END IF;
                    END IF;
                END IF;
            END;
        END LOOP;

        v_where_sql := array_to_string(v_where_clauses, ' AND ');

        -- Execute distinct query for current column with other filters applied
        BEGIN
            v_col_query := format(
                'SELECT ARRAY(
                    SELECT DISTINCT %I::text 
                    FROM public.%I 
                    WHERE %s 
                    ORDER BY %I::text ASC 
                    LIMIT 250
                )',
                v_col, p_table_name, v_where_sql, v_col
            );
            EXECUTE v_col_query INTO v_col_vals;

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

GRANT EXECUTE ON FUNCTION public.get_faceted_filter_options(text, uuid, text[], jsonb, uuid[]) TO authenticated, service_role, anon;
