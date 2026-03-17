-- Expand lead visibility for Real Estate industry
-- Allowing Pre-Sales and Post-Sales owners (and their hierarchy) to see leads

-- 1. Update SELECT policy
DROP POLICY IF EXISTS "Users view hierarchy real estate leads" ON public.leads_real_estate;
CREATE POLICY "Users view hierarchy real estate leads" ON public.leads_real_estate
FOR SELECT USING (
    is_same_company(auth.uid(), company_id) AND (
        is_in_hierarchy(auth.uid(), created_by_id) OR 
        is_in_hierarchy(auth.uid(), sales_owner_id) OR
        is_in_hierarchy(auth.uid(), pre_sales_owner_id) OR
        is_in_hierarchy(auth.uid(), post_sales_owner_id)
    )
);

-- 2. Update UPDATE policy
DROP POLICY IF EXISTS "Users can update real estate leads" ON public.leads_real_estate;
CREATE POLICY "Users can update real estate leads" ON public.leads_real_estate
FOR UPDATE USING (
    is_same_company(auth.uid(), company_id) AND (
        has_role(auth.uid(), 'company') OR 
        has_role(auth.uid(), 'company_subadmin') OR
        created_by_id = auth.uid() OR
        pre_sales_owner_id = auth.uid() OR
        sales_owner_id = auth.uid() OR
        post_sales_owner_id = auth.uid() OR
        is_in_hierarchy(auth.uid(), created_by_id) OR
        is_in_hierarchy(auth.uid(), sales_owner_id) OR
        is_in_hierarchy(auth.uid(), pre_sales_owner_id) OR
        is_in_hierarchy(auth.uid(), post_sales_owner_id)
    )
);
