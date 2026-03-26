-- ============================================================================
-- Apply Hierarchy System to WhatsApp Accounts & Campaigns
-- ============================================================================

-- 1. Add user_id to whatsapp_accounts
ALTER TABLE whatsapp_accounts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Default existing accounts to the company admin (optional backfill, but leaving null is fine. 
-- Wait, if user_id is null, our policy falls back to the company admin rule anyway).

-- 2. Drop existing minimal policies
DROP POLICY IF EXISTS "wa_accounts_company_access" ON whatsapp_accounts;
DROP POLICY IF EXISTS "wa_campaigns_company_access" ON whatsapp_campaigns;

-- 3. Create new Hierarchical Policies for whatsapp_accounts
-- Admins/Subadmins can see all via is_in_hierarchy(). Otherwise, only your own or your subordinates.
CREATE POLICY "wa_accounts_hierarchy_access" ON whatsapp_accounts
  FOR ALL USING (
    company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND
    (
        -- Unassigned or older accounts can be managed by admins natively:
        (
            user_id IS NULL AND
            (
                has_role(auth.uid(), 'company') OR 
                has_role(auth.uid(), 'company_subadmin')
            )
        )
        OR
        -- Normal check for owners and subordinates:
        (
            user_id IS NOT NULL AND
            is_in_hierarchy(auth.uid(), user_id)
        )
    )
  );

-- 4. Create new Hierarchical Policies for whatsapp_campaigns
-- Same exact logic but checking `created_by` instead of `user_id`
CREATE POLICY "wa_campaigns_hierarchy_access" ON whatsapp_campaigns
  FOR ALL USING (
    company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    AND
    (
        (
            created_by IS NULL AND
            (
                has_role(auth.uid(), 'company') OR 
                has_role(auth.uid(), 'company_subadmin')
            )
        )
        OR
        (
            created_by IS NOT NULL AND
            is_in_hierarchy(auth.uid(), created_by)
        )
    )
  );

-- Refresh the schema cache if on PostgREST
NOTIFY pgrst, 'reload schema';
