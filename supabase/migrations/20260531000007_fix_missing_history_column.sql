-- 1. Ensure lead_history column exists on all tables matching 'leads' or 'leads_%'
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
        -- Add lead_history column if it does not exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = table_record.table_name 
              AND column_name = 'lead_history'
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN lead_history jsonb DEFAULT ''[]''::jsonb', table_record.table_name);
            RAISE NOTICE 'Added lead_history column to table: %', table_record.table_name;
        END IF;
    END LOOP;
END;
$$;

-- 2. Re-apply history update triggers to all tables
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
        -- Drop old triggers
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
        
        RAISE NOTICE 'Applied lead history trigger to table: %', table_record.table_name;
    END LOOP;
END;
$$;
