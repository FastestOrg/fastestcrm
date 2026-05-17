-- ============================================================================
-- Subscription Grace Period System
-- 
-- When a company's subscription expires and auto-debit fails:
--   1. grace_period_start is set to NOW()
--   2. data_deletion_scheduled_at is set to grace_period_start + 180 days
--   3. All non-admin profiles are deactivated (is_deactivated = true)
--
-- When subscription is reactivated:
--   1. Grace period fields are cleared
--   2. All profiles are reactivated
-- ============================================================================

-- Step 1: Add grace period columns to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS grace_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_deletion_scheduled_at TIMESTAMPTZ;

-- Step 2: Function to handle subscription expiry (trigger on status change)
CREATE OR REPLACE FUNCTION public.handle_subscription_grace_period()
RETURNS TRIGGER AS $$
BEGIN
  -- CASE 1: Subscription moved to expired state (past_due or canceled)
  IF (NEW.subscription_status IN ('past_due', 'canceled'))
     AND (OLD.subscription_status IS DISTINCT FROM NEW.subscription_status)
     AND (NEW.grace_period_start IS NULL)
  THEN
    -- Set grace period
    NEW.grace_period_start := NOW();
    NEW.data_deletion_scheduled_at := NOW() + INTERVAL '180 days';

    -- Deactivate all non-admin profiles in this company
    UPDATE public.profiles
    SET is_deactivated = true,
        updated_at = NOW()
    WHERE company_id = NEW.id
      AND id != NEW.admin_id
      AND (is_deactivated = false OR is_deactivated IS NULL);

    RAISE NOTICE 'Grace period started for company %: deletion scheduled at %',
      NEW.id, NEW.data_deletion_scheduled_at;
  END IF;

  -- CASE 2: Subscription reactivated
  IF (NEW.subscription_status = 'active')
     AND (OLD.subscription_status IS DISTINCT FROM 'active')
     AND (OLD.grace_period_start IS NOT NULL)
  THEN
    -- Clear grace period
    NEW.grace_period_start := NULL;
    NEW.data_deletion_scheduled_at := NULL;

    -- Reactivate all profiles in this company
    UPDATE public.profiles
    SET is_deactivated = false,
        updated_at = NOW()
    WHERE company_id = NEW.id
      AND is_deactivated = true;

    RAISE NOTICE 'Subscription reactivated for company %. Grace period cleared, users reactivated.', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create trigger on companies table
DROP TRIGGER IF EXISTS on_subscription_status_change ON public.companies;
CREATE TRIGGER on_subscription_status_change
  BEFORE UPDATE OF subscription_status ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_subscription_grace_period();

-- Step 4: Backfill existing expired companies
-- Companies already in past_due/canceled without a grace period get one starting NOW
UPDATE public.companies
SET grace_period_start = NOW(),
    data_deletion_scheduled_at = NOW() + INTERVAL '180 days'
WHERE subscription_status IN ('past_due', 'canceled')
  AND grace_period_start IS NULL;

-- Also deactivate non-admin users for those companies
UPDATE public.profiles p
SET is_deactivated = true,
    updated_at = NOW()
FROM public.companies c
WHERE p.company_id = c.id
  AND c.subscription_status IN ('past_due', 'canceled')
  AND c.grace_period_start IS NOT NULL
  AND p.id != c.admin_id
  AND (p.is_deactivated = false OR p.is_deactivated IS NULL);

-- Step 5: Index for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_companies_grace_period
  ON public.companies (data_deletion_scheduled_at)
  WHERE grace_period_start IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_subscription_status
  ON public.companies (subscription_status)
  WHERE subscription_status IN ('past_due', 'canceled');
