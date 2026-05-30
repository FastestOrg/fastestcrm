-- Index on debug_logs (created_at) for efficient sorting and pruning of log entries
CREATE INDEX IF NOT EXISTS idx_debug_logs_created_at ON public.debug_logs (created_at DESC);

-- Index on automations (user_id) for owner filtering
CREATE INDEX IF NOT EXISTS idx_automations_user_id ON public.automations (user_id);

-- Index on automation_logs (automation_id) for log association lookup
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON public.automation_logs (automation_id);
