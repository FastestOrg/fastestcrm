-- Enable Row Level Security and define policies for invoices-related tables

-- ============================================================================
-- 1. public.invoices
-- ============================================================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete company invoices" ON public.invoices;

CREATE POLICY "Users can view company invoices" ON public.invoices
    FOR SELECT USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert company invoices" ON public.invoices
    FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update company invoices" ON public.invoices
    FOR UPDATE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete company invoices" ON public.invoices
    FOR DELETE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));


-- ============================================================================
-- 2. public.invoice_items
-- ============================================================================
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can insert company invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can update company invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete company invoice items" ON public.invoice_items;

CREATE POLICY "Users can view company invoice items" ON public.invoice_items
    FOR SELECT USING (
        invoice_id IN (
            SELECT id FROM public.invoices WHERE company_id IN (
                SELECT company_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert company invoice items" ON public.invoice_items
    FOR INSERT WITH CHECK (
        invoice_id IN (
            SELECT id FROM public.invoices WHERE company_id IN (
                SELECT company_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update company invoice items" ON public.invoice_items
    FOR UPDATE USING (
        invoice_id IN (
            SELECT id FROM public.invoices WHERE company_id IN (
                SELECT company_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete company invoice items" ON public.invoice_items
    FOR DELETE USING (
        invoice_id IN (
            SELECT id FROM public.invoices WHERE company_id IN (
                SELECT company_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );


-- ============================================================================
-- 3. public.invoice_settings
-- ============================================================================
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company invoice settings" ON public.invoice_settings;
DROP POLICY IF EXISTS "Users can insert company invoice settings" ON public.invoice_settings;
DROP POLICY IF EXISTS "Users can update company invoice settings" ON public.invoice_settings;
DROP POLICY IF EXISTS "Users can delete company invoice settings" ON public.invoice_settings;

CREATE POLICY "Users can view company invoice settings" ON public.invoice_settings
    FOR SELECT USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert company invoice settings" ON public.invoice_settings
    FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update company invoice settings" ON public.invoice_settings
    FOR UPDATE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete company invoice settings" ON public.invoice_settings
    FOR DELETE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));


-- ============================================================================
-- 4. public.invoice_taxes
-- ============================================================================
ALTER TABLE public.invoice_taxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company invoice taxes" ON public.invoice_taxes;
DROP POLICY IF EXISTS "Users can insert company invoice taxes" ON public.invoice_taxes;
DROP POLICY IF EXISTS "Users can update company invoice taxes" ON public.invoice_taxes;
DROP POLICY IF EXISTS "Users can delete company invoice taxes" ON public.invoice_taxes;

CREATE POLICY "Users can view company invoice taxes" ON public.invoice_taxes
    FOR SELECT USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert company invoice taxes" ON public.invoice_taxes
    FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update company invoice taxes" ON public.invoice_taxes
    FOR UPDATE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete company invoice taxes" ON public.invoice_taxes
    FOR DELETE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));


-- ============================================================================
-- 5. public.invoice_templates
-- ============================================================================
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company invoice templates" ON public.invoice_templates;
DROP POLICY IF EXISTS "Users can insert company invoice templates" ON public.invoice_templates;
DROP POLICY IF EXISTS "Users can update company invoice templates" ON public.invoice_templates;
DROP POLICY IF EXISTS "Users can delete company invoice templates" ON public.invoice_templates;

CREATE POLICY "Users can view company invoice templates" ON public.invoice_templates
    FOR SELECT USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert company invoice templates" ON public.invoice_templates
    FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update company invoice templates" ON public.invoice_templates
    FOR UPDATE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete company invoice templates" ON public.invoice_templates
    FOR DELETE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));


-- ============================================================================
-- 6. public.invoice_payments
-- ============================================================================
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view company invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Users can insert company invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Users can update company invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Users can delete company invoice payments" ON public.invoice_payments;

CREATE POLICY "Users can view company invoice payments" ON public.invoice_payments
    FOR SELECT USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert company invoice payments" ON public.invoice_payments
    FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update company invoice payments" ON public.invoice_payments
    FOR UPDATE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete company invoice payments" ON public.invoice_payments
    FOR DELETE USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
