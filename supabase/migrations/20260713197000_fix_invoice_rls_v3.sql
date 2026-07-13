-- Fix: Replace get_user_company_id() with inline subquery in policies
-- This avoids any potential issues with SECURITY DEFINER, search_path, or function resolution

-- First, drop ALL existing policies on invoices table
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

-- Recreate invoices policies with inline auth check (no function call)
CREATE POLICY "invoices_company_select" ON public.invoices
    FOR SELECT USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoices_company_insert" ON public.invoices
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoices_company_update" ON public.invoices
    FOR UPDATE USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoices_company_delete" ON public.invoices
    FOR DELETE USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

-- Drop and recreate invoice_settings policies with inline auth check
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

CREATE POLICY "invoice_settings_company_select" ON public.invoice_settings
    FOR SELECT USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_settings_company_insert" ON public.invoice_settings
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_settings_company_update" ON public.invoice_settings
    FOR UPDATE USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_settings_company_delete" ON public.invoice_settings
    FOR DELETE USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

-- Drop and recreate invoice_items policies (remove duplicates, use inline check via parent invoices)
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

CREATE POLICY "invoice_items_company_select" ON public.invoice_items
    FOR SELECT USING (
        invoice_id IN (
            SELECT i.id FROM public.invoices i
            WHERE i.company_id IN (
                SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
            )
        )
    );

CREATE POLICY "invoice_items_company_insert" ON public.invoice_items
    FOR INSERT WITH CHECK (
        invoice_id IN (
            SELECT i.id FROM public.invoices i
            WHERE i.company_id IN (
                SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
            )
        )
    );

CREATE POLICY "invoice_items_company_update" ON public.invoice_items
    FOR UPDATE USING (
        invoice_id IN (
            SELECT i.id FROM public.invoices i
            WHERE i.company_id IN (
                SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
            )
        )
    );

CREATE POLICY "invoice_items_company_delete" ON public.invoice_items
    FOR DELETE USING (
        invoice_id IN (
            SELECT i.id FROM public.invoices i
            WHERE i.company_id IN (
                SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
            )
        )
    );

-- Drop and recreate invoice_payments policies
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

CREATE POLICY "invoice_payments_company_select" ON public.invoice_payments
    FOR SELECT USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_payments_company_insert" ON public.invoice_payments
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_payments_company_update" ON public.invoice_payments
    FOR UPDATE USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_payments_company_delete" ON public.invoice_payments
    FOR DELETE USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

-- Drop and recreate invoice_taxes policies
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

CREATE POLICY "invoice_taxes_company_select" ON public.invoice_taxes
    FOR SELECT USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_taxes_company_insert" ON public.invoice_taxes
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_taxes_company_update" ON public.invoice_taxes
    FOR UPDATE USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_taxes_company_delete" ON public.invoice_taxes
    FOR DELETE USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

-- Drop and recreate invoice_templates policies
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

CREATE POLICY "invoice_templates_company_select" ON public.invoice_templates
    FOR SELECT USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_templates_company_insert" ON public.invoice_templates
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_templates_company_update" ON public.invoice_templates
    FOR UPDATE USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "invoice_templates_company_delete" ON public.invoice_templates
    FOR DELETE USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
        )
    );
