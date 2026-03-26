-- Fix foreign key constraints to allow deleting WhatsApp Accounts without violating references
-- in the message logs and campaign queues. By using ON DELETE SET NULL, we preserve
-- the audit log of messages sent, but unlink the deleted account.

ALTER TABLE whatsapp_campaign_recipients
  DROP CONSTRAINT IF EXISTS whatsapp_campaign_recipients_sent_by_account_id_fkey,
  ADD CONSTRAINT whatsapp_campaign_recipients_sent_by_account_id_fkey
    FOREIGN KEY (sent_by_account_id)
    REFERENCES whatsapp_accounts(id)
    ON DELETE SET NULL;

ALTER TABLE whatsapp_message_log
  DROP CONSTRAINT IF EXISTS whatsapp_message_log_account_id_fkey,
  ADD CONSTRAINT whatsapp_message_log_account_id_fkey
    FOREIGN KEY (account_id)
    REFERENCES whatsapp_accounts(id)
    ON DELETE SET NULL;

-- Refresh the schema cache if on PostgREST
NOTIFY pgrst, 'reload schema';
