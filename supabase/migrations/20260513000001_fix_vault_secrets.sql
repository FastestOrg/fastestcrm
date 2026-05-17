-- Fix: All trigger functions that reference secrets.decrypted_secrets directly
-- are failing because the Vault extension / pgsodium is not available.
-- This migration replaces those functions with safe versions that use a helper.

-- 1. Create a safe helper function to read vault secrets with graceful fallback
CREATE OR REPLACE FUNCTION public.safe_get_secret(secret_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  BEGIN
    SELECT value INTO secret_value FROM secrets.decrypted_secrets WHERE name = secret_name LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Vault not available — return NULL gracefully
    secret_value := NULL;
  END;
  RETURN secret_value;
END;
$$;

-- 2. Fix notify_via_edge_function to use safe helper
CREATE OR REPLACE FUNCTION public.notify_via_edge_function(payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  supabase_url := public.safe_get_secret('SUPABASE_URL');
  service_role_key := public.safe_get_secret('SUPABASE_SERVICE_ROLE_KEY');

  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := payload
    );
  END IF;
END;
$$;

-- 3. Fix on_lead_assigned_trigger — the main culprit causing lead insert failures
CREATE OR REPLACE FUNCTION public.on_lead_assigned_trigger()
RETURNS TRIGGER AS $$
DECLARE
  app_url TEXT;
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fix on_wallet_balance_check
CREATE OR REPLACE FUNCTION public.on_wallet_balance_check()
RETURNS TRIGGER AS $$
DECLARE
  company_admin_id UUID;
  app_url TEXT;
BEGIN
  IF NEW.balance < 500 AND (OLD.balance IS NULL OR OLD.balance >= 500) THEN
    SELECT admin_id INTO company_admin_id FROM public.companies WHERE id = NEW.company_id;
    
    IF company_admin_id IS NOT NULL THEN
      app_url := COALESCE(public.safe_get_secret('APP_URL'), '');

      PERFORM public.notify_via_edge_function(
        jsonb_build_object(
          'user_id', company_admin_id,
          'title', 'Low Wallet Balance',
          'message', 'Your company wallet balance is below ₹500. Please recharge soon to avoid subscription interruption.',
          'type', 'billing_alert',
          'send_email', true,
          'email_type', 'warning',
          'cta_text', 'Recharge Now',
          'cta_url', app_url || '/dashboard/settings?tab=billing'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fix on_license_limit_check
CREATE OR REPLACE FUNCTION public.on_license_limit_check()
RETURNS TRIGGER AS $$
DECLARE
  app_url TEXT;
BEGIN
  IF (NEW.used_licenses::float / NEW.total_licenses::float) > 0.9 AND 
     ((OLD.used_licenses::float / OLD.total_licenses::float) <= 0.9 OR OLD.used_licenses IS NULL) THEN
    
    app_url := COALESCE(public.safe_get_secret('APP_URL'), '');

    PERFORM public.notify_via_edge_function(
      jsonb_build_object(
        'user_id', NEW.admin_id,
        'title', 'License Limit Warning',
        'message', 'You have used ' || NEW.used_licenses || ' out of ' || NEW.total_licenses || ' available licenses. Consider purchasing more seats.',
        'type', 'system_alert',
        'send_email', true,
        'email_type', 'warning',
        'cta_text', 'Buy Licenses',
        'cta_url', app_url || '/dashboard/settings?tab=billing'
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
