-- Migration: Fix 42704 unrecognized configuration parameter app.settings.service_role_key
-- Ensures lead insertion triggers never crash when app GUC settings or vault secrets are missing.

-- 1. Create fail-proof safe_get_secret function
CREATE OR REPLACE FUNCTION public.safe_get_secret(secret_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  -- Attempt 1: GUC setting with missing_ok = true (second arg true prevents error 42704)
  BEGIN
    secret_value := current_setting('app.settings.' || secret_name, true);
    IF secret_value IS NOT NULL AND secret_value <> '' THEN
      RETURN secret_value;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    secret_value := NULL;
  END;

  -- Attempt 2: vault / decrypted_secrets table
  BEGIN
    SELECT value INTO secret_value FROM secrets.decrypted_secrets WHERE name = secret_name LIMIT 1;
    IF secret_value IS NOT NULL AND secret_value <> '' THEN
      RETURN secret_value;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    secret_value := NULL;
  END;

  RETURN NULL;
END;
$$;

-- 2. Update notify_via_edge_function to catch all errors gracefully
CREATE OR REPLACE FUNCTION public.notify_via_edge_function(payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  BEGIN
    supabase_url := public.safe_get_secret('SUPABASE_URL');
    service_role_key := public.safe_get_secret('SUPABASE_SERVICE_ROLE_KEY');

    IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL AND supabase_url <> '' AND service_role_key <> '' THEN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := payload
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Suppress all http_post or secret resolution errors to protect table insertions
    NULL;
  END;
END;
$$;

-- 3. Update on_lead_assigned_trigger to catch all errors gracefully
CREATE OR REPLACE FUNCTION public.on_lead_assigned_trigger()
RETURNS TRIGGER AS $$
DECLARE
  app_url TEXT;
BEGIN
  BEGIN
    IF (TG_OP = 'UPDATE' AND NEW.sales_owner_id IS DISTINCT FROM OLD.sales_owner_id AND NEW.sales_owner_id IS NOT NULL) OR
       (TG_OP = 'INSERT' AND NEW.sales_owner_id IS NOT NULL) THEN
      
      app_url := COALESCE(public.safe_get_secret('APP_URL'), '');

      PERFORM public.notify_via_edge_function(
        jsonb_build_object(
          'user_id', NEW.sales_owner_id,
          'title', 'New Lead Assigned!',
          'message', 'A new lead "' || COALESCE(NEW.name, 'Unknown') || '" has been assigned to you. Time to close the deal!',
          'type', 'lead_assigned',
          'lead_id', NEW.id,
          'send_email', true,
          'email_type', 'success',
          'cta_text', 'View Lead',
          'cta_url', app_url || '/dashboard/leads?id=' || NEW.id
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never block lead creation due to notification failure
    NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
