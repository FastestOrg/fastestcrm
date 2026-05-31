-- 1. Redefine lead update history trigger function to log creation, owner assignments, and status changes with ZERO N+1 profile queries.
CREATE OR REPLACE FUNCTION "public"."handle_lead_update_history"() 
RETURNS trigger AS $$
DECLARE
    history_entry jsonb;
    old_status text;
    new_status text;
    history_array jsonb := '[]'::jsonb;
    actor_id uuid;
BEGIN
    -- Get the authenticated user ID (actor)
    actor_id := auth.uid();

    -- Check if it is INSERT
    IF TG_OP = 'INSERT' THEN
        -- 1. Log Lead Creation
        history_entry := jsonb_build_object(
            'action', 'create',
            'user_id', COALESCE(NEW.created_by_id, actor_id),
            'timestamp', now()
        );
        history_array := history_array || jsonb_build_array(history_entry);

        -- 2. Log Initial Assignments
        -- Check if pre_sales_owner_id is set
        IF NEW.pre_sales_owner_id IS NOT NULL THEN
            history_entry := jsonb_build_object(
                'action', 'assign_pre_sales',
                'assignee_id', NEW.pre_sales_owner_id,
                'user_id', actor_id,
                'timestamp', now()
            );
            history_array := history_array || jsonb_build_array(history_entry);
        END IF;

        -- Check if sales_owner_id is set
        IF NEW.sales_owner_id IS NOT NULL THEN
            history_entry := jsonb_build_object(
                'action', 'assign_sales',
                'assignee_id', NEW.sales_owner_id,
                'user_id', actor_id,
                'timestamp', now()
            );
            history_array := history_array || jsonb_build_array(history_entry);
        END IF;

        -- Check if post_sales_owner_id is set
        IF NEW.post_sales_owner_id IS NOT NULL THEN
            history_entry := jsonb_build_object(
                'action', 'assign_post_sales',
                'assignee_id', NEW.post_sales_owner_id,
                'user_id', actor_id,
                'timestamp', now()
            );
            history_array := history_array || jsonb_build_array(history_entry);
        END IF;

        -- Set the final lead_history on the new record
        -- Combine with any pre-existing history passed during insert
        NEW.lead_history := COALESCE(NEW.lead_history, '[]'::jsonb) || history_array;

    -- Check if it is UPDATE
    ELSIF TG_OP = 'UPDATE' THEN
        -- 1. Status Changes
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            old_status := OLD.status;
            new_status := NEW.status;

            history_entry := jsonb_build_object(
                'action', 'status_change',
                'user_id', actor_id,
                'old_status', old_status,
                'new_status', new_status,
                'timestamp', now()
            );
            history_array := history_array || jsonb_build_array(history_entry);
        END IF;

        -- 2. Owner changes
        -- Pre-Sales Owner Change
        IF NEW.pre_sales_owner_id IS DISTINCT FROM OLD.pre_sales_owner_id THEN
            IF NEW.pre_sales_owner_id IS NOT NULL THEN
                history_entry := jsonb_build_object(
                    'action', 'assign_pre_sales',
                    'assignee_id', NEW.pre_sales_owner_id,
                    'user_id', actor_id,
                    'timestamp', now()
                );
                history_array := history_array || jsonb_build_array(history_entry);
            ELSE
                history_entry := jsonb_build_object(
                    'action', 'unassign_pre_sales',
                    'user_id', actor_id,
                    'timestamp', now()
                );
                history_array := history_array || jsonb_build_array(history_entry);
            END IF;
        END IF;

        -- Sales Owner Change
        IF NEW.sales_owner_id IS DISTINCT FROM OLD.sales_owner_id THEN
            IF NEW.sales_owner_id IS NOT NULL THEN
                history_entry := jsonb_build_object(
                    'action', 'assign_sales',
                    'assignee_id', NEW.sales_owner_id,
                    'user_id', actor_id,
                    'timestamp', now()
                );
                history_array := history_array || jsonb_build_array(history_entry);
            ELSE
                history_entry := jsonb_build_object(
                    'action', 'unassign_sales',
                    'user_id', actor_id,
                    'timestamp', now()
                );
                history_array := history_array || jsonb_build_array(history_entry);
            END IF;
        END IF;

        -- Post-Sales Owner Change
        IF NEW.post_sales_owner_id IS DISTINCT FROM OLD.post_sales_owner_id THEN
            IF NEW.post_sales_owner_id IS NOT NULL THEN
                history_entry := jsonb_build_object(
                    'action', 'assign_post_sales',
                    'assignee_id', NEW.post_sales_owner_id,
                    'user_id', actor_id,
                    'timestamp', now()
                );
                history_array := history_array || jsonb_build_array(history_entry);
            ELSE
                history_entry := jsonb_build_object(
                    'action', 'unassign_post_sales',
                    'user_id', actor_id,
                    'timestamp', now()
                );
                history_array := history_array || jsonb_build_array(history_entry);
            END IF;
        END IF;

        -- Append the new history items to the existing history array
        IF jsonb_array_length(history_array) > 0 THEN
            NEW.lead_history := COALESCE(OLD.lead_history, '[]'::jsonb) || history_array;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create helper function to map legacy user_name strings to profile UUIDs in existing history arrays
