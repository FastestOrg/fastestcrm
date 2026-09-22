-- Migration: Partner Profiles Attribute and Deal Protection Sync
-- Adds partner attribute directly to profiles and ensures bi-directional sync with partners table

-- 1. Add partner columns to public.profiles if they do not exist
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS partner_category TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS partner_referral_code TEXT DEFAULT NULL;

-- 2. Backfill existing partner users into public.profiles
UPDATE public.profiles p
SET 
  is_partner = TRUE,
  partner_category = pt.category,
  partner_referral_code = pt.referral_code
FROM public.partners pt
WHERE p.id = pt.user_id;

-- 3. Create or replace trigger function to sync partner changes into profiles
CREATE OR REPLACE FUNCTION public.sync_partner_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If partner has a linked user_id, update profile
  IF NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      is_partner = (NEW.status = 'active'),
      partner_category = NEW.category,
      partner_referral_code = NEW.referral_code,
      updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_partner_to_profile ON public.partners;
CREATE TRIGGER trg_sync_partner_to_profile
  AFTER INSERT OR UPDATE OF user_id, category, referral_code, status
  ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_partner_to_profile();

-- 4. Create trigger on public.profiles to automatically link partner account if created with same email
CREATE OR REPLACE FUNCTION public.link_partner_on_profile_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner RECORD;
BEGIN
  -- Look for partner record with same email that hasn't been claimed yet
  SELECT id, category, referral_code, status INTO v_partner
  FROM public.partners
  WHERE LOWER(email) = LOWER(NEW.email)
    AND user_id IS NULL
  LIMIT 1;

  IF FOUND THEN
    -- Link user_id to partner record
    UPDATE public.partners
    SET user_id = NEW.id,
        updated_at = NOW()
    WHERE id = v_partner.id;

    -- Update the new profile record
    NEW.is_partner := (v_partner.status = 'active');
    NEW.partner_category := v_partner.category;
    NEW.partner_referral_code := v_partner.referral_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_partner_on_profile_create ON public.profiles;
CREATE TRIGGER trg_link_partner_on_profile_create
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.link_partner_on_profile_create();

-- 5. Index for fast lead deal protection lookup by admin_email
CREATE INDEX IF NOT EXISTS idx_partner_referrals_admin_email 
  ON public.partner_referrals (LOWER(admin_email)) 
  WHERE referred_company_id IS NULL;
