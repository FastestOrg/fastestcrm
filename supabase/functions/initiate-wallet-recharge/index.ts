import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

interface RechargeRequest {
    amount: number;
    discount_code?: string;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        // Get auth token
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('No authorization header')
        }

        // Create client with user's token
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''))
        if (userError || !user) {
            throw new Error('Not authenticated')
        }

        // Get user's company
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single()

        if (!profile?.company_id) {
            throw new Error('No company associated with this user')
        }

        const companyId = profile.company_id

        const body: RechargeRequest = await req.json()
        const { amount, discount_code } = body

        if (!amount || amount < 100) { // Minimum recharge 100
            throw new Error('Minimum recharge amount is 100')
        }

        let payableAmount = amount;
        let discountApplied = 0;
        let appliedCode = null;

        if (discount_code) {
            const { data: codeData, error: codeError } = await supabaseAdmin
                .from('discount_codes')
                .select('*')
                .eq('code', discount_code)
                .eq('active', true)
                .maybeSingle()

            if (codeData) {
                // Check validity
                if (codeData.valid_until && new Date(codeData.valid_until) < new Date()) {
                    // Expired
                } else if (codeData.total_uses && codeData.uses_count >= codeData.total_uses) {
                    // Usage limit reached
                } else {
                    // Apply discount
                    discountApplied = (amount * codeData.discount_percentage) / 100
                    payableAmount = amount - discountApplied
                    appliedCode = discount_code
                }
            }
        }

        // Razorpay Order
        const rzpKeyId = Deno.env.get('RZP_KEY_ID')
        const rzpKeySecret = Deno.env.get('RZP_KEY_SECRET')

        if (!rzpKeyId || !rzpKeySecret) {
            throw new Error('Razorpay credentials not configured')
        }

        const orderAmountPaise = Math.round(payableAmount * 100)

        const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(`${rzpKeyId}:${rzpKeySecret}`)
            },
            body: JSON.stringify({
                amount: orderAmountPaise,
                currency: 'INR',
                receipt: `wal_${Date.now()}`,
                notes: {
                    company_id: companyId,
                    type: 'wallet_recharge',
                    credit_amount: amount, // Amount to be credited
                    discount_code: appliedCode
                }
            })
        })

        if (!orderResponse.ok) {
            const err = await orderResponse.text()
            console.error('Razorpay Error', err)
            throw new Error('Failed to create payment order')
        }

        const order = await orderResponse.json()

        // Create Pending Transaction
        const { error: txError } = await supabaseAdmin
            .from('wallet_transactions')
            .insert({
                wallet_id: companyId,
                amount: amount, // We credit the FULL requested amount, even if they paid less? 
                // Plan said: "Usage of discount code applies to the RECHARGE"
                // e.g. Recharge 1000, 10% off -> Pay 900, Get 1000 credits. Correct.
                type: 'credit_recharge',
                description: `Wallet Recharge via Razorpay${appliedCode ? ` (Code: ${appliedCode})` : ''}`,
                reference_id: order.id,
                status: 'pending',
                metadata: {
                    payable_amount: payableAmount,
                    discount_code: appliedCode,
                    discount_amount: discountApplied,
                    razorpay_order_id: order.id
                }
            })

        if (txError) {
            console.error('TX Error', txError)
            throw new Error('Failed to log transaction')
        }

        return new Response(
            JSON.stringify({
                order_id: order.id,
                amount: payableAmount, // Amount to pay
                currency: 'INR',
                key_id: rzpKeyId,
                credit_amount: amount,
                discount_applied: discountApplied
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
