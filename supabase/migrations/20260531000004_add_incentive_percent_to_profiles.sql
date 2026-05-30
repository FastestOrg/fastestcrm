-- Migration: Add incentive_percent column to profiles table

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN incentive_percent NUMERIC DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Ensure Company Admins can update profiles in their company for managing settings like manager_id and incentive_percent
DROP POLICY IF EXISTS "Admins can update company profiles" ON public.profiles;

CREATE POLICY "Admins can update company profiles"
  ON public.profiles FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'company') OR
    public.has_role(auth.uid(), 'company_subadmin')
  );
