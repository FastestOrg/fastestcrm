-- Agentic Workflows Core Schema

-- 1. AI Workflows Table
CREATE TABLE IF NOT EXISTS public.ai_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL, -- lead_created, status_changed, tag_added, inactivity, form_submitted, manual
    trigger_config JSONB DEFAULT '{}'::jsonB,
    steps JSONB DEFAULT '[]'::jsonB,
    outcome_goal TEXT NOT NULL, -- meeting_booked, demo_scheduled, sale_closed, etc.
    autonomy_mode TEXT NOT NULL DEFAULT 'guided', -- guided, full_pilot
    is_active BOOLEAN DEFAULT true,
    run_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. AI Workflow Executions Table
CREATE TABLE IF NOT EXISTS public.ai_workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.ai_workflows(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, rejected
    steps_log JSONB DEFAULT '[]'::jsonB,
    message_draft TEXT,
    outcome TEXT,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. AI Agent Outcomes Table
CREATE TABLE IF NOT EXISTS public.ai_agent_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES public.ai_workflow_executions(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES public.ai_workflows(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    goal_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. AI Ops Decisions Table (for Guided Mode)
CREATE TABLE IF NOT EXISTS public.ai_ops_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES public.ai_workflow_executions(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    decision_type TEXT NOT NULL, -- RE_ENGAGE, NURTURE, ESCALATE, STATUS_UPDATE, WORKFLOW_ACTION
    reasoning TEXT,
    status TEXT NOT NULL DEFAULT 'pending_approval', -- pending_approval, executed, rejected
    action_details JSONB DEFAULT '{}'::jsonB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_ops_decisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company workflows" ON public.ai_workflows
    FOR SELECT USING (auth.uid() IN (SELECT id FROM public.profiles WHERE company_id = ai_workflows.company_id));

CREATE POLICY "Users can manage their company workflows" ON public.ai_workflows
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE company_id = ai_workflows.company_id AND has_role(id, 'company'::app_role)));

CREATE POLICY "Users can view their company workflow executions" ON public.ai_workflow_executions
    FOR SELECT USING (auth.uid() IN (SELECT id FROM public.profiles WHERE company_id = ai_workflow_executions.company_id));

CREATE POLICY "Users can view their company outcomes" ON public.ai_agent_outcomes
    FOR SELECT USING (auth.uid() IN (SELECT id FROM public.profiles WHERE company_id = ai_agent_outcomes.company_id));

CREATE POLICY "Users can view and update their company decisions" ON public.ai_ops_decisions
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE company_id = ai_ops_decisions.company_id));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_ai_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_workflows_updated_at BEFORE UPDATE ON public.ai_workflows FOR EACH ROW EXECUTE FUNCTION public.handle_ai_workflow_updated_at();
CREATE TRIGGER update_ai_workflow_executions_updated_at BEFORE UPDATE ON public.ai_workflow_executions FOR EACH ROW EXECUTE FUNCTION public.handle_ai_workflow_updated_at();
CREATE TRIGGER update_ai_ops_decisions_updated_at BEFORE UPDATE ON public.ai_ops_decisions FOR EACH ROW EXECUTE FUNCTION public.handle_ai_workflow_updated_at();

-- Trigger Function for Lead changes
CREATE OR REPLACE FUNCTION public.process_ai_workflow_trigger()
RETURNS TRIGGER AS $$
DECLARE
    wf_record RECORD;
    should_trigger BOOLEAN;
BEGIN
    -- Only process active workflows for this company
    FOR wf_record IN 
        SELECT id, trigger_type, trigger_config 
        FROM public.ai_workflows 
        WHERE company_id = NEW.company_id 
          AND is_active = true
    LOOP
        should_trigger := false;

        -- 1. Lead Created
        IF wf_record.trigger_type = 'lead_created' AND TG_OP = 'INSERT' THEN
            should_trigger := true;
        
        -- 2. Status Changed
        ELSIF wf_record.trigger_type = 'status_changed' AND TG_OP = 'UPDATE' THEN
            IF OLD.status IS DISTINCT FROM NEW.status AND (wf_record.trigger_config->>'to_status' IS NULL OR wf_record.trigger_config->>'to_status' = NEW.status) THEN
                should_trigger := true;
            END IF;

        -- 3. Tag Added (assuming tags are in lead_profile or a tags column)
        ELSIF wf_record.trigger_type = 'tag_added' AND TG_OP = 'UPDATE' THEN
            -- Simplified check: if trigger_config has a tag, check if it's now present
            IF wf_record.trigger_config->>'tag' IS NOT NULL THEN
                -- Implementation depends on how tags are stored. Assuming a JSONB tags array for now.
                IF (NEW.lead_profile->'tags') ? (wf_record.trigger_config->>'tag') AND NOT ((OLD.lead_profile->'tags') ? (wf_record.trigger_config->>'tag')) THEN
                    should_trigger := true;
                END IF;
            END IF;
        END IF;

        -- If matched, log a pending execution
        IF should_trigger THEN
            INSERT INTO public.ai_workflow_executions (workflow_id, lead_id, company_id, status)
            VALUES (wf_record.id, NEW.id, NEW.company_id, 'pending');
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to leads table
DROP TRIGGER IF EXISTS trigger_ai_workflows_leads ON public.leads;
CREATE TRIGGER trigger_ai_workflows_leads
AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.process_ai_workflow_trigger();

-- Helper function to increment workflow run count
CREATE OR REPLACE FUNCTION public.increment_workflow_run_count(wf_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.ai_workflows 
    SET run_count = run_count + 1 
    WHERE id = wf_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

