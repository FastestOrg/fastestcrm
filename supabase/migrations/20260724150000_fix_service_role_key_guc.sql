-- Migration: Fix unrecognized configuration parameter app.settings.service_role_key
-- Sets GUC parameter in current session & replaces any legacy current_setting calls in pg_proc

-- 1. Safely initialize session configuration parameter
DO $$
BEGIN
  PERFORM set_config('app.settings.service_role_key', '', false);
  PERFORM set_config('app.settings.supabase_url', '', false);
  PERFORM set_config('app.settings.byos_encryption_key', 'byos-default-key-change-in-production', false);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Dynamically find any function in pg_proc calling current_setting without missing_ok=true, and replace it
DO $$
DECLARE
  func_rec RECORD;
  new_body TEXT;
BEGIN
  FOR func_rec IN 
    SELECT p.oid, p.proname, n.nspname, pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.prokind = 'f'
      AND n.nspname IN ('public', 'vault', 'extensions') 
      AND pg_get_functiondef(p.oid) LIKE '%current_setting%service_role_key%'
  LOOP
    RAISE NOTICE 'Replacing legacy current_setting in function: %.%', func_rec.nspname, func_rec.proname;
    new_body := replace(
      func_rec.def, 
      'current_setting(''app.settings.service_role_key'')', 
      'current_setting(''app.settings.service_role_key'', true)'
    );
    EXECUTE new_body;
  END LOOP;
END $$;
