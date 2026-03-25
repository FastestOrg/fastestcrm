-- Add advanced AI configuration fields for batching and rate limiting
ALTER TABLE whatsapp_accounts
  ADD COLUMN IF NOT EXISTS ai_response_delay_seconds INTEGER DEFAULT 90,
  ADD COLUMN IF NOT EXISTS ai_max_replies_per_day INTEGER DEFAULT 20;

-- Refresh the schema cache if on PostgREST
NOTIFY pgrst, 'reload schema';
