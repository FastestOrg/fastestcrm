-- Backfill data from integration_api_keys to ai_caller_logs
INSERT INTO public.ai_caller_logs (
    id,
    user_id,
    company_id,
    lead_id,
    lead_phone,
    lead_name,
    agent_id,
    automation_id,
    status,
    call_id,
    duration_seconds,
    call_recording,
    error,
    created_at,
    ended_at
)
SELECT
    id,
    user_id,
    company_id,
    CASE 
        WHEN (api_key::jsonb->>'lead_id') = '' OR (api_key::jsonb->>'lead_id') IS NULL THEN NULL 
        ELSE (api_key::jsonb->>'lead_id')::uuid 
    END,
    COALESCE(api_key::jsonb->>'lead_phone', ''),
    COALESCE(api_key::jsonb->>'lead_name', 'Unknown'),
    CASE 
        WHEN (api_key::jsonb->>'agent_id') = '' OR (api_key::jsonb->>'agent_id') IS NULL THEN NULL 
        ELSE (api_key::jsonb->>'agent_id')::uuid 
    END,
    CASE 
        WHEN (api_key::jsonb->>'automation_id') = '' OR (api_key::jsonb->>'automation_id') IS NULL THEN NULL 
        ELSE (api_key::jsonb->>'automation_id')::uuid 
    END,
    COALESCE(api_key::jsonb->>'status', 'pending'),
    api_key::jsonb->>'call_id',
    COALESCE((api_key::jsonb->>'duration_seconds')::integer, 0),
    api_key::jsonb->>'call_recording',
    api_key::jsonb->>'error',
    created_at,
    CASE 
        WHEN (api_key::jsonb->>'ended_at') = '' OR (api_key::jsonb->>'ended_at') IS NULL THEN NULL 
        ELSE (api_key::jsonb->>'ended_at')::timestamp with time zone 
    END
FROM public.integration_api_keys
WHERE service_name = 'ai_call_queue'
ON CONFLICT (id) DO NOTHING;

-- Optionally clean up the old logs from integration_api_keys to prevent duplication / confusion
DELETE FROM public.integration_api_keys
WHERE service_name = 'ai_call_queue';
