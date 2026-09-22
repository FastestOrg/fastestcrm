-- Migration: 20260921110000_partner_program_system.sql
-- Description: Create tables and security policies for SaaS Partnership Program ecosystem

-- 1. Create partners table
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    company_name TEXT,
    website TEXT,
    phone TEXT,
    category TEXT NOT NULL DEFAULT 'affiliate' CHECK (category IN ('affiliate', 'agency', 'white_label')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
    referral_code TEXT UNIQUE NOT NULL,
    commission_rate NUMERIC DEFAULT 0, -- e.g. 40 for agency (% lifetime)
    fixed_monthly_cost NUMERIC DEFAULT 0, -- e.g. 50000 for white_label
    custom_terms JSONB DEFAULT '{}'::jsonb,
    payout_info JSONB DEFAULT '{"upi_id": "", "bank_name": "", "account_number": "", "ifsc_code": "", "pan_number": "", "gst_number": ""}'::jsonb,
    total_earnings NUMERIC DEFAULT 0,
    pending_earnings NUMERIC DEFAULT 0,
    paid_earnings NUMERIC DEFAULT 0,
    total_clicks NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for speedy referral lookup & user lookup
CREATE INDEX IF NOT EXISTS idx_partners_referral_code ON public.partners (referral_code);
CREATE INDEX IF NOT EXISTS idx_partners_user_id ON public.partners (user_id);
CREATE INDEX IF NOT EXISTS idx_partners_category ON public.partners (category);
CREATE INDEX IF NOT EXISTS idx_partners_status ON public.partners (status);

-- 2. Create partner_referrals table
CREATE TABLE IF NOT EXISTS public.partner_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    referred_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    admin_name TEXT,
    admin_email TEXT,
    plan_type TEXT DEFAULT 'quarterly', -- 'monthly', 'quarterly', 'annual'
    is_paid BOOLEAN DEFAULT false,
    first_topup_amount NUMERIC DEFAULT 0,
    first_topup_discount NUMERIC DEFAULT 0,
    total_revenue_generated NUMERIC DEFAULT 0,
    commission_earned NUMERIC DEFAULT 0,
    commission_status TEXT DEFAULT 'pending' CHECK (commission_status IN ('pending', 'approved', 'paid')),
    registered_at TIMESTAMPTZ DEFAULT now(),
    paid_at TIMESTAMPTZ,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner_id ON public.partner_referrals (partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_referred_company_id ON public.partner_referrals (referred_company_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_is_paid ON public.partner_referrals (is_paid);

-- 3. Create partner_payouts table
CREATE TABLE IF NOT EXISTS public.partner_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    reference_number TEXT,
    payment_method TEXT DEFAULT 'bank_transfer',
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'rejected')),
    notes TEXT,
    paid_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner_id ON public.partner_payouts (partner_id);

-- Enable RLS on all tables
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Partners can view their own record" ON public.partners;
DROP POLICY IF EXISTS "Anyone can insert partner record" ON public.partners;
DROP POLICY IF EXISTS "Platform admins full access to partners" ON public.partners;
DROP POLICY IF EXISTS "Partners can update own profile" ON public.partners;

DROP POLICY IF EXISTS "Partners can view their own referrals" ON public.partner_referrals;
DROP POLICY IF EXISTS "Public can create referral on signup" ON public.partner_referrals;
DROP POLICY IF EXISTS "Platform admins full access to referrals" ON public.partner_referrals;

DROP POLICY IF EXISTS "Partners can view their own payouts" ON public.partner_payouts;
DROP POLICY IF EXISTS "Platform admins full access to payouts" ON public.partner_payouts;

-- Partners RLS Policies
CREATE POLICY "Partners can view their own record"
ON public.partners FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

CREATE POLICY "Anyone can insert partner record"
ON public.partners FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Partners can update own profile"
ON public.partners FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
)
WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

CREATE POLICY "Platform admins full access to partners"
ON public.partners FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- Partner Referrals RLS Policies
CREATE POLICY "Partners can view their own referrals"
ON public.partner_referrals FOR SELECT
TO authenticated
USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

CREATE POLICY "Public can create referral on signup"
ON public.partner_referrals FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Platform admins full access to referrals"
ON public.partner_referrals FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- Partner Payouts RLS Policies
CREATE POLICY "Partners can view their own payouts"
ON public.partner_payouts FOR SELECT
TO authenticated
USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

CREATE POLICY "Platform admins full access to payouts"
ON public.partner_payouts FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
);

-- Function to automatically create 10% discount code in discount_codes when a partner is registered
CREATE OR REPLACE FUNCTION public.sync_partner_discount_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update discount_codes table with 10% discount
    INSERT INTO public.discount_codes (
        code,
        discount_percentage,
        active,
        uses_count,
        total_uses,
        valid_until,
        created_at
    ) VALUES (
        NEW.referral_code,
        10,
        true,
        0,
        100000,
        now() + interval '5 years',
        now()
    )
    ON CONFLICT (code) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_partner_discount_code ON public.partners;
CREATE TRIGGER trg_sync_partner_discount_code
AFTER INSERT ON public.partners
FOR EACH ROW
EXECUTE FUNCTION public.sync_partner_discount_code();

-- Function to atomically increment partner link clicks
CREATE OR REPLACE FUNCTION public.track_partner_click(p_code TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.partners
    SET total_clicks = COALESCE(total_clicks, 0) + 1
    WHERE referral_code = UPPER(TRIM(p_code)) AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.track_partner_click(TEXT) TO anon, authenticated, service_role;
