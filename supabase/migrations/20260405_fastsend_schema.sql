-- ============================================================================
-- FastSend — AI Email Campaign Engine
-- Migration: 2026-04-05
-- ============================================================================

-- ─── 1. Email Accounts (IMAP/SMTP connections) ──────────────────────────────

CREATE TABLE IF NOT EXISTS email_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL DEFAULT 'custom' CHECK (provider IN ('gmail', 'outlook', 'zoho', 'custom')),
    email_address   TEXT NOT NULL,
    display_name    TEXT,
    protocol        TEXT NOT NULL DEFAULT 'smtp_only' CHECK (protocol IN ('imap_smtp', 'smtp_only')),

    -- SMTP settings
    smtp_host       TEXT,
    smtp_port       INT DEFAULT 587,
    smtp_user       TEXT,
    smtp_password   TEXT,
    smtp_secure     BOOLEAN DEFAULT true,

    -- IMAP settings (optional)
    imap_host       TEXT,
    imap_port       INT DEFAULT 993,
    imap_user       TEXT,
    imap_password   TEXT,
    
    -- OAuth settings
    access_token    TEXT,
    refresh_token   TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Sending limits & warm-up
    daily_limit         INT DEFAULT 50,
    emails_sent_today   INT DEFAULT 0,
    warmup_enabled      BOOLEAN DEFAULT false,
    warmup_daily_target INT DEFAULT 5,
    warmup_ramp_per_day INT DEFAULT 2,
    warmup_current_day  INT DEFAULT 0,

    status          TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
    last_error      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company email accounts"
    ON email_accounts FOR SELECT
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert email accounts for their company"
    ON email_accounts FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their company email accounts"
    ON email_accounts FOR UPDATE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their company email accounts"
    ON email_accounts FOR DELETE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));


-- ─── 2. Email Campaigns ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_campaigns (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by              UUID REFERENCES auth.users(id),
    name                    TEXT NOT NULL,
    campaign_goal           TEXT DEFAULT 'sales' CHECK (campaign_goal IN ('sales', 'meeting_booking', 'app_download', 'other')),
    campaign_mode           TEXT DEFAULT 'genetic' CHECK (campaign_mode IN ('guided', 'genetic')),

    status                  TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'scheduled')),

    -- Recipient config
    recipient_filter        JSONB DEFAULT '{}',
    recipient_count         INT DEFAULT 0,
    account_ids             UUID[] DEFAULT '{}',

    -- Delay & rate limiting
    delay_between_emails_ms BIGINT DEFAULT 60000,       -- 60 seconds default
    daily_limit             INT DEFAULT 50,
    warmup_enabled          BOOLEAN DEFAULT false,
    warmup_ramp_per_day     INT DEFAULT 2,

    -- AI metadata
    ai_generated            BOOLEAN DEFAULT false,
    ai_perspective          TEXT,                         -- user-provided campaign perspective for genetic mode

    -- Timestamps
    scheduled_at            TIMESTAMPTZ,
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company email campaigns"
    ON email_campaigns FOR SELECT
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert email campaigns for their company"
    ON email_campaigns FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their company email campaigns"
    ON email_campaigns FOR UPDATE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their company email campaigns"
    ON email_campaigns FOR DELETE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));


-- ─── 3. Email Campaign Sequences (individual emails in a drip) ──────────────

CREATE TABLE IF NOT EXISTS email_campaign_sequences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
    step_number     INT NOT NULL DEFAULT 1,
    subject         TEXT NOT NULL,
    body_html       TEXT NOT NULL,
    body_text       TEXT,
    delay_after_ms  BIGINT DEFAULT 86400000,   -- default 24h
    send_condition  TEXT DEFAULT 'always' CHECK (send_condition IN ('always', 'if_no_reply', 'if_no_open')),
    ai_generated    BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_campaign_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage campaign sequences"
    ON email_campaign_sequences FOR ALL
    USING (campaign_id IN (
        SELECT id FROM email_campaigns
        WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    ));


-- ─── 4. Email Campaign Recipients ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
    lead_id         UUID,
    lead_table      TEXT,
    lead_email      TEXT NOT NULL,
    lead_name       TEXT,
    lead_data       JSONB DEFAULT '{}',
    current_step    INT DEFAULT 0,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'replied', 'completed', 'bounced', 'unsubscribed', 'failed')),
    last_sent_at    TIMESTAMPTZ,
    opened_at       TIMESTAMPTZ,
    replied_at      TIMESTAMPTZ,
    clicked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage campaign recipients"
    ON email_campaign_recipients FOR ALL
    USING (campaign_id IN (
        SELECT id FROM email_campaigns
        WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    ));


-- ─── 5. Email Campaign Logs ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_campaign_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    campaign_id         UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
    recipient_id        UUID REFERENCES email_campaign_recipients(id) ON DELETE SET NULL,
    sequence_step_id    UUID REFERENCES email_campaign_sequences(id) ON DELETE SET NULL,
    sent_by_account_id  UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
    recipient_email     TEXT,
    subject             TEXT,
    status              TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'replied', 'clicked', 'bounced', 'failed')),
    tracking_pixel_id   TEXT,
    error_message       TEXT,
    sent_at             TIMESTAMPTZ DEFAULT now(),
    opened_at           TIMESTAMPTZ,
    replied_at          TIMESTAMPTZ,
    clicked_at          TIMESTAMPTZ
);

ALTER TABLE email_campaign_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company email logs"
    ON email_campaign_logs FOR SELECT
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert email logs"
    ON email_campaign_logs FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));


-- ─── 6. Indexes ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_email_accounts_company ON email_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_company ON email_campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_sequences_campaign ON email_campaign_sequences(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_campaign ON email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_status ON email_campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_email_campaign_logs_company ON email_campaign_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_logs_campaign ON email_campaign_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_logs_tracking ON email_campaign_logs(tracking_pixel_id);


-- ─── 7. Helper RPC for incrementing daily sent count ────────────────────────

CREATE OR REPLACE FUNCTION increment_email_sent(account_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE email_accounts
    SET emails_sent_today = emails_sent_today + 1,
        updated_at = now()
    WHERE id = account_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 8. Daily reset for email sent counters (run via cron) ──────────────────

CREATE OR REPLACE FUNCTION reset_email_daily_counters()
RETURNS void AS $$
BEGIN
    UPDATE email_accounts
    SET emails_sent_today = 0,
        warmup_current_day = CASE WHEN warmup_enabled THEN warmup_current_day + 1 ELSE 0 END,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
