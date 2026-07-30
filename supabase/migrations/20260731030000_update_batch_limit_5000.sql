-- Migration: Update default batch_limit to 5000 in merge_duplicate_leads

CREATE OR REPLACE FUNCTION public.merge_duplicate_leads(
  input_company_id uuid,
  batch_limit int DEFAULT 5000
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
  v_effective_limit int := COALESCE(batch_limit, 5000);
  v_has_more boolean := false;
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

  -- Merge for each constraint up to effective limit
  FOREACH v_constraint IN ARRAY v_unique_constraints
  LOOP
    IF v_total_merged >= v_effective_limit THEN
      v_has_more := true;
      EXIT;
    END IF;

    FOR v_dup_record IN EXECUTE format('
      SELECT %I as value, array_agg(id ORDER BY created_at DESC, id DESC) as ids
      FROM %I
      WHERE %I IS NOT NULL AND %I != '''' AND company_id = %L
      GROUP BY %I
      HAVING count(*) > 1
      LIMIT %L
    ', v_constraint, v_table_name, v_constraint, v_constraint, input_company_id, v_constraint, v_effective_limit - v_total_merged)
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

      IF v_total_merged >= v_effective_limit THEN
        v_has_more := true;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'message', format('Merged %s duplicate groups, removed %s duplicate records', v_total_merged, v_total_deleted),
    'merged_groups', v_total_merged,
    'deleted_records', v_total_deleted,
    'has_more', v_has_more
  );
END;
$$;
