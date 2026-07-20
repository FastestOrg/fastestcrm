-- ============================================================================
-- Universal Smart Merge for ALL Lead Tables
-- ============================================================================
-- Extends the existing smart_merge infrastructure (from 20260114000002)
-- to work on ALL lead tables, not just custom ones.
-- Uses dynamic column discovery so it doesn't break when schema evolves.
-- ============================================================================

-- 1. Improved smart_merge_lead_trigger that uses dynamic column discovery
CREATE OR REPLACE FUNCTION public.smart_merge_lead_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_unique_constraints text[];
  v_constraint text;
  v_existing_record jsonb;
  v_new_record jsonb;
  v_merged_record jsonb;
  v_sql text;
  v_pk_value uuid;
  v_update_cols text;
BEGIN
  v_company_id := NEW.company_id;
  
  IF v_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get active constraints for this company
  SELECT unique_constraints INTO v_unique_constraints
  FROM public.companies
  WHERE id = v_company_id;

  IF v_unique_constraints IS NULL OR array_length(v_unique_constraints, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_record := to_jsonb(NEW);

  -- Check each constraint
  FOREACH v_constraint IN ARRAY v_unique_constraints
  LOOP
    -- Skip if the new record doesn't have a value for this constraint
    IF v_new_record->>v_constraint IS NULL OR v_new_record->>v_constraint = '' THEN
      CONTINUE;
    END IF;

    -- Check for existing record with the same value in the same company
    v_sql := format(
      'SELECT to_jsonb(t) FROM %I t WHERE %I = %L AND company_id = %L LIMIT 1',
      TG_TABLE_NAME, v_constraint, v_new_record->>v_constraint, v_company_id
    );
    
    EXECUTE v_sql INTO v_existing_record;

    IF v_existing_record IS NOT NULL THEN
      -- MERGE: Old || strip_nulls(New) => newer non-null values win
      v_merged_record := v_existing_record || jsonb_strip_nulls(v_new_record);
      
      -- Force timestamps
      v_merged_record := v_merged_record || jsonb_build_object('updated_at', NOW());
      
      v_pk_value := (v_existing_record->>'id')::uuid;
      v_merged_record := v_merged_record - 'id';

      -- Build dynamic UPDATE using actual table columns (excluding 'id')
      SELECT string_agg(
        format('%I = (%L::jsonb->>%L)::%s', 
          column_name, 
          v_merged_record::text, 
          column_name,
          CASE 
            WHEN udt_name = 'uuid' THEN 'uuid'
            WHEN udt_name = 'timestamptz' OR udt_name = 'timestamp' THEN 'timestamptz'
            WHEN udt_name = 'bool' THEN 'boolean'
            WHEN udt_name = 'int4' THEN 'integer'
            WHEN udt_name = 'int8' THEN 'bigint'
            WHEN udt_name = 'float8' THEN 'double precision'
            WHEN udt_name = 'numeric' THEN 'numeric'
            WHEN udt_name = 'jsonb' THEN 'jsonb'
            WHEN udt_name = 'json' THEN 'json'
            WHEN udt_name = '_text' THEN 'text[]'
            WHEN udt_name = 'vector' THEN 'vector'
            WHEN udt_name = 'date' THEN 'date'
            ELSE 'text'
          END
        ), ', '
      ) INTO v_update_cols
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = TG_TABLE_NAME
        AND column_name != 'id';

      IF v_update_cols IS NOT NULL THEN
        v_sql := format('UPDATE %I SET %s WHERE id = %L', TG_TABLE_NAME, v_update_cols, v_pk_value);
        EXECUTE v_sql;
      END IF;
       
      RETURN NULL; -- Cancel the INSERT because we updated existing
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 2. Improved deduplicate_leads that uses dynamic column discovery
CREATE OR REPLACE FUNCTION public.deduplicate_leads(
  input_table_name text,
  attribute_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dup_record RECORD;
  v_merged_json jsonb;
  v_newest_id uuid;
  v_update_cols text;
  v_total_merged int := 0;
  v_total_deleted int := 0;
BEGIN
  -- Build the dynamic column update SQL from information_schema
  SELECT string_agg(
    format('%I = (%s::jsonb->>%L)::%s',
      column_name,
      '$1',  -- placeholder for the merged jsonb
      column_name,
      CASE 
        WHEN udt_name = 'uuid' THEN 'uuid'
        WHEN udt_name = 'timestamptz' OR udt_name = 'timestamp' THEN 'timestamptz'
        WHEN udt_name = 'bool' THEN 'boolean'
        WHEN udt_name = 'int4' THEN 'integer'
        WHEN udt_name = 'int8' THEN 'bigint'
        WHEN udt_name = 'float8' THEN 'double precision'
        WHEN udt_name = 'numeric' THEN 'numeric'
        WHEN udt_name = 'jsonb' THEN 'jsonb'
        WHEN udt_name = 'json' THEN 'json'
        WHEN udt_name = '_text' THEN 'text[]'
        WHEN udt_name = 'vector' THEN 'vector'
        WHEN udt_name = 'date' THEN 'date'
        ELSE 'text'
      END
    ), ', '
  ) INTO v_update_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = input_table_name
    AND column_name != 'id';

  IF v_update_cols IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Table not found or has no columns');
  END IF;

  -- Loop through groups having duplicates
  FOR v_dup_record IN EXECUTE format('
    SELECT %I as value, array_agg(id ORDER BY created_at DESC, id DESC) as ids
    FROM %I
    WHERE %I IS NOT NULL AND %I != ''''
    GROUP BY %I
    HAVING count(*) > 1
  ', attribute_name, input_table_name, attribute_name, attribute_name, attribute_name)
  LOOP
    v_newest_id := v_dup_record.ids[1];
    v_merged_json := '{}'::jsonb;
    
    DECLARE
       v_row_json jsonb;
       v_id uuid;
    BEGIN
       -- Iterate oldest first, so newest data wins
       FOR i IN REVERSE array_length(v_dup_record.ids, 1)..1 LOOP
          v_id := v_dup_record.ids[i];
          EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE id = %L', input_table_name, v_id) INTO v_row_json;
          v_merged_json := v_merged_json || jsonb_strip_nulls(v_row_json);
       END LOOP;
    END;

    v_merged_json := v_merged_json - 'id';
    v_merged_json := v_merged_json || jsonb_build_object('updated_at', NOW());

    -- Dynamic UPDATE using the pre-built column set
    EXECUTE format(
      'UPDATE %I SET %s WHERE id = %L',
      input_table_name,
      replace(v_update_cols, '$1', quote_literal(v_merged_json::text)),
      v_newest_id
    );

    -- Delete the others
    EXECUTE format('DELETE FROM %I WHERE id = ANY(%L::uuid[]) AND id != %L', input_table_name, v_dup_record.ids, v_newest_id);
    
    v_total_merged := v_total_merged + 1;
    v_total_deleted := v_total_deleted + (array_length(v_dup_record.ids, 1) - 1);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'message', format('Merged %s duplicate groups, deleted %s duplicate records', v_total_merged, v_total_deleted),
    'merged_groups', v_total_merged,
    'deleted_records', v_total_deleted
  );
END;
$$;

-- 3. Update toggle_lead_unique_constraint to work on ALL table types
--    (custom, industry-specific, and default 'leads')
CREATE OR REPLACE FUNCTION public.toggle_lead_unique_constraint(
  input_company_id uuid,
  attribute_name text,
  is_unique boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_name text;
  v_constraint_name text;
  v_current_constraints text[];
  v_industry text;
BEGIN
  -- Auth Check
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = input_company_id AND admin_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  IF attribute_name NOT IN ('email', 'phone') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid attribute: Must be email or phone');
  END IF;

  -- Resolve table name: custom > industry > default
  SELECT custom_leads_table, unique_constraints, industry 
  INTO v_table_name, v_current_constraints, v_industry
  FROM public.companies WHERE id = input_company_id;

  IF v_table_name IS NULL THEN
    -- No custom table, check industry
    IF v_industry = 'real_estate' THEN v_table_name := 'leads_real_estate';
    ELSIF v_industry = 'saas' THEN v_table_name := 'leads_saas';
    ELSIF v_industry = 'healthcare' THEN v_table_name := 'leads_healthcare';
    ELSIF v_industry = 'insurance' THEN v_table_name := 'leads_insurance';
    ELSIF v_industry = 'travel' THEN v_table_name := 'leads_travel';
    ELSE v_table_name := 'leads';
    END IF;
  END IF;

  v_constraint_name := v_table_name || '_unique_' || attribute_name || '_' || input_company_id;

  IF is_unique THEN
    -- 1. Deduplicate first (scoped to this company)
    -- We need a company-scoped dedup, so let's handle it inline
    DECLARE
      v_dup_record RECORD;
      v_merged_json jsonb;
      v_newest_id uuid;
    BEGIN
      FOR v_dup_record IN EXECUTE format('
        SELECT %I as value, array_agg(id ORDER BY created_at DESC, id DESC) as ids
        FROM %I
        WHERE %I IS NOT NULL AND %I != '''' AND company_id = %L
        GROUP BY %I
        HAVING count(*) > 1
      ', attribute_name, v_table_name, attribute_name, attribute_name, input_company_id, attribute_name)
      LOOP
        v_newest_id := v_dup_record.ids[1];
        v_merged_json := '{}'::jsonb;
        
        DECLARE
           v_row_json jsonb;
           v_id uuid;
        BEGIN
           FOR i IN REVERSE array_length(v_dup_record.ids, 1)..1 LOOP
              v_id := v_dup_record.ids[i];
              EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE id = %L', v_table_name, v_id) INTO v_row_json;
              v_merged_json := v_merged_json || jsonb_strip_nulls(v_row_json);
           END LOOP;
        END;

        v_merged_json := v_merged_json - 'id';
        v_merged_json := v_merged_json || jsonb_build_object('updated_at', NOW());

        -- Simple key-value update for the merged record
        DECLARE
          v_key text;
          v_val text;
          v_set_parts text[] := '{}';
        BEGIN
          FOR v_key, v_val IN SELECT key, value FROM jsonb_each_text(v_merged_json)
          LOOP
            -- Skip complex types that need special handling
            IF v_key NOT IN ('embedding') THEN
              v_set_parts := array_append(v_set_parts, format('%I = %L', v_key, v_val));
            END IF;
          END LOOP;
          IF array_length(v_set_parts, 1) > 0 THEN
            EXECUTE format('UPDATE %I SET %s WHERE id = %L', v_table_name, array_to_string(v_set_parts, ', '), v_newest_id);
          END IF;
        END;

        EXECUTE format('DELETE FROM %I WHERE id = ANY(%L::uuid[]) AND id != %L', v_table_name, v_dup_record.ids, v_newest_id);
      END LOOP;
    END;
    
    -- 2. Update companies active constraints
    UPDATE public.companies 
    SET unique_constraints = array_append(
      array_remove(COALESCE(unique_constraints, '{}'), attribute_name), 
      attribute_name
    )
    WHERE id = input_company_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Unique identifier enabled and existing duplicates merged');
  ELSE
    -- Remove from company constraints
    UPDATE public.companies 
    SET unique_constraints = array_remove(unique_constraints, attribute_name)
    WHERE id = input_company_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Unique identifier removed');
  END IF;
END;
$$;

-- 4. Create a company-scoped merge RPC that can be called from the UI
CREATE OR REPLACE FUNCTION public.merge_duplicate_leads(
  input_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_name text;
  v_unique_constraints text[];
  v_industry text;
  v_constraint text;
  v_total_merged int := 0;
  v_total_deleted int := 0;
  v_dup_record RECORD;
  v_merged_json jsonb;
  v_newest_id uuid;
BEGIN
  -- Auth Check
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = input_company_id AND admin_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Only Company Admin can merge leads');
  END IF;

  -- Get constraints and table info
  SELECT custom_leads_table, unique_constraints, industry 
  INTO v_table_name, v_unique_constraints, v_industry
  FROM public.companies WHERE id = input_company_id;

  IF v_unique_constraints IS NULL OR array_length(v_unique_constraints, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No unique identifier configured. Please set a unique identifier (Phone or Email) first.');
  END IF;

  -- Resolve table name
  IF v_table_name IS NULL THEN
    IF v_industry = 'real_estate' THEN v_table_name := 'leads_real_estate';
    ELSIF v_industry = 'saas' THEN v_table_name := 'leads_saas';
    ELSIF v_industry = 'healthcare' THEN v_table_name := 'leads_healthcare';
    ELSIF v_industry = 'insurance' THEN v_table_name := 'leads_insurance';
    ELSIF v_industry = 'travel' THEN v_table_name := 'leads_travel';
    ELSE v_table_name := 'leads';
    END IF;
  END IF;

  -- Merge for each constraint
  FOREACH v_constraint IN ARRAY v_unique_constraints
  LOOP
    FOR v_dup_record IN EXECUTE format('
      SELECT %I as value, array_agg(id ORDER BY created_at DESC, id DESC) as ids
      FROM %I
      WHERE %I IS NOT NULL AND %I != '''' AND company_id = %L
      GROUP BY %I
      HAVING count(*) > 1
    ', v_constraint, v_table_name, v_constraint, v_constraint, input_company_id, v_constraint)
    LOOP
      v_newest_id := v_dup_record.ids[1];
      v_merged_json := '{}'::jsonb;
      
      DECLARE
         v_row_json jsonb;
         v_id uuid;
      BEGIN
         FOR i IN REVERSE array_length(v_dup_record.ids, 1)..1 LOOP
            v_id := v_dup_record.ids[i];
            EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE id = %L', v_table_name, v_id) INTO v_row_json;
            v_merged_json := v_merged_json || jsonb_strip_nulls(v_row_json);
         END LOOP;
      END;

      v_merged_json := v_merged_json - 'id';
      v_merged_json := v_merged_json || jsonb_build_object('updated_at', NOW());

      -- Build SET clause from merged json
      DECLARE
        v_key text;
        v_val text;
        v_set_parts text[] := '{}';
      BEGIN
        FOR v_key, v_val IN SELECT key, value FROM jsonb_each_text(v_merged_json)
        LOOP
          IF v_key NOT IN ('embedding') THEN
            v_set_parts := array_append(v_set_parts, format('%I = %L', v_key, v_val));
          END IF;
        END LOOP;
        IF array_length(v_set_parts, 1) > 0 THEN
          EXECUTE format('UPDATE %I SET %s WHERE id = %L', v_table_name, array_to_string(v_set_parts, ', '), v_newest_id);
        END IF;
      END;

      EXECUTE format('DELETE FROM %I WHERE id = ANY(%L::uuid[]) AND id != %L', v_table_name, v_dup_record.ids, v_newest_id);
      
      v_total_merged := v_total_merged + 1;
      v_total_deleted := v_total_deleted + (array_length(v_dup_record.ids, 1) - 1);
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'message', format('Merged %s duplicate groups, removed %s duplicate records', v_total_merged, v_total_deleted),
    'merged_groups', v_total_merged,
    'deleted_records', v_total_deleted
  );
END;
$$;

-- 5. Attach the smart merge trigger to the default 'leads' table
DO $$
BEGIN
  -- Drop if exists first to avoid errors
  DROP TRIGGER IF EXISTS tr_smart_merge_leads ON public.leads;
  CREATE TRIGGER tr_smart_merge_leads 
    BEFORE INSERT ON public.leads 
    FOR EACH ROW EXECUTE FUNCTION public.smart_merge_lead_trigger();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not attach trigger to leads: %', SQLERRM;
END;
$$;

-- 6. Attach to industry-specific tables (if they exist)
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['leads_real_estate', 'leads_saas', 'leads_healthcare', 'leads_insurance', 'leads_travel']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_table) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS tr_smart_merge_leads ON public.%I', v_table);
      EXECUTE format('CREATE TRIGGER tr_smart_merge_leads BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.smart_merge_lead_trigger()', v_table);
      RAISE NOTICE 'Attached smart merge trigger to %', v_table;
    END IF;
  END LOOP;
END;
$$;
