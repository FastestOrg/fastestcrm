import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        const { amount, code } = await req.json()

        if (!code) {
            throw new Error('Code is required')
        }
        if (!amount || amount <= 0) {
            throw new Error('Amount is required')
        }

        const cleanCode = String(code).trim().toUpperCase()

        // 1. Check standard discount_codes table
        const { data: codeData } = await supabaseAdmin
            .from('discount_codes')
            .select('*')
            .ilike('code', cleanCode)
            .eq('active', true)
            .maybeSingle()

        if (codeData) {
            if (codeData.valid_until && new Date(codeData.valid_until) < new Date()) {
                return new Response(
                    JSON.stringify({ valid: false, message: 'Code expired' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            if (codeData.total_uses && codeData.uses_count >= codeData.total_uses) {
                return new Response(
                    JSON.stringify({ valid: false, message: 'Usage limit reached' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const discountAmount = Math.round((amount * codeData.discount_percentage) / 100)
            const finalAmount = Math.max(0, amount - discountAmount)

            return new Response(
                JSON.stringify({
                    valid: true,
                    discount_percentage: codeData.discount_percentage,
                    discount_amount: discountAmount,
                    final_amount: finalAmount,
                    message: `Code applied: ${codeData.discount_percentage}% Off`
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Check partner referral codes (10% first recharge discount)
        const { data: partnerData } = await supabaseAdmin
            .from('partners')
            .select('id, referral_code, status, full_name')
            .ilike('referral_code', cleanCode)
            .eq('status', 'active')
            .maybeSingle()

        if (partnerData) {
            const discountPercentage = 10;
            const discountAmount = Math.round((amount * discountPercentage) / 100)
            const finalAmount = Math.max(0, amount - discountAmount)

            return new Response(
                JSON.stringify({
                    valid: true,
                    is_partner_code: true,
                    partner_id: partnerData.id,
                    discount_percentage: discountPercentage,
                    discount_amount: discountAmount,
                    final_amount: finalAmount,
                    message: `Partner Referral: ${discountPercentage}% Off First Topup`
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ valid: false, message: 'Invalid or inactive code' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
