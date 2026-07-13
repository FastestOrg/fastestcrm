-- Fix: Update RLS policies to grant platform admins full access to all invoice-related tables
-- This ensures super admins can manage these records across all tenants

-- 1. public.invoices
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'invoices'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.invoices', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "invoices_select_policy" ON public.invoices
    FOR SELECT USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoices_insert_policy" ON public.invoices
    FOR INSERT WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoices_update_policy" ON public.invoices
    FOR UPDATE USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoices_delete_policy" ON public.invoices
    FOR DELETE USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );


-- 2. public.invoice_settings
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'invoice_settings'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.invoice_settings', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "invoice_settings_select_policy" ON public.invoice_settings
    FOR SELECT USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_settings_insert_policy" ON public.invoice_settings
    FOR INSERT WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_settings_update_policy" ON public.invoice_settings
    FOR UPDATE USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_settings_delete_policy" ON public.invoice_settings
    FOR DELETE USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );


-- 3. public.invoice_items
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'invoice_items'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.invoice_items', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "invoice_items_select_policy" ON public.invoice_items
    FOR SELECT USING (
        public.is_platform_admin(auth.uid())
        OR
        invoice_id IN (
            SELECT i.id FROM public.invoices i
            WHERE i.company_id IN (
                SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
            )
        )
    );

CREATE POLICY "invoice_items_insert_policy" ON public.invoice_items
    FOR INSERT WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR
        invoice_id IN (
            SELECT i.id FROM public.invoices i
            WHERE i.company_id IN (
                SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
            )
        )
    );

CREATE POLICY "invoice_items_update_policy" ON public.invoice_items
    FOR UPDATE USING (
        public.is_platform_admin(auth.uid())
        OR
        invoice_id IN (
            SELECT i.id FROM public.invoices i
            WHERE i.company_id IN (
                SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
            )
        )
    );

CREATE POLICY "invoice_items_delete_policy" ON public.invoice_items
    FOR DELETE USING (
        public.is_platform_admin(auth.uid())
        OR
        invoice_id IN (
            SELECT i.id FROM public.invoices i
            WHERE i.company_id IN (
                SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
            )
        )
    );


-- 4. public.invoice_payments
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'invoice_payments'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.invoice_payments', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "invoice_payments_select_policy" ON public.invoice_payments
    FOR SELECT USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_payments_insert_policy" ON public.invoice_payments
    FOR INSERT WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_payments_update_policy" ON public.invoice_payments
    FOR UPDATE USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_payments_delete_policy" ON public.invoice_payments
    FOR DELETE USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );


-- 5. public.invoice_taxes
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'invoice_taxes'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.invoice_taxes', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "invoice_taxes_select_policy" ON public.invoice_taxes
    FOR SELECT USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_taxes_insert_policy" ON public.invoice_taxes
    FOR INSERT WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_taxes_update_policy" ON public.invoice_taxes
    FOR UPDATE USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_taxes_delete_policy" ON public.invoice_taxes
    FOR DELETE USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );


-- 6. public.invoice_templates
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'invoice_templates'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.invoice_templates', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "invoice_templates_select_policy" ON public.invoice_templates
    FOR SELECT USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_templates_insert_policy" ON public.invoice_templates
    FOR INSERT WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_templates_update_policy" ON public.invoice_templates
    FOR UPDATE USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_templates_delete_policy" ON public.invoice_templates
    FOR DELETE USING (
        public.is_platform_admin(auth.uid())
        OR
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );
