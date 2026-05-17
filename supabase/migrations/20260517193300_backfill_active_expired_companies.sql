-- Update any company whose subscription is expired but is still technically marked as active
-- This will trigger the handle_subscription_grace_period() trigger to instantly:
--   1. Set grace_period_start to NOW()
--   2. Set data_deletion_scheduled_at to NOW() + 180 days
--   3. Deactivate all non-admin profiles in the company
UPDATE public.companies
SET subscription_status = 'past_due'
WHERE subscription_status = 'active'
  AND subscription_valid_until < NOW();
