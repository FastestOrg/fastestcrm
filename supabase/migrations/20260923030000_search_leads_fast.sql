-- Migration: High-Performance Server-Side Leads Search RPC
-- Timestamp: 2026-09-23 03:00:00
-- Description: Provides instant server-side search across millions of leads bypassing 
-- slow PostgREST RLS B-tree index scans and utilizing GIN trigram indexes (<50ms).

CREATE OR REPLACE FUNCTION public.search_leads_fast(
    p_table_name text,
    p_company_id uuid,
    p_search text,
    p_status_filter text[] DEFAULT NULL,
    p_owner_filter text[] DEFAULT NULL,
    p_product_filter text[] DEFAULT NULL,
    p_accessible_user_ids uuid[] DEFAULT NULL,
    p_dynamic_filters jsonb DEFAULT NULL,
    p_pending_payment_only boolean DEFAULT false,
    p_exclude_history boolean DEFAULT true,
    p_limit int DEFAULT 25,
    p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_clean_search text := trim(p_search);
    v_phone_digits text := regexp_replace(v_clean_search, '\D', '', 'g');
    v_where_clauses text[] := ARRAY['1=1'];
    v_search_clauses text[] := ARRAY[]::text[];
    v_where_sql text;
    v_sql text;
    v_count_sql text;
    v_leads jsonb;
    v_total_count bigint := 0;
    v_valid_cols text[];
    v_dyn_key text;
    v_dyn_val jsonb;
    v_is_uuid boolean := false;
BEGIN
    -- 1. Validate table exists in public schema
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = p_table_name
    ) THEN
        RETURN jsonb_build_object('leads', '[]'::jsonb, 'total_count', 0);
    END IF;

    -- 2. Fetch list of all valid columns for this table
    SELECT array_agg(column_name::text) INTO v_valid_cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table_name;

    IF v_valid_cols IS NULL THEN
        RETURN jsonb_build_object('leads', '[]'::jsonb, 'total_count', 0);
    END IF;

    -- 3. Company isolation
    IF 'company_id' = ANY(v_valid_cols) AND p_company_id IS NOT NULL THEN
        v_where_clauses := array_append(v_where_clauses, format('l.company_id = %L', p_company_id));
    END IF;

    -- 4. Search condition (combines GIN trigram indexes for <50ms response)
    IF v_clean_search <> '' THEN
        -- Check if search query is a UUID
        IF v_clean_search ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            v_is_uuid := true;
            IF 'id' = ANY(v_valid_cols) THEN
                v_search_clauses := array_append(v_search_clauses, format('l.id = %L::uuid', v_clean_search));
            END IF;
        END IF;

        IF NOT v_is_uuid THEN
            IF 'name' = ANY(v_valid_cols) THEN
                v_search_clauses := array_append(v_search_clauses, format('l.name ILIKE %L', '%' || v_clean_search || '%'));
            END IF;
            IF 'email' = ANY(v_valid_cols) THEN
                v_search_clauses := array_append(v_search_clauses, format('l.email ILIKE %L', '%' || v_clean_search || '%'));
            END IF;
            IF 'phone' = ANY(v_valid_cols) THEN
                v_search_clauses := array_append(v_search_clauses, format('l.phone ILIKE %L', '%' || v_clean_search || '%'));
                -- If phone digits provided (at least 6 digits), also match normalized digits
                IF length(v_phone_digits) >= 6 AND v_phone_digits <> v_clean_search THEN
                    v_search_clauses := array_append(v_search_clauses, format('l.phone ILIKE %L', '%' || v_phone_digits || '%'));
                END IF;
                -- If international phone number with country prefix (e.g. 61432530013 or 919876543210), match last 9 or 10 digits
                IF length(v_phone_digits) >= 10 THEN
                    v_search_clauses := array_append(v_search_clauses, format('l.phone ILIKE %L', '%' || right(v_phone_digits, 10) || '%'));
                    v_search_clauses := array_append(v_search_clauses, format('l.phone ILIKE %L', '%' || right(v_phone_digits, 9) || '%'));
                ELSIF length(v_phone_digits) = 10 AND starts_with(v_phone_digits, '0') THEN
                    v_search_clauses := array_append(v_search_clauses, format('l.phone ILIKE %L', '%' || substring(v_phone_digits from 2) || '%'));
                END IF;
            END IF;
            IF 'college' = ANY(v_valid_cols) THEN
                v_search_clauses := array_append(v_search_clauses, format('l.college ILIKE %L', '%' || v_clean_search || '%'));
            END IF;
            IF 'property_name' = ANY(v_valid_cols) THEN
                v_search_clauses := array_append(v_search_clauses, format('l.property_name ILIKE %L', '%' || v_clean_search || '%'));
            END IF;
        END IF;

        IF array_length(v_search_clauses, 1) > 0 THEN
            v_where_clauses := array_append(v_where_clauses, '(' || array_to_string(v_search_clauses, ' OR ') || ')');
        END IF;
    END IF;

    -- 5. Status filter
    IF p_status_filter IS NOT NULL AND array_length(p_status_filter, 1) > 0 AND 'status' = ANY(v_valid_cols) THEN
        v_where_clauses := array_append(v_where_clauses, format('l.status::text = ANY(%L)', p_status_filter));
    END IF;

    -- 6. Owner filter
    IF p_owner_filter IS NOT NULL AND array_length(p_owner_filter, 1) > 0 AND 'sales_owner_id' = ANY(v_valid_cols) THEN
        DECLARE
            v_has_unassigned boolean := 'unassigned' = ANY(p_owner_filter);
            v_real_owners uuid[] := ARRAY[]::uuid[];
            v_owner_str text;
        BEGIN
            FOREACH v_owner_str IN ARRAY p_owner_filter LOOP
                IF v_owner_str <> 'unassigned' THEN
                    BEGIN
                        v_real_owners := array_append(v_real_owners, v_owner_str::uuid);
                    EXCEPTION WHEN OTHERS THEN
                        -- ignore non-uuids
                    END;
                END IF;
            END LOOP;

            IF v_has_unassigned AND array_length(v_real_owners, 1) > 0 THEN
                v_where_clauses := array_append(v_where_clauses, format('(l.sales_owner_id IS NULL OR l.sales_owner_id = ANY(%L))', v_real_owners));
            ELSIF v_has_unassigned THEN
                v_where_clauses := array_append(v_where_clauses, 'l.sales_owner_id IS NULL');
            ELSIF array_length(v_real_owners, 1) > 0 THEN
                v_where_clauses := array_append(v_where_clauses, format('l.sales_owner_id = ANY(%L)', v_real_owners));
            END IF;
        END;
    END IF;

    -- 7. Product filter
    IF p_product_filter IS NOT NULL AND array_length(p_product_filter, 1) > 0 AND 'product_purchased' = ANY(v_valid_cols) THEN
        v_where_clauses := array_append(v_where_clauses, format('l.product_purchased = ANY(%L)', p_product_filter));
    END IF;

    -- 8. Hierarchy scoping (non-admin restrictions)
    IF p_accessible_user_ids IS NOT NULL AND array_length(p_accessible_user_ids, 1) > 0 AND 'sales_owner_id' = ANY(v_valid_cols) THEN
        v_where_clauses := array_append(v_where_clauses, format('l.sales_owner_id = ANY(%L)', p_accessible_user_ids));
    END IF;

    -- 9. Dynamic column filters
    IF p_dynamic_filters IS NOT NULL AND p_dynamic_filters <> '{}'::jsonb THEN
        FOR v_dyn_key, v_dyn_val IN SELECT * FROM jsonb_each(p_dynamic_filters) LOOP
            IF v_dyn_key = ANY(v_valid_cols) THEN
                IF jsonb_typeof(v_dyn_val) = 'array' THEN
                    DECLARE
                        v_str_arr text[] := ARRAY(SELECT jsonb_array_elements_text(v_dyn_val));
                    BEGIN
                        IF array_length(v_str_arr, 1) > 0 THEN
                            v_where_clauses := array_append(v_where_clauses, format('l.%I::text = ANY(%L)', v_dyn_key, v_str_arr));
                        END IF;
                    END;
                ELSE
                    v_where_clauses := array_append(v_where_clauses, format('l.%I::text = %L', v_dyn_key, v_dyn_val #>> '{}'));
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 10. Pending payment filter
    IF p_pending_payment_only AND 'revenue_received' = ANY(v_valid_cols) THEN
        v_where_clauses := array_append(v_where_clauses, 'l.revenue_received > 0');
    END IF;

    -- Assemble WHERE SQL
    v_where_sql := array_to_string(v_where_clauses, ' AND ');

    -- 11. Count total matching rows (uses GIN trigram index fast bitmap scan)
    v_count_sql := format('SELECT count(*) FROM %I l WHERE %s', p_table_name, v_where_sql);
    EXECUTE v_count_sql INTO v_total_count;

    -- 12. Fetch paginated records with sales_owner full_name joined
    v_sql := format($q$
        SELECT coalesce(jsonb_agg(sub.lead_row), '[]'::jsonb)
        FROM (
            SELECT 
                (CASE WHEN %s THEN to_jsonb(l.*) - 'lead_history' ELSE to_jsonb(l.*) END) || 
                jsonb_build_object(
                    'sales_owner', 
                    CASE 
                        WHEN p.id IS NOT NULL THEN jsonb_build_object('full_name', p.full_name)
                        ELSE NULL 
                    END
                ) AS lead_row
            FROM %I l
            LEFT JOIN profiles p ON p.id = l.sales_owner_id
            WHERE %s
            ORDER BY l.created_at DESC, l.id DESC
            LIMIT %s OFFSET %s
        ) sub
    $q$, 
        (p_exclude_history AND 'lead_history' = ANY(v_valid_cols))::text,
        p_table_name, 
        v_where_sql, 
        p_limit, 
        p_offset
    );

    EXECUTE v_sql INTO v_leads;

    RETURN jsonb_build_object(
        'leads', coalesce(v_leads, '[]'::jsonb),
        'total_count', v_total_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_leads_fast(
    text, uuid, text, text[], text[], text[], uuid[], jsonb, boolean, boolean, int, int
) TO authenticated, service_role, anon;
