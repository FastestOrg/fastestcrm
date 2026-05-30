-- ============================================================================
-- AI Agent Autonomous Task Execution System
-- Creates memory, actions, and task log tables + upgrades ai_employees
-- ============================================================================

-- ─── 1. Upgrade ai_employees with agent capabilities ────────────────────────

-- AI Caller agent link
DO $$ BEGIN
  ALTER TABLE public.ai_employees ADD COLUMN ai_caller_agent_id UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Autonomy mode: 'guided' or 'full_pilot'
DO $$ BEGIN
  ALTER TABLE public.ai_employees ADD COLUMN autonomy_mode TEXT NOT NULL DEFAULT 'guided';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Daily call limit
DO $$ BEGIN
  ALTER TABLE public.ai_employees ADD COLUMN daily_call_limit INTEGER NOT NULL DEFAULT 50;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Ordered channel priority
DO $$ BEGIN
  ALTER TABLE public.ai_employees ADD COLUMN channels_priority JSONB NOT NULL DEFAULT '["call","whatsapp","email"]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── 2. AI Employee Memory ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_employee_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    lead_id UUID NOT NULL
);

-- Ensure all memory columns exist for pre-existing tables
DO $$ BEGIN
  ALTER TABLE public.ai_employee_memory ADD COLUMN company_id UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_employee_memory ADD COLUMN memory_data JSONB DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_employee_memory ADD COLUMN summary TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_employee_memory ADD COLUMN lead_context_snapshot JSONB DEFAULT '{}'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_employee_memory ADD COLUMN interaction_count INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_employee_memory ADD COLUMN last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_employee_memory ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_employee_memory ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Ensure unique constraint exists
DO $$ BEGIN
  ALTER TABLE public.ai_employee_memory ADD CONSTRAINT unique_employee_lead UNIQUE (employee_id, lead_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;


-- ─── 3. AI Employee Actions Log ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_employee_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    lead_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
);

-- Ensure all action columns exist for pre-existing tables
DO $$ BEGIN
  ALTER TABLE public.ai_employee_actions ADD COLUMN company_id UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_employee_actions ADD COLUMN content TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_employee_actions ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_employee_actions ADD COLUMN error_message TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_employee_actions ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;


-- ─── 4. AI Agent Task Log ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_agent_task_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL,
    employee_id UUID,
    company_id UUID NOT NULL,
    lead_table TEXT NOT NULL DEFAULT 'leads',
    task_reminder_at TIMESTAMP WITH TIME ZONE NOT NULL,
    action_taken TEXT,
    channel_used TEXT,
    result JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(lead_id, task_reminder_at, lead_table)
);

-- ─── 5. Indexes for performance ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ai_employee_memory_lookup
    ON public.ai_employee_memory (employee_id, lead_id);

CREATE INDEX IF NOT EXISTS idx_ai_employee_memory_company
    ON public.ai_employee_memory (company_id);

CREATE INDEX IF NOT EXISTS idx_ai_employee_actions_lead
    ON public.ai_employee_actions (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_employee_actions_employee
    ON public.ai_employee_actions (employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_agent_task_log_lookup
    ON public.ai_agent_task_log (lead_id, task_reminder_at);

CREATE INDEX IF NOT EXISTS idx_ai_agent_task_log_company
    ON public.ai_agent_task_log (company_id, created_at DESC);

-- ─── 6. RLS Policies ───────────────────────────────────────────────────────

ALTER TABLE public.ai_employee_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_employee_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_task_log ENABLE ROW LEVEL SECURITY;

-- Memory policies
DROP POLICY IF EXISTS "Users can view company AI memory" ON public.ai_employee_memory;
CREATE POLICY "Users can view company AI memory" ON public.ai_employee_memory
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Service role full access to AI memory" ON public.ai_employee_memory;
CREATE POLICY "Service role full access to AI memory" ON public.ai_employee_memory
    FOR ALL USING (true) WITH CHECK (true);

-- Actions policies
DROP POLICY IF EXISTS "Users can view company AI actions" ON public.ai_employee_actions;
CREATE POLICY "Users can view company AI actions" ON public.ai_employee_actions
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Service role full access to AI actions" ON public.ai_employee_actions;
CREATE POLICY "Service role full access to AI actions" ON public.ai_employee_actions
    FOR ALL USING (true) WITH CHECK (true);

-- Task log policies
DROP POLICY IF EXISTS "Users can view company task logs" ON public.ai_agent_task_log;
CREATE POLICY "Users can view company task logs" ON public.ai_agent_task_log
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Service role full access to task logs" ON public.ai_agent_task_log;
CREATE POLICY "Service role full access to task logs" ON public.ai_agent_task_log
    FOR ALL USING (true) WITH CHECK (true);

-- ─── 7. Updated_at trigger for memory table ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_ai_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_employee_memory_updated_at ON public.ai_employee_memory;
CREATE TRIGGER update_ai_employee_memory_updated_at
    BEFORE UPDATE ON public.ai_employee_memory
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_ai_memory_updated_at();
