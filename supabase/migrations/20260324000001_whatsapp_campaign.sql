-- ============================================================================
-- WhatsApp Campaign Feature — Database Tables
-- ============================================================================

-- 1. whatsapp_accounts — Linked WhatsApp numbers (one per QR scan)
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    display_name TEXT,
    status TEXT NOT NULL DEFAULT 'connecting'
        CHECK (status IN ('connecting', 'connected', 'disconnected')),
    auth_creds JSONB,
    daily_limit INT NOT NULL DEFAULT 500,
    messages_sent_today INT NOT NULL DEFAULT 0,
    last_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. whatsapp_campaigns — Campaign definitions
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id),
    name TEXT NOT NULL,
    message_template TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')),
    account_ids UUID[] NOT NULL DEFAULT '{}',
    recipient_filter JSONB,
    recipient_count INT NOT NULL DEFAULT 0,
    delay_min_seconds INT NOT NULL DEFAULT 15,
    delay_max_seconds INT NOT NULL DEFAULT 60,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. whatsapp_campaign_recipients — Per-recipient message queue
CREATE TABLE IF NOT EXISTS whatsapp_campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
    lead_id UUID,
    phone_number TEXT NOT NULL,
    lead_table TEXT,
    lead_data JSONB,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    sent_by_account_id UUID REFERENCES whatsapp_accounts(id),
    resolved_message TEXT,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. whatsapp_message_log — Audit trail
CREATE TABLE IF NOT EXISTS whatsapp_message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_id UUID REFERENCES whatsapp_accounts(id),
    campaign_id UUID REFERENCES whatsapp_campaigns(id) ON DELETE SET NULL,
    recipient_phone TEXT NOT NULL,
    message_body TEXT,
    status TEXT NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wa_accounts_company ON whatsapp_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_company ON whatsapp_campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_wa_recipients_campaign ON whatsapp_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_wa_recipients_status ON whatsapp_campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_log_company ON whatsapp_message_log(company_id);
CREATE INDEX IF NOT EXISTS idx_wa_log_campaign ON whatsapp_message_log(campaign_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_log ENABLE ROW LEVEL SECURITY;

-- Policies: users can access rows belonging to their company
CREATE POLICY "wa_accounts_company_access" ON whatsapp_accounts
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "wa_campaigns_company_access" ON whatsapp_campaigns
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "wa_recipients_company_access" ON whatsapp_campaign_recipients
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM whatsapp_campaigns WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "wa_log_company_access" ON whatsapp_message_log
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- ── Helper RPC: atomically increment daily message counter ───────────────────
CREATE OR REPLACE FUNCTION increment_wa_messages_sent(account_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
    UPDATE whatsapp_accounts
    SET messages_sent_today = messages_sent_today + 1
    WHERE id = account_id;
$$;
