-- Add new columns to email_campaigns for AI generation metadata
ALTER TABLE email_campaigns 
ADD COLUMN IF NOT EXISTS product_info TEXT,
ADD COLUMN IF NOT EXISTS ai_auto_reply_goal TEXT,
ADD COLUMN IF NOT EXISTS ai_auto_reply_perspective TEXT;

-- RPC to create campaign recipients efficiently on the server
-- This avoids client-side batching for large lists
CREATE OR REPLACE FUNCTION create_campaign_recipients(
    p_campaign_id UUID,
    p_lead_table TEXT,
    p_status_filter TEXT,
    p_email_field TEXT,
    p_company_id UUID
)
RETURNS VOID AS $$
BEGIN
    EXECUTE format(
        'INSERT INTO email_campaign_recipients (
            campaign_id, lead_id, lead_table, lead_email, lead_name, lead_data, status, current_step
        )
        SELECT 
            %L, id, %L, %I, COALESCE(name, ''''), to_jsonb(t.*), %L, 0
        FROM %I t
        WHERE company_id = %L 
        AND (%L = %L OR status = %L)
        AND %I IS NOT NULL 
        AND %I != %L',
        p_campaign_id, p_lead_table, p_email_field, 'pending', p_lead_table, p_company_id, p_status_filter, 'all', p_status_filter, p_email_field, p_email_field, ''
    );
    
    -- Update recipient count in campaign
    UPDATE email_campaigns 
    SET recipient_count = (SELECT COUNT(*) FROM email_campaign_recipients WHERE campaign_id = p_campaign_id)
    WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
