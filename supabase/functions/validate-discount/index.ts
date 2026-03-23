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

        const { data: codeData } = await supabaseAdmin
            .from('discount_codes')
            .select('*')
            .eq('code', code)
            .eq('active', true)
            .maybeSingle()

        if (!codeData) {
            return new Response(
                JSON.stringify({ valid: false, message: 'Invalid or inactive code' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

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

        const discountAmount = (amount * codeData.discount_percentage) / 100
        const finalAmount = amount - discountAmount

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

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
