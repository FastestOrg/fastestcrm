-- Create ai_caller_logs table
CREATE TABLE IF NOT EXISTS public.ai_caller_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    lead_id UUID,
    lead_phone TEXT NOT NULL,
    lead_name TEXT,
    agent_id UUID REFERENCES public.integration_api_keys(id) ON DELETE SET NULL,
    automation_id UUID,
    status TEXT NOT NULL DEFAULT 'pending',
    call_id TEXT,
    duration_seconds INTEGER DEFAULT 0,
    call_recording TEXT,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ended_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT ai_caller_logs_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.ai_caller_logs ENABLE ROW LEVEL SECURITY;

-- Policies for ai_caller_logs
CREATE POLICY "Users can view their company's ai_caller_logs"
    ON public.ai_caller_logs FOR SELECT
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert their company's ai_caller_logs"
    ON public.ai_caller_logs FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their company's ai_caller_logs"
    ON public.ai_caller_logs FOR UPDATE
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their company's ai_caller_logs"
    ON public.ai_caller_logs FOR DELETE
    USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Create indexes
CREATE INDEX IF NOT EXISTS ai_caller_logs_company_id_idx ON public.ai_caller_logs(company_id);
CREATE INDEX IF NOT EXISTS ai_caller_logs_created_at_idx ON public.ai_caller_logs(created_at DESC);