CREATE OR REPLACE FUNCTION "public"."backfill_history_uuids"(input_history jsonb)
RETURNS jsonb AS $$
DECLARE
    entry jsonb;
    updated_entry jsonb;
    result_array jsonb := '[]'::jsonb;
    resolved_id uuid;
    u_name text;
    a_name text;
    clean_u_name text;
    clean_a_name text;
BEGIN
    IF input_history IS NULL OR jsonb_typeof(input_history) != 'array' THEN
        RETURN input_history;
    END IF;

    FOR entry IN SELECT * FROM jsonb_array_elements(input_history)
    LOOP
        updated_entry := entry;
        
        -- Resolve main actor user_id if missing but user_name is present
        IF NOT (entry ? 'user_id') AND (entry ? 'user_name') THEN
            u_name := entry->>'user_name';
            IF u_name IS NOT NULL AND u_name != 'System' THEN
                SELECT id INTO resolved_id 
                FROM public.profiles 
                WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(u_name)) 
                LIMIT 1;

                IF resolved_id IS NOT NULL THEN
                    updated_entry := updated_entry || jsonb_build_object('user_id', resolved_id);
                END IF;
            END IF;
        END IF;

        -- Resolve assignee_id if this is an assignment entry and assignee_id is missing
        IF NOT (entry ? 'assignee_id') AND (entry ? 'details' OR entry ? 'text') THEN
            -- Extract assignee name from formats like: "Lead assigned to Jane Doe (Sales Owner)" 
            -- or "John Doe assigned lead to Jane Doe (Pre-Sales Owner)"
            -- Regex matches "assigned (?:lead )?to ([^(\n]+)"
            -- We can try to parse assignee name from the text
            a_name := substring(COALESCE(entry->>'text', entry->>'details') from 'assigned (?:lead )?to ([^(\n]+)');
            IF a_name IS NOT NULL THEN
                clean_a_name := TRIM(a_name);
                -- Strip " (Pre-Sales Owner)" etc. if still attached (regex substring should stop before '(')
                SELECT id INTO resolved_id 
                FROM public.profiles 
                WHERE LOWER(TRIM(full_name)) = LOWER(clean_a_name) 
                LIMIT 1;

                IF resolved_id IS NOT NULL THEN
                    updated_entry := updated_entry || jsonb_build_object('assignee_id', resolved_id);
                END IF;
            END IF;
        END IF;

        result_array := result_array || jsonb_build_array(updated_entry);
    END LOOP;

    RETURN result_array;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Execute the backfill for all existing lead tables
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND (
            table_name = 'leads' 
            OR table_name = 'leads_real_estate'
            OR table_name = 'leads_travel'
            OR table_name = 'leads_healthcare'
            OR table_name = 'leads_saas'
            OR table_name = 'leads_insurance'
            OR table_name LIKE 'leads\_%'
          )
    LOOP
        -- Execute update to backfill UUIDs on historical entries
        EXECUTE format('
            UPDATE public.%I 
            SET lead_history = public.backfill_history_uuids(lead_history) 
            WHERE lead_history IS NOT NULL AND jsonb_array_length(lead_history) > 0
        ', table_record.table_name);
    END LOOP;
END;
$$;

-- 4. Clean up the backfill helper function
DROP FUNCTION IF EXISTS "public"."backfill_history_uuids"(jsonb);

-- 5. Recreate enable_custom_leads_table() to ensure future company tables get optimized trigger
CREATE OR REPLACE FUNCTION public.enable_custom_leads_table(input_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_slug text;
    v_total_licenses int;
    v_new_table_name text;
    v_old_count int;
    v_new_count int;
BEGIN
    -- 1. Get Company Details
    SELECT slug, total_licenses INTO v_company_slug, v_total_licenses
    FROM public.companies
    WHERE id = input_company_id;

    IF v_company_slug IS NULL THEN
        RAISE EXCEPTION 'Company not found';
    END IF;

    -- 2. Verify License Requirement
    IF v_total_licenses < 2 THEN
        RAISE EXCEPTION 'Company does not meet license requirements (Minimum 2)';
    END IF;

    -- 3. Define New Table Name (leads_slug)
    v_new_table_name := 'leads_' || regexp_replace(v_company_slug, '[^a-zA-Z0-9_]', '_', 'g');

    -- Check if table already exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = v_new_table_name
    ) THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Custom table already exists', 
            'table_name', v_new_table_name
        );
    END IF;

    -- 4. Create New Table (Like leads)
    EXECUTE format('CREATE TABLE public.%I (LIKE public.leads INCLUDING ALL)', v_new_table_name);

    -- 5. Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_new_table_name);

    -- 6. Recreate Policies
    EXECUTE format('
        CREATE POLICY "Users can view their own leads and subordinates'' leads" 
        ON public.%I FOR SELECT 
        USING (
            auth.uid() = sales_owner_id 
            OR 
            is_in_hierarchy(auth.uid(), sales_owner_id)
        )', v_new_table_name);

    EXECUTE format('
        CREATE POLICY "Users can create leads" 
        ON public.%I FOR INSERT 
        WITH CHECK (
            auth.uid() = created_by_id
        )', v_new_table_name);

    EXECUTE format('
        CREATE POLICY "Users can update their own leads and subordinates'' leads" 
        ON public.%I FOR UPDATE 
        USING (
            auth.uid() = sales_owner_id 
            OR 
            is_in_hierarchy(auth.uid(), sales_owner_id)
        )', v_new_table_name);

    EXECUTE format('
        CREATE POLICY "Only Super Admin can delete leads" 
        ON public.%I FOR DELETE 
        USING (
            has_role(auth.uid(), ''company''::app_role)
        )', v_new_table_name);

    -- 7. Recreate Triggers
    -- Update Timestamp
    EXECUTE format('
        CREATE TRIGGER update_leads_updated_at 
        BEFORE UPDATE ON public.%I 
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()
    ', v_new_table_name);

    -- Lead Source from Link
    EXECUTE format('
        CREATE TRIGGER set_lead_source_from_link 
        BEFORE INSERT OR UPDATE ON public.%I 
        FOR EACH ROW EXECUTE FUNCTION public.handle_lead_source_from_link()
    ', v_new_table_name);

    -- Lead History Trigger
    EXECUTE format('
        CREATE TRIGGER on_lead_update_history
        BEFORE INSERT OR UPDATE ON public.%I 
        FOR EACH ROW EXECUTE FUNCTION public.handle_lead_update_history()
    ', v_new_table_name);

    -- Add Automation Trigger
    PERFORM public.add_automation_trigger_to_table(v_new_table_name);

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
