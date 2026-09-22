-- Migration: 20260921120000_partner_system_enhancements.sql
-- Description: Add unique attribution index, partner payout request RPC, and admin settle payout RPC

-- 1. Partial unique index to prevent duplicate attribution of the same company
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_referrals_unique_company
ON public.partner_referrals (referred_company_id)
WHERE referred_company_id IS NOT NULL;

-- 2. Partner Payout Insert Policy for authenticated partners
DROP POLICY IF EXISTS "Partners can insert payout request" ON public.partner_payouts;
CREATE POLICY "Partners can insert payout request"
ON public.partner_payouts FOR INSERT
TO authenticated
WITH CHECK (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    AND status = 'pending'
);

-- 3. Atomic RPC for Requesting Payouts by Partner
CREATE OR REPLACE FUNCTION public.request_partner_payout(
    p_amount NUMERIC,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_partner_id UUID;
    v_pending NUMERIC;
    v_payout_id UUID;
    v_min_threshold NUMERIC := 1000; -- Min ₹1,000 for payout request
BEGIN
    -- Check caller is partner
    SELECT id, pending_earnings INTO v_partner_id, v_pending
    FROM public.partners
    WHERE user_id = auth.uid();

    IF v_partner_id IS NULL THEN
        RAISE EXCEPTION 'Caller is not registered as a partner';
    END IF;

    IF p_amount < v_min_threshold THEN
        RAISE EXCEPTION 'Minimum payout request amount is ₹%', v_min_threshold;
    END IF;

    IF p_amount > v_pending THEN
        RAISE EXCEPTION 'Requested amount (₹%) exceeds available pending earnings (₹%)', p_amount, v_pending;
    END IF;

    -- Insert payout record with pending status
    INSERT INTO public.partner_payouts (
        partner_id,
        amount,
        reference_number,
        payment_method,
        status,
        notes,
        created_at
    ) VALUES (
        v_partner_id,
        p_amount,
        'REQ-' || to_char(now(), 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6),
        'bank_transfer',
        'pending',
        p_notes,
        now()
    ) RETURNING id INTO v_payout_id;

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'amount', p_amount,
        'status', 'pending'
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_partner_payout(NUMERIC, TEXT) TO authenticated;

-- 4. Atomic RPC for Admin to Settle Payout
CREATE OR REPLACE FUNCTION public.admin_settle_partner_payout(
    p_payout_id UUID,
    p_reference_number TEXT,
    p_payment_method TEXT DEFAULT 'bank_transfer',
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_payout RECORD;
    v_partner RECORD;
BEGIN
    -- Verify platform admin
    SELECT EXISTS (
        SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only platform admins can settle partner payouts';
    END IF;

    -- Fetch payout record
    SELECT * INTO v_payout
    FROM public.partner_payouts
    WHERE id = p_payout_id;

    IF v_payout IS NULL THEN
        RAISE EXCEPTION 'Payout record not found';
    END IF;

    IF v_payout.status = 'completed' THEN
        RAISE EXCEPTION 'Payout is already marked as completed';
    END IF;

    -- Fetch partner
    SELECT * INTO v_partner
    FROM public.partners
    WHERE id = v_payout.partner_id;

    -- Update partner earnings
    UPDATE public.partners
    SET
        paid_earnings = COALESCE(paid_earnings, 0) + v_payout.amount,
        pending_earnings = GREATEST(0, COALESCE(pending_earnings, 0) - v_payout.amount),
        updated_at = now()
    WHERE id = v_payout.partner_id;

    -- Update payout record
    UPDATE public.partner_payouts
    SET
        status = 'completed',
        reference_number = COALESCE(p_reference_number, v_payout.reference_number),
        payment_method = COALESCE(p_payment_method, v_payout.payment_method),
        notes = CASE WHEN p_admin_notes IS NOT NULL THEN p_admin_notes ELSE notes END,
        paid_at = now()
    WHERE id = p_payout_id;

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', p_payout_id,
        'partner_id', v_payout.partner_id,
        'amount', v_payout.amount,
        'status', 'completed'
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_settle_partner_payout(UUID, TEXT, TEXT, TEXT) TO authenticated;
