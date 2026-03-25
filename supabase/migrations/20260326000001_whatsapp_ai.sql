-- Add AI Configuration fields directly to the whatsapp_accounts table
ALTER TABLE whatsapp_accounts
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_prompt TEXT,
  ADD COLUMN IF NOT EXISTS ai_goal TEXT,
  ADD COLUMN IF NOT EXISTS ai_knowledge_base TEXT;

-- Enhance the message log to support inbound messages
ALTER TABLE whatsapp_message_log
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('inbound', 'outbound'));
