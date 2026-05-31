-- Create public RPC function to fetch limited profile info securely
CREATE OR REPLACE FUNCTION public.get_public_profile_info(profile_id UUID)
RETURNS TABLE (full_name TEXT, avatar_url TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT full_name, avatar_url
  FROM public.profiles
  WHERE id = profile_id;
$$;

-- Grant execution permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_public_profile_info(UUID) TO anon, authenticated;
