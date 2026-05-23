-- Migration: Add error_message to email_campaign_recipients
ALTER TABLE email_campaign_recipients ADD COLUMN IF NOT EXISTS error_message TEXT;
