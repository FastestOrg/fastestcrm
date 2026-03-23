import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

const UNLOCK_COST = 100000;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('No authorization header')

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: userError } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''))
        if (userError || !user) throw new Error('Not authenticated')

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single()

        if (!profile?.company_id) throw new Error('No company found')
        const companyId = profile.company_id

        // 1. Check if already unlocked (redundant check but good for safety)
        const { data: company } = await supabaseAdmin
            .from('companies')
            .select('custom_leads_table')
            .eq('id', companyId)
            .single()

        if (company?.custom_leads_table) {
            throw new Error('Feature already unlocked');
        }

        // 2. Check Wallet
        const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('company_id', companyId)
            .single()

        const currentBalance = wallet ? Number(wallet.balance) : 0
        if (currentBalance < UNLOCK_COST) {
            // Check if we need to return a specific error code for frontend to redirect
            // For now, returning a 402 Payment Required or just a specific message
            throw new Error(`Insufficient wallet balance. Required: ₹${UNLOCK_COST}, Available: ₹${currentBalance}. Please add money.`);
        }

        // 3. Deduct Balance
        const { error: walletError } = await supabaseAdmin
            .from('wallets')
            .update({ balance: currentBalance - UNLOCK_COST, updated_at: new Date().toISOString() })
            .eq('company_id', companyId);

        if (walletError) throw new Error('Wallet deduction failed');

        // 4. Log Transaction
        await supabaseAdmin.from('wallet_transactions').insert({
            wallet_id: companyId,
            amount: UNLOCK_COST,
            type: 'debit_manual_adjustment',
            description: `Unlocked Feature: Custom Lead Attributes`,
            status: 'success'
        });

        // 5. Call RPC to Enable Custom Table
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('enable_custom_leads_table', {
            input_company_id: companyId
        });

        if (rpcError) {
            // Refund? 
            // In a real system, we should have transactions. 
            // Here, we try to refund if RPC fails.
            await supabaseAdmin
                .from('wallets')
                .update({ balance: currentBalance, updated_at: new Date().toISOString() })
                .eq('company_id', companyId);

            await supabaseAdmin.from('wallet_transactions').insert({
                wallet_id: companyId,
                amount: UNLOCK_COST,
                type: 'credit_manual_adjustment',
                description: `Refund: Feature Unlock Failed`,
                status: 'success'
            });

            throw new Error('Failed to enable custom leads table: ' + rpcError.message);
        }

        const response = rpcData as any;
        if (!response.success) {
            // Refund
            await supabaseAdmin
                .from('wallets')
                .update({ balance: currentBalance, updated_at: new Date().toISOString() })
                .eq('company_id', companyId);

            await supabaseAdmin.from('wallet_transactions').insert({
                wallet_id: companyId,
                amount: UNLOCK_COST,
                type: 'credit_manual_adjustment',
                description: `Refund: Feature Unlock Failed (${response.message})`,
                status: 'success'
            });

            throw new Error(response.message);
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Unlocked successfully' }),
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
