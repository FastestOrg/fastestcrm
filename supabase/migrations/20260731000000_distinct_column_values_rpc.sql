-- Migration to support fast, uncapped distinct column value fetching for filters across large datasets (e.g. 300k+ leads)
CREATE OR REPLACE FUNCTION public.get_distinct_column_values(
    p_table_name text,
    p_column_name text,
    p_company_id uuid
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_result text[];
    v_query text;
BEGIN
    -- 1. Sanitize input: Check table exists in public schema
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = p_table_name
    ) THEN
        RETURN ARRAY[]::text[];
    END IF;

    -- 2. Sanitize input: Check column exists on table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = p_column_name
    ) THEN
        RETURN ARRAY[]::text[];
    END IF;

    -- 3. Execute distinct query safely using pg format identifier (%I) and literal (%L)
    v_query := format(
        'SELECT ARRAY(
            SELECT DISTINCT %I::text 
            FROM public.%I 
            WHERE company_id = %L 
              AND %I IS NOT NULL 
              AND %I::text <> %L 
            ORDER BY %I::text ASC
        )',
        p_column_name,
        p_table_name,
        p_company_id,
        p_column_name,
        p_column_name,
        '',
        p_column_name
    );

    EXECUTE v_query INTO v_result;
    RETURN COALESCE(v_result, ARRAY[]::text[]);
END;
$$;

-- Grant permissions to authenticated and service_role users
GRANT EXECUTE ON FUNCTION public.get_distinct_column_values(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_column_values(text, text, uuid) TO service_role;

-- Add index to speed up company lead source distinct queries on leads table
CREATE INDEX IF NOT EXISTS idx_leads_company_lead_source ON public.leads(company_id, lead_source) WHERE lead_source IS NOT NULL;
