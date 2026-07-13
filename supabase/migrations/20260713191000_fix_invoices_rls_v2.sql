-- Fix invoices RLS policies by defining get_user_company_id() helper and dropping conflicting policies

-- Clean up temporary debug table
DROP TABLE IF EXISTS public.temp_debug_policies;

-- 1. Create or replace the zero-argument get_user_company_id helper function
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

-- 2. Drop all old/legacy policies and new policies on invoices
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
DROP POLICY IF EXISTS "Users can view company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete company invoices" ON public.invoices;

-- Recreate clean invoices policies
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company invoices" ON public.invoices
    FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert company invoices" ON public.invoices
    FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update company invoices" ON public.invoices
    FOR UPDATE USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete company invoices" ON public.invoices
    FOR DELETE USING (company_id = public.get_user_company_id());


-- 3. Drop all policies on invoice_settings
DROP POLICY IF EXISTS "invoice_settings_select" ON public.invoice_settings;
DROP POLICY IF EXISTS "invoice_settings_insert" ON public.invoice_settings;
DROP POLICY IF EXISTS "invoice_settings_update" ON public.invoice_settings;
DROP POLICY IF EXISTS "Users can view company invoice settings" ON public.invoice_settings;
DROP POLICY IF EXISTS "Users can insert company invoice settings" ON public.invoice_settings;
DROP POLICY IF EXISTS "Users can update company invoice settings" ON public.invoice_settings;
DROP POLICY IF EXISTS "Users can delete company invoice settings" ON public.invoice_settings;

-- Recreate clean invoice_settings policies
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company invoice settings" ON public.invoice_settings
    FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert company invoice settings" ON public.invoice_settings
    FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update company invoice settings" ON public.invoice_settings
    FOR UPDATE USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete company invoice settings" ON public.invoice_settings
    FOR DELETE USING (company_id = public.get_user_company_id());


-- 4. Drop all policies on invoice_items
DROP POLICY IF EXISTS "Users can view company invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can insert company invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can update company invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete company invoice items" ON public.invoice_items;

-- Recreate clean invoice_items policies (linked to invoices)
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company invoice items" ON public.invoice_items
    FOR SELECT USING (invoice_id IN (SELECT id FROM public.invoices));

CREATE POLICY "Users can insert company invoice items" ON public.invoice_items
    FOR INSERT WITH CHECK (invoice_id IN (SELECT id FROM public.invoices));

CREATE POLICY "Users can update company invoice items" ON public.invoice_items
    FOR UPDATE USING (invoice_id IN (SELECT id FROM public.invoices));

CREATE POLICY "Users can delete company invoice items" ON public.invoice_items
    FOR DELETE USING (invoice_id IN (SELECT id FROM public.invoices));


-- 5. Drop all policies on invoice_taxes
DROP POLICY IF EXISTS "Users can view company invoice taxes" ON public.invoice_taxes;
DROP POLICY IF EXISTS "Users can insert company invoice taxes" ON public.invoice_taxes;
DROP POLICY IF EXISTS "Users can update company invoice taxes" ON public.invoice_taxes;
DROP POLICY IF EXISTS "Users can delete company invoice taxes" ON public.invoice_taxes;

-- Recreate clean invoice_taxes policies
ALTER TABLE public.invoice_taxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company invoice taxes" ON public.invoice_taxes
    FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert company invoice taxes" ON public.invoice_taxes
    FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update company invoice taxes" ON public.invoice_taxes
    FOR UPDATE USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete company invoice taxes" ON public.invoice_taxes
    FOR DELETE USING (company_id = public.get_user_company_id());


-- 6. Drop all policies on invoice_templates
DROP POLICY IF EXISTS "Users can view company invoice templates" ON public.invoice_templates;
DROP POLICY IF EXISTS "Users can insert company invoice templates" ON public.invoice_templates;
DROP POLICY IF EXISTS "Users can update company invoice templates" ON public.invoice_templates;
DROP POLICY IF EXISTS "Users can delete company invoice templates" ON public.invoice_templates;

-- Recreate clean invoice_templates policies
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company invoice templates" ON public.invoice_templates
    FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert company invoice templates" ON public.invoice_templates
    FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update company invoice templates" ON public.invoice_templates
    FOR UPDATE USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete company invoice templates" ON public.invoice_templates
    FOR DELETE USING (company_id = public.get_user_company_id());


-- 7. Drop all policies on invoice_payments
DROP POLICY IF EXISTS "Users can view company invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Users can insert company invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Users can update company invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Users can delete company invoice payments" ON public.invoice_payments;

-- Recreate clean invoice_payments policies
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company invoice payments" ON public.invoice_payments
    FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert company invoice payments" ON public.invoice_payments
    FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update company invoice payments" ON public.invoice_payments
    FOR UPDATE USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete company invoice payments" ON public.invoice_payments
    FOR DELETE USING (company_id = public.get_user_company_id());
