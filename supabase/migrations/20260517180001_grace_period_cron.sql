-- Schedule the subscription grace period enforcer
-- Runs daily at 2:00 AM IST (8:30 PM UTC previous day)

SELECT cron.schedule(
    'subscription-grace-enforcer',  -- name of the cron job
    '30 20 * * *',                  -- cron expression: 8:30 PM UTC = 2:00 AM IST daily
    $$
    SELECT
      net.http_post(
        url := (SELECT value FROM secrets.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/subscription-grace-enforcer',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM secrets.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
        ),
        body := '{}'::jsonb
      ) as request_id;
    $$
);
