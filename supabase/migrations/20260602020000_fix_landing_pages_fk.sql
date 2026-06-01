-- Fix foreign key constraint on landing_pages.created_by
-- Change it to reference public.profiles(id) instead of auth.users(id)
-- so that Postgrest (Supabase API) can resolve the join on profiles table.

ALTER TABLE public.landing_pages
DROP CONSTRAINT landing_pages_created_by_fkey;

ALTER TABLE public.landing_pages
ADD CONSTRAINT landing_pages_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES public.profiles(id)
ON DELETE CASCADE;
