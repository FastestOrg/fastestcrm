-- Migration: Fix Leads RLS CPU 99% Bottleneck and Add Supporting Composite Indexes
-- Timestamp: 2026-08-28 13:55:00
-- Description:
-- 1. Creates cycle-protected, set-based get_subordinate_user_ids() helper function
-- 2. Dynamically updates RLS SELECT & UPDATE policies on `leads` and all `leads_%` tables
--    to eliminate per-row PL/pgSQL function evaluations (is_in_hierarchy)
-- 3. Adds high-performance composite B-Tree indexes for leads_efficacy query patterns
-- 4. Updates enable_custom_leads_table() so future custom tables inherit optimized policies

-- ============================================================================
-- 1. FAST SET-BASED SUBORDINATE ID RESOLVER (EVALUATED ONCE PER QUERY)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_subordinate_user_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE subordinates AS (
    -- Root user
    SELECT id, 1 AS depth 
    FROM public.profiles 
    WHERE id = p_user_id
    UNION
    -- Subordinates with depth limiter to prevent infinite loops on data cycles
    SELECT p.id, s.depth + 1 
    FROM public.profiles p
    INNER JOIN subordinates s ON p.manager_id = s.id
    WHERE s.depth < 20
  )
  SELECT id FROM subordinates;
$$;

-- Grant execution
GRANT EXECUTE ON FUNCTION public.get_subordinate_user_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subordinate_user_ids(uuid) TO service_role;

-- ============================================================================
-- 2. DYNAMICALLY APPLY OPTIMIZED RLS POLICIES (ALL LEAD TABLES)
-- ============================================================================

DO $$
DECLARE
    tbl_record RECORD;
    v_has_pre_sales BOOLEAN;
    v_has_post_sales BOOLEAN;
    v_has_sales BOOLEAN;
    v_has_created_by BOOLEAN;
    v_has_company_id BOOLEAN;
    v_owner_condition TEXT;
    v_policy_condition TEXT;
