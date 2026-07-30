-- Migration to create reset_user_password RPC function for resetting team member passwords
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.reset_user_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_id UUID;
  caller_role TEXT;
  target_role TEXT;
  caller_company_id UUID;
  target_company_id UUID;
  caller_level INT;
  target_level INT;
BEGIN
  -- Get requesting user ID from auth context
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF new_password IS NULL OR length(trim(new_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  IF length(new_password) > 72 THEN
    RAISE EXCEPTION 'Password must be less than 72 characters';
  END IF;

  -- Get caller profile and role
  SELECT company_id INTO caller_company_id FROM public.profiles WHERE id = caller_id;
  SELECT role INTO caller_role FROM public.user_roles WHERE user_id = caller_id;

  -- Get target profile and role
  SELECT company_id INTO target_company_id FROM public.profiles WHERE id = target_user_id;
  SELECT role INTO target_role FROM public.user_roles WHERE user_id = target_user_id;

  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  -- Determine role levels
  caller_level := CASE caller_role
    WHEN 'platform_admin' THEN 0
    WHEN 'company' THEN 1
    WHEN 'company_subadmin' THEN 2
    WHEN 'cbo' THEN 3 WHEN 'level_3' THEN 3
    WHEN 'vp' THEN 4 WHEN 'level_4' THEN 4
    WHEN 'avp' THEN 5 WHEN 'level_5' THEN 5
    WHEN 'dgm' THEN 6 WHEN 'level_6' THEN 6
    WHEN 'agm' THEN 7 WHEN 'level_7' THEN 7
    WHEN 'sm' THEN 8 WHEN 'level_8' THEN 8
    WHEN 'tl' THEN 9 WHEN 'level_9' THEN 9
    WHEN 'bde' THEN 10 WHEN 'level_10' THEN 10
    WHEN 'intern' THEN 11 WHEN 'level_11' THEN 11
    WHEN 'ca' THEN 12 WHEN 'level_12' THEN 12
    ELSE 99
  END;

  target_level := CASE target_role
    WHEN 'platform_admin' THEN 0
    WHEN 'company' THEN 1
    WHEN 'company_subadmin' THEN 2
    WHEN 'cbo' THEN 3 WHEN 'level_3' THEN 3
    WHEN 'vp' THEN 4 WHEN 'level_4' THEN 4
    WHEN 'avp' THEN 5 WHEN 'level_5' THEN 5
    WHEN 'dgm' THEN 6 WHEN 'level_6' THEN 6
    WHEN 'agm' THEN 7 WHEN 'level_7' THEN 7
    WHEN 'sm' THEN 8 WHEN 'level_8' THEN 8
    WHEN 'tl' THEN 9 WHEN 'level_9' THEN 9
    WHEN 'bde' THEN 10 WHEN 'level_10' THEN 10
    WHEN 'intern' THEN 11 WHEN 'level_11' THEN 11
    WHEN 'ca' THEN 12 WHEN 'level_12' THEN 12
    ELSE 99
  END;

  -- Permission checks
  IF caller_role != 'platform_admin' THEN
    IF caller_company_id IS NULL OR target_company_id IS NULL OR caller_company_id != target_company_id THEN
      RAISE EXCEPTION 'You can only reset passwords for users within your company';
    END IF;

    IF caller_level >= target_level THEN
      RAISE EXCEPTION 'You can only reset passwords for team members below your role level';
    END IF;
  END IF;

  -- Update auth.users password using bcrypt hash
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = NOW()
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully');
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.reset_user_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_user_password(UUID, TEXT) TO service_role;
