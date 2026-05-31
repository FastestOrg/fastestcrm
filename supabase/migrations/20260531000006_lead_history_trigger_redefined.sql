-- 1. Redefine lead update history trigger function to log creation, owner assignments, and status changes.
CREATE OR REPLACE FUNCTION "public"."handle_lead_update_history"() 
RETURNS trigger AS $$
DECLARE
    user_name text;
    history_entry jsonb;
    old_status text;
    new_status text;
    creator_name text;
    assignee_name text;
    history_array jsonb := '[]'::jsonb;
BEGIN
    -- Get the name of the user making the change (authenticated user)
    SELECT full_name INTO user_name 
    FROM public.profiles 
    WHERE id = auth.uid();

    IF user_name IS NULL THEN
        user_name := 'System';
    END IF;

    -- Check if it is INSERT
    IF TG_OP = 'INSERT' THEN
        -- 1. Log Lead Creation
        IF NEW.created_by_id IS NOT NULL THEN
            SELECT full_name INTO creator_name FROM public.profiles WHERE id = NEW.created_by_id;
        END IF;
        IF creator_name IS NULL THEN
            creator_name := user_name;
        END IF;

        history_entry := jsonb_build_object(
            'action', 'create',
            'details', format('Lead created by %s', creator_name),
            'text', format('Lead created by %s', creator_name),
            'timestamp', now(),
            'date_time', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
            'user_name', creator_name
        );
        history_array := history_array || jsonb_build_array(history_entry);

        -- 2. Log Initial Assignments
        -- Check if pre_sales_owner_id is set
        IF NEW.pre_sales_owner_id IS NOT NULL THEN
            SELECT full_name INTO assignee_name FROM public.profiles WHERE id = NEW.pre_sales_owner_id;
            IF assignee_name IS NOT NULL THEN
                history_entry := jsonb_build_object(
                    'action', 'assign_pre_sales',
                    'details', format('Lead assigned to %s (Pre-Sales Owner)', assignee_name),
                    'text', format('Lead assigned to %s (Pre-Sales Owner)', assignee_name),
                    'timestamp', now(),
                    'date_time', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
                    'user_name', user_name
                );
                history_array := history_array || jsonb_build_array(history_entry);
            END IF;
        END IF;

        -- Check if sales_owner_id is set
        IF NEW.sales_owner_id IS NOT NULL THEN
            SELECT full_name INTO assignee_name FROM public.profiles WHERE id = NEW.sales_owner_id;
            IF assignee_name IS NOT NULL THEN
                history_entry := jsonb_build_object(
                    'action', 'assign_sales',
                    'details', format('Lead assigned to %s (Sales Owner)', assignee_name),
                    'text', format('Lead assigned to %s (Sales Owner)', assignee_name),
                    'timestamp', now(),
                    'date_time', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
                    'user_name', user_name
                );
                history_array := history_array || jsonb_build_array(history_entry);
            END IF;
        END IF;

        -- Check if post_sales_owner_id is set
        IF NEW.post_sales_owner_id IS NOT NULL THEN
            SELECT full_name INTO assignee_name FROM public.profiles WHERE id = NEW.post_sales_owner_id;
            IF assignee_name IS NOT NULL THEN
                history_entry := jsonb_build_object(
                    'action', 'assign_post_sales',
                    'details', format('Lead assigned to %s (Post-Sales Owner)', assignee_name),
                    'text', format('Lead assigned to %s (Post-Sales Owner)', assignee_name),
                    'timestamp', now(),
                    'date_time', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
                    'user_name', user_name
                );
                history_array := history_array || jsonb_build_array(history_entry);
            END IF;
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
                'details', format('%s changed lead status from %s to %s', 
                                  user_name, 
                                  COALESCE(old_status, 'New'), 
                                  COALESCE(new_status, 'Unknown')),
                'text', format('%s changed lead status from %s to %s', 
                                  user_name, 
                                  COALESCE(old_status, 'New'), 
                                  COALESCE(new_status, 'Unknown')),
                'timestamp', now(),
                'date_time', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
                'user_name', user_name,
                'old_status', old_status,
                'new_status', new_status
            );
            history_array := history_array || jsonb_build_array(history_entry);
        END IF;

        -- 2. Owner changes
        -- Pre-Sales Owner Change
        IF NEW.pre_sales_owner_id IS DISTINCT FROM OLD.pre_sales_owner_id THEN
            IF NEW.pre_sales_owner_id IS NOT NULL THEN
                SELECT full_name INTO assignee_name FROM public.profiles WHERE id = NEW.pre_sales_owner_id;
                IF assignee_name IS NOT NULL THEN
                    history_entry := jsonb_build_object(
                        'action', 'assign_pre_sales',
                        'details', format('%s assigned lead to %s (Pre-Sales Owner)', user_name, assignee_name),
                        'text', format('%s assigned lead to %s (Pre-Sales Owner)', user_name, assignee_name),
                        'timestamp', now(),
                        'date_time', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
                        'user_name', user_name
                    );
                    history_array := history_array || jsonb_build_array(history_entry);
                END IF;
            ELSE
                history_entry := jsonb_build_object(
                    'action', 'unassign_pre_sales',
                    'details', format('%s removed Pre-Sales Owner assignment', user_name),
                    'text', format('%s removed Pre-Sales Owner assignment', user_name),
                    'timestamp', now(),
                    'date_time', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
                    'user_name', user_name
                );
                history_array := history_array || jsonb_build_array(history_entry);
            END IF;
        END IF;

        -- Sales Owner Change
        IF NEW.sales_owner_id IS DISTINCT FROM OLD.sales_owner_id THEN
            IF NEW.sales_owner_id IS NOT NULL THEN
                SELECT full_name INTO assignee_name FROM public.profiles WHERE id = NEW.sales_owner_id;
                IF assignee_name IS NOT NULL THEN
                    history_entry := jsonb_build_object(
                        'action', 'assign_sales',
                        'details', format('%s assigned lead to %s (Sales Owner)', user_name, assignee_name),
                        'text', format('%s assigned lead to %s (Sales Owner)', user_name, assignee_name),
                        'timestamp', now(),
                        'date_time', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
                        'user_name', user_name
                    );
                    history_array := history_array || jsonb_build_array(history_entry);
                END IF;
            ELSE
                history_entry := jsonb_build_object(
                    'action', 'unassign_sales',
                    'details', format('%s removed Sales Owner assignment', user_name),
                    'text', format('%s removed Sales Owner assignment', user_name),
                    'timestamp', now(),
                    'date_time', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
                    'user_name', user_name
                );
                history_array := history_array || jsonb_build_array(history_entry);
            END IF;
        END IF;

        -- Post-Sales Owner Change
        IF NEW.post_sales_owner_id IS DISTINCT FROM OLD.post_sales_owner_id THEN
            IF NEW.post_sales_owner_id IS NOT NULL THEN
                SELECT full_name INTO assignee_name FROM public.profiles WHERE id = NEW.post_sales_owner_id;
                IF assignee_name IS NOT NULL THEN
                    history_entry := jsonb_build_object(
                        'action', 'assign_post_sales',
                        'details', format('%s assigned lead to %s (Post-Sales Owner)', user_name, assignee_name),
                        'text', format('%s assigned lead to %s (Post-Sales Owner)', user_name, assignee_name),
                        'timestamp', now(),
                        'date_time', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
                        'user_name', user_name
                    );
                    history_array := history_array || jsonb_build_array(history_entry);
                END IF;
            ELSE
                history_entry := jsonb_build_object(
                    'action', 'unassign_post_sales',
                    'details', format('%s removed Post-Sales Owner assignment', user_name),
                    'text', format('%s removed Post-Sales Owner assignment', user_name),
                    'timestamp', now(),
                    'date_time', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
                    'user_name', user_name
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

-- 2. Drop existing triggers and attach redefined trigger to all standard lead tables
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
        -- Drop old triggers (if they exist under any of the known naming conventions)
        EXECUTE format('DROP TRIGGER IF EXISTS on_lead_update_history ON public.%I', table_record.table_name);
        EXECUTE format('DROP TRIGGER IF EXISTS on_lead_real_estate_update_history ON public.%I', table_record.table_name);
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_lead_history_insurance ON public.%I', table_record.table_name);
        
        -- Create the new trigger BEFORE INSERT OR UPDATE
        EXECUTE format('
            CREATE TRIGGER on_lead_update_history
            BEFORE INSERT OR UPDATE ON public.%I
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_lead_update_history()
        ', table_record.table_name);
    END LOOP;
END;
$$;

-- 3. Update the enable_custom_leads_table() function to ensure future tables get this trigger
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
