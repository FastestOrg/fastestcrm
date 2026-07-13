-- Create temporary debug table to inspect database policies
CREATE TABLE IF NOT EXISTS public.temp_debug_policies (
    id SERIAL PRIMARY KEY,
    table_name TEXT,
    policy_name TEXT,
    cmd TEXT,
    qual TEXT,
    with_check TEXT
);

-- Disable RLS on the debug table so we can read it publicly via API
ALTER TABLE public.temp_debug_policies DISABLE ROW LEVEL SECURITY;

-- Clear previous values if any
TRUNCATE public.temp_debug_policies;

-- Insert all active policies for invoices and invoice_settings
INSERT INTO public.temp_debug_policies (table_name, policy_name, cmd, qual, with_check)
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('invoices', 'invoice_settings');
