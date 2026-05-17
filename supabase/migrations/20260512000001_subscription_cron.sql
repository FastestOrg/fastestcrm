-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for HTTP requests from within Postgres
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the subscription renewal reminder function
-- Runs at 1:00 PM (13:00) on Monday (1), Wednesday (3), and Friday (5)
-- This skips Sunday and runs on alternative days as requested.

SELECT cron.schedule(
    'subscription-renewal-reminder', -- name of the cron job
    '0 13 * * 1,3,5',                -- cron expression (1:00 PM Mon, Wed, Fri)
    $$
    SELECT
      net.http_post(
        url := (SELECT value FROM secrets.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/subscription-renewal-cron',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM secrets.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
        ),
        body := '{}'::jsonb
      ) as request_id;
    $$
);

-- If you don't have secrets.decrypted_secrets available (e.g. older Supabase), 
-- you might need to hardcode or use another method to get the keys.
-- But the above is the standard way for Supabase projects with Vault/Secrets.

-- Alternative for projects without Vault:
-- SELECT cron.schedule(
--     'subscription-renewal-reminder',
--     '0 13 * * 1,3,5',
--     'SELECT net.http_post(''https://uykdyqdeyilpulaqlqip.supabase.co/functions/v1/subscription-renewal-cron'', ''{}'', ''{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'')'
-- );
