import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

const CHANGE_FEE = 10000;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        // user token is needed to identify the company admin
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('No authorization header')

        // Client to verify user
        const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(req.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''))
        if (userError || !user) throw new Error('Not authenticated')

        // Admin client for database operations
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        // Get company_id from profile
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single()

        if (!profile?.company_id) throw new Error('No company found for this user')
        const companyId = profile.company_id

        // 1. Check Wallet Balance
        const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('company_id', companyId)
            .single()

        const currentBalance = wallet ? Number(wallet.balance) : 0
        if (currentBalance < CHANGE_FEE) {
            throw new Error(`Insufficient wallet balance. Required: ₹${CHANGE_FEE.toLocaleString('en-IN')}, Available: ₹${currentBalance.toLocaleString('en-IN')}. Please recharge your wallet.`);
        }

        // 2. Process Transaction (Deduct Fee)
        const newBalance = currentBalance - CHANGE_FEE;
        const { error: walletError } = await supabaseAdmin
            .from('wallets')
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq('company_id', companyId);

        if (walletError) throw new Error('Wallet deduction failed');

        // Log Transaction
        await supabaseAdmin.from('wallet_transactions').insert({
            wallet_id: companyId,
            amount: CHANGE_FEE,
            type: 'debit_manual_adjustment',
            description: `Industry Change Request Fee`,
            status: 'success'
        });

        // 3. Reset Industry
        const { error: updateError } = await supabaseAdmin
            .from('companies')
            .update({
                industry: null,
                industry_locked: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', companyId);

        if (updateError) {
            console.error('Industry Reset Failed', updateError);
            throw new Error('Failed to reset industry settings. Please contact support.');
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Industry reset successfully',
                new_balance: newBalance
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
