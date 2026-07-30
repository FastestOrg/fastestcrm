-- Migration to create essential composite indexes on all custom lead tables (e.g. leads_efficacy)
-- to prevent 57014 statement timeouts during pagination, sorting, and filter queries.

DO $$
DECLARE
    tbl_record RECORD;
BEGIN
    -- Loop over all custom lead tables matching 'leads_%' in public schema
    FOR tbl_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name LIKE 'leads_%'
          AND table_name NOT IN ('leads_real_estate', 'leads_history', 'leads_scoring')
    LOOP
        -- 1. Composite index for company_id + created_at DESC + id DESC (Default page sort pattern)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'company_id') AND
           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'created_at') THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id, created_at DESC, id DESC)',
                'idx_' || tbl_record.table_name || '_company_created_at',
                tbl_record.table_name
            );
        END IF;

        -- 2. Index for sales_owner_id (Hierarchy & Owner filtering)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'sales_owner_id') THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON public.%I (sales_owner_id)',
                'idx_' || tbl_record.table_name || '_sales_owner',
                tbl_record.table_name
            );
        END IF;

        -- 3. Index for status (Status filtering)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'status') THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON public.%I (status)',
                'idx_' || tbl_record.table_name || '_status',
                tbl_record.table_name
            );
        END IF;

        -- 4. Index for lead_source (Lead Source filtering)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'lead_source') THEN
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id, lead_source) WHERE lead_source IS NOT NULL',
                'idx_' || tbl_record.table_name || '_lead_source',
                tbl_record.table_name
            );
        END IF;
    END LOOP;
END $$;