BEGIN
    FOR tbl_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND (table_name = 'leads' OR table_name LIKE 'leads_%')
          AND table_name NOT IN ('leads_history', 'leads_scoring')
    LOOP
        -- Check column existence on the specific table
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'pre_sales_owner_id'
        ) INTO v_has_pre_sales;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'post_sales_owner_id'
        ) INTO v_has_post_sales;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'sales_owner_id'
        ) INTO v_has_sales;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'created_by_id'
        ) INTO v_has_created_by;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = tbl_record.table_name AND column_name = 'company_id'
        ) INTO v_has_company_id;

        -- Build owner conditions based on actual columns present
        v_owner_condition := 'FALSE';
        IF v_has_sales THEN
            v_owner_condition := v_owner_condition || ' OR (sales_owner_id IN (SELECT get_subordinate_user_ids((SELECT auth.uid()))))';
        END IF;
        IF v_has_pre_sales THEN
            v_owner_condition := v_owner_condition || ' OR (pre_sales_owner_id IN (SELECT get_subordinate_user_ids((SELECT auth.uid()))))';
        END IF;
        IF v_has_post_sales THEN
            v_owner_condition := v_owner_condition || ' OR (post_sales_owner_id IN (SELECT get_subordinate_user_ids((SELECT auth.uid()))))';
        END IF;
        IF v_has_created_by THEN
            v_owner_condition := v_owner_condition || ' OR (created_by_id = (SELECT auth.uid()))';
        END IF;

        -- Build composite policy condition
        IF v_has_company_id THEN
            v_policy_condition := format('
                (SELECT is_platform_admin((SELECT auth.uid()))) OR
                (
                    company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid())) AND (
                        (SELECT has_role((SELECT auth.uid()), ''company''::app_role)) OR
                        (SELECT has_role((SELECT auth.uid()), ''company_subadmin''::app_role)) OR
                        %s
                    )
                )', v_owner_condition);
        ELSE
            v_policy_condition := format('
                (SELECT is_platform_admin((SELECT auth.uid()))) OR
                (SELECT has_role((SELECT auth.uid()), ''company''::app_role)) OR
                (SELECT has_role((SELECT auth.uid()), ''company_subadmin''::app_role)) OR
                %s', v_owner_condition);
        END IF;

        -- Drop existing policies
        EXECUTE format('DROP POLICY IF EXISTS "Users can view their own leads and subordinates'' leads" ON public.%I', tbl_record.table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can view leads" ON public.%I', tbl_record.table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can view leads efficacy" ON public.%I', tbl_record.table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can view saas leads" ON public.%I', tbl_record.table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can view real estate leads" ON public.%I', tbl_record.table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can view leads fast" ON public.%I', tbl_record.table_name);

        -- Create SELECT policy
        EXECUTE format('
            CREATE POLICY "Users can view leads fast" ON public.%I
            FOR SELECT USING (%s)', tbl_record.table_name, v_policy_condition);

        -- Drop existing update policies
        EXECUTE format('DROP POLICY IF EXISTS "Users can update their own leads and subordinates'' leads" ON public.%I', tbl_record.table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can update leads" ON public.%I', tbl_record.table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can update leads efficacy" ON public.%I', tbl_record.table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can update saas leads" ON public.%I', tbl_record.table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can update real estate leads" ON public.%I', tbl_record.table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can update leads fast" ON public.%I', tbl_record.table_name);

        -- Create UPDATE policy
        EXECUTE format('
            CREATE POLICY "Users can update leads fast" ON public.%I
            FOR UPDATE USING (%s)', tbl_record.table_name, v_policy_condition);

    END LOOP;
END $$;

-- ============================================================================
-- 3. TARGET COMPOSITE INDEXES FOR leads_efficacy
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_leads_efficacy_company_created_id 
ON public.leads_efficacy (company_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_leads_efficacy_company_status_created 
ON public.leads_efficacy (company_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_leads_efficacy_company_owner_created 
ON public.leads_efficacy (company_id, sales_owner_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_leads_efficacy_company_source_created 
ON public.leads_efficacy (company_id, lead_source, created_at DESC, id DESC) 
WHERE lead_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_efficacy_company_country_created 
ON public.leads_efficacy (company_id, country, created_at DESC, id DESC) 
WHERE country IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_efficacy_company_reminder_null 
ON public.leads_efficacy (company_id, created_at DESC, id DESC) 
WHERE reminder_at IS NULL;

-- ============================================================================
-- 4. UPDATE enable_custom_leads_table() TEMPLATE FOR FUTURE CUSTOM TABLES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enable_custom_leads_table(input_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_slug text;
    v_new_table_name text;
    v_old_count int;
    v_new_count int;
BEGIN
    -- 1. Get Company Details
    SELECT slug INTO v_company_slug
    FROM public.companies
    WHERE id = input_company_id;

    IF v_company_slug IS NULL THEN
        RAISE EXCEPTION 'Company not found';
    END IF;

    -- 2. Define New Table Name (leads_slug)
    v_new_table_name := 'leads_' || regexp_replace(v_company_slug, '[^a-zA-Z0-9_]', '_', 'g');

    -- Check if table already exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = v_new_table_name
    ) THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Custom table already exists', 
            'table_name', v_new_table_name
        );
    END IF;

    -- 3. Create New Table (Like leads)
    EXECUTE format('CREATE TABLE public.%I (LIKE public.leads INCLUDING ALL)', v_new_table_name);

    -- 4. Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_new_table_name);

    -- 5. Recreate High-Performance Policies
    EXECUTE format('
        CREATE POLICY "Users can view leads fast" 
        ON public.%I FOR SELECT 
        USING (
            (SELECT is_platform_admin((SELECT auth.uid()))) OR
            (
                is_same_company((SELECT auth.uid()), company_id) AND (
                    (SELECT has_role((SELECT auth.uid()), ''company''::app_role)) OR
                    (SELECT has_role((SELECT auth.uid()), ''company_subadmin''::app_role)) OR
                    (sales_owner_id IN (SELECT get_subordinate_user_ids((SELECT auth.uid())))) OR
                    (pre_sales_owner_id IN (SELECT get_subordinate_user_ids((SELECT auth.uid())))) OR
                    (post_sales_owner_id IN (SELECT get_subordinate_user_ids((SELECT auth.uid())))) OR
                    (created_by_id = (SELECT auth.uid()))
                )
            )
        )', v_new_table_name);

    EXECUTE format('
        CREATE POLICY "Users can create leads" 
        ON public.%I FOR INSERT 
        WITH CHECK (
            (created_by_id = (SELECT auth.uid())) AND is_same_company((SELECT auth.uid()), company_id)
        )', v_new_table_name);

    EXECUTE format('
        CREATE POLICY "Users can update leads fast" 
        ON public.%I FOR UPDATE 
        USING (
            (SELECT is_platform_admin((SELECT auth.uid()))) OR
            (
                is_same_company((SELECT auth.uid()), company_id) AND (
                    (SELECT has_role((SELECT auth.uid()), ''company''::app_role)) OR
                    (SELECT has_role((SELECT auth.uid()), ''company_subadmin''::app_role)) OR
                    (sales_owner_id IN (SELECT get_subordinate_user_ids((SELECT auth.uid())))) OR
                    (pre_sales_owner_id IN (SELECT get_subordinate_user_ids((SELECT auth.uid())))) OR
                    (post_sales_owner_id IN (SELECT get_subordinate_user_ids((SELECT auth.uid())))) OR
                    (created_by_id = (SELECT auth.uid()))
                )
            )
        )', v_new_table_name);

    EXECUTE format('
        CREATE POLICY "Only Super Admin can delete leads" 
        ON public.%I FOR DELETE 
        USING (
            has_role((SELECT auth.uid()), ''company''::app_role) AND is_same_company((SELECT auth.uid()), company_id)
        )', v_new_table_name);

    -- 6. Add Essential Composite Indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id, created_at DESC, id DESC)',
        'idx_' || v_new_table_name || '_company_created_id', v_new_table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id, status, created_at DESC, id DESC)',
        'idx_' || v_new_table_name || '_company_status_created', v_new_table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id, sales_owner_id, created_at DESC, id DESC)',
        'idx_' || v_new_table_name || '_company_owner_created', v_new_table_name);

    -- 7. Recreate Triggers
    EXECUTE format('
        CREATE TRIGGER update_leads_updated_at 
        BEFORE UPDATE ON public.%I 
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()
    ', v_new_table_name);

    EXECUTE format('
        CREATE TRIGGER set_lead_source_from_link 
        BEFORE INSERT OR UPDATE ON public.%I 
        FOR EACH ROW EXECUTE FUNCTION public.handle_lead_source_from_link()
    ', v_new_table_name);

    -- 8. Migrate Data
    EXECUTE format('
        INSERT INTO public.%I 
        SELECT * FROM public.leads 
        WHERE company_id = %L
    ', v_new_table_name, input_company_id);

    GET DIAGNOSTICS v_new_count = ROW_COUNT;

    -- 9. Delete Old Data
    DELETE FROM public.leads WHERE company_id = input_company_id;
    GET DIAGNOSTICS v_old_count = ROW_COUNT;

    -- 10. Update Company Record
    UPDATE public.companies 
    SET custom_leads_table = v_new_table_name 
    WHERE id = input_company_id;

    RETURN jsonb_build_object(
        'success', true,
        'table_name', v_new_table_name,
        'leads_migrated', v_new_count,
        'leads_deleted_from_main', v_old_count
    );
END;
$$;
