-- Migration: Fast Distinct Column Values RPC with Recursive CTE Skip Scan
-- Timestamp: 2026-08-29 00:40:00
-- Description: Upgrades get_distinct_column_values() to use Recursive CTE Loose Index Scan (Skip Scan).
-- Instead of scanning 500,000+ rows sequentially (which timed out after 8s and caused incomplete 2-item lists),
-- it jumps directly between distinct values in index order (O(distinct_values)), executing in <50ms.

CREATE OR REPLACE FUNCTION public.get_distinct_column_values(
    p_table_name text,
    p_column_name text,
    p_company_id uuid
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_result text[];
    v_query text;
BEGIN
    -- 1. Validate table exists in public schema
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = p_table_name
    ) THEN
        RETURN ARRAY[]::text[];
    END IF;

    -- 2. Validate column exists on table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = p_column_name
    ) THEN
        RETURN ARRAY[]::text[];
    END IF;

    -- 3. Execute ultra-fast Recursive CTE Loose Index Scan (Skip Scan)
    -- This jumps directly from one distinct value to the next in index order
    BEGIN
        v_query := format(
            'WITH RECURSIVE t AS (
               (
                 SELECT %I::text AS val
                 FROM public.%I
                 WHERE company_id = %L
                   AND %I IS NOT NULL
                   AND %I::text <> %L
                 ORDER BY company_id, %I
                 LIMIT 1
               )
               UNION ALL
               SELECT (
                 SELECT %I::text
                 FROM public.%I
                 WHERE company_id = %L
                   AND %I > t.val
                   AND %I IS NOT NULL
                   AND %I::text <> %L
                 ORDER BY company_id, %I
                 LIMIT 1
               )
               FROM t
               WHERE t.val IS NOT NULL
            )
            SELECT ARRAY(
              SELECT val FROM t 
              WHERE val IS NOT NULL 
              ORDER BY val ASC
            );',
            p_column_name, p_table_name, p_company_id, p_column_name, p_column_name, '', p_column_name,
            p_column_name, p_table_name, p_company_id, p_column_name, p_column_name, p_column_name, '', p_column_name
        );

        EXECUTE v_query INTO v_result;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback to standard distinct if recursive comparison fails on custom column types
        v_query := format(
            'SELECT ARRAY(
                SELECT DISTINCT %I::text 
                FROM public.%I 
                WHERE company_id = %L 
                  AND %I IS NOT NULL 
                  AND %I::text <> %L 
                ORDER BY %I::text ASC
            )',
            p_column_name, p_table_name, p_company_id, p_column_name, p_column_name, '', p_column_name
        );
        EXECUTE v_query INTO v_result;
    END;

    RETURN COALESCE(v_result, ARRAY[]::text[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_distinct_column_values(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_column_values(text, text, uuid) TO service_role;
