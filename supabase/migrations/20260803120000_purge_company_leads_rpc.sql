-- Purge Company Leads Helper Function for Ultra-Fast Batch Deletion
CREATE OR REPLACE FUNCTION public.purge_company_leads(p_company_id TEXT DEFAULT NULL, p_table_name TEXT DEFAULT 'leads')
RETURNS INTEGER AS $$
DECLARE
    deleted_total INTEGER := 0;
    deleted_batch INTEGER := 0;
BEGIN
    LOOP
        IF p_company_id IS NOT NULL AND p_company_id <> '' THEN
            EXECUTE format('DELETE FROM %I WHERE id IN (SELECT id FROM %I WHERE company_id = %L LIMIT 5000)', 
                           p_table_name, p_table_name, p_company_id);
        ELSE
            EXECUTE format('DELETE FROM %I WHERE id IN (SELECT id FROM %I LIMIT 5000)', 
                           p_table_name, p_table_name);
        END IF;

        GET DIAGNOSTICS deleted_batch = ROW_COUNT;
        deleted_total := deleted_total + deleted_batch;
        
        EXIT WHEN deleted_batch = 0;
    END LOOP;
    
    RETURN deleted_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
