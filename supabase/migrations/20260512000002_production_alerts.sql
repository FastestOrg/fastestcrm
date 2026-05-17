-- 1. Function to call send-notification edge function via pg_net
CREATE OR REPLACE FUNCTION public.notify_via_edge_function(payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get secrets from vault (standard Supabase)
  SELECT value INTO supabase_url FROM secrets.decrypted_secrets WHERE name = 'SUPABASE_URL';
  SELECT value INTO service_role_key FROM secrets.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

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

-- 2. Trigger for Lead Assignment
CREATE OR REPLACE FUNCTION public.on_lead_assigned_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if sales_owner_id was updated and is not null
  IF (TG_OP = 'UPDATE' AND NEW.sales_owner_id IS DISTINCT FROM OLD.sales_owner_id AND NEW.sales_owner_id IS NOT NULL) OR
     (TG_OP = 'INSERT' AND NEW.sales_owner_id IS NOT NULL) THEN
    
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
        'cta_url', (SELECT value FROM secrets.decrypted_secrets WHERE name = 'APP_URL') || '/dashboard/leads?id=' || NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply Lead Assignment Trigger to all lead tables
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND (tablename = 'leads' OR tablename LIKE 'leads_%')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_notify_lead_assigned ON public.%I;', table_record.tablename);
        EXECUTE format('CREATE TRIGGER trigger_notify_lead_assigned AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.on_lead_assigned_trigger();', table_record.tablename);
    END LOOP;
END $$;

-- 3. Trigger for Low Wallet Balance
CREATE OR REPLACE FUNCTION public.on_wallet_balance_check()
RETURNS TRIGGER AS $$
DECLARE
  company_admin_id UUID;
BEGIN
  -- If balance drops below 500
  IF NEW.balance < 500 AND (OLD.balance IS NULL OR OLD.balance >= 500) THEN
    -- Get company admin
    SELECT admin_id INTO company_admin_id FROM public.companies WHERE id = NEW.company_id;
    
    IF company_admin_id IS NOT NULL THEN
      PERFORM public.notify_via_edge_function(
        jsonb_build_object(
          'user_id', company_admin_id,
          'title', 'Low Wallet Balance',
          'message', 'Your company wallet balance is below ₹500. Please recharge soon to avoid subscription interruption.',
          'type', 'billing_alert',
          'send_email', true,
          'email_type', 'warning',
          'cta_text', 'Recharge Now',
          'cta_url', (SELECT value FROM secrets.decrypted_secrets WHERE name = 'APP_URL') || '/dashboard/settings?tab=billing'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_wallet_balance ON public.wallets;
CREATE TRIGGER trigger_check_wallet_balance
  AFTER UPDATE OF balance ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.on_wallet_balance_check();

-- 4. Trigger for License Limits
CREATE OR REPLACE FUNCTION public.on_license_limit_check()
RETURNS TRIGGER AS $$
BEGIN
  -- If used licenses > 90% of total
  IF (NEW.used_licenses::float / NEW.total_licenses::float) > 0.9 AND 
     ((OLD.used_licenses::float / OLD.total_licenses::float) <= 0.9 OR OLD.used_licenses IS NULL) THEN
    
    PERFORM public.notify_via_edge_function(
      jsonb_build_object(
        'user_id', NEW.admin_id,
        'title', 'License Limit Warning',
        'message', 'You have used ' || NEW.used_licenses || ' out of ' || NEW.total_licenses || ' available licenses. Consider purchasing more seats.',
        'type', 'system_alert',
        'send_email', true,
        'email_type', 'warning',
        'cta_text', 'Buy Licenses',
        'cta_url', (SELECT value FROM secrets.decrypted_secrets WHERE name = 'APP_URL') || '/dashboard/settings?tab=billing'
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_license_limit ON public.companies;
CREATE TRIGGER trigger_check_license_limit
  AFTER UPDATE OF used_licenses, total_licenses ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.on_license_limit_check();
