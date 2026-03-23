import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing authorization');

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) throw new Error('Unauthorized');

        const { feature, cost } = await req.json();
        if (!feature || !cost || cost <= 0) throw new Error('Invalid feature or cost');

        // Get user's company
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!profile?.company_id) throw new Error('No company found');
        const companyId = profile.company_id;

        // Verify admin
        const { data: company } = await supabaseAdmin
            .from('companies')
            .select('id, admin_id, features')
            .eq('id', companyId)
            .single();

        if (!company) throw new Error('Company not found');
        if (company.admin_id !== user.id) throw new Error('Only admin can purchase addons');

        const currentFeatures = (company.features as Record<string, boolean>) || {};

        if (currentFeatures[feature]) {
            throw new Error('Feature already unlocked');
        }

        // Check Wallet
        const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('company_id', companyId)
            .single()

        const currentBalance = wallet ? Number(wallet.balance) : 0
        if (currentBalance < cost) {
            throw new Error(`Insufficient wallet balance. Required: ₹${cost}, Available: ₹${currentBalance}. Please recharge.`);
        }

        // Process Transaction - Deduct
        const { error: walletError } = await supabaseAdmin
            .from('wallets')
            .update({ balance: currentBalance - cost, updated_at: new Date().toISOString() })
            .eq('company_id', companyId);

        if (walletError) throw new Error('Wallet deduction failed');

        // Log transaction
        await supabaseAdmin.from('wallet_transactions').insert({
            wallet_id: companyId,
            amount: cost,
            type: 'debit_manual_adjustment',
            description: `Unlocked Feature: ${feature.replace('custom_', 'Custom ')}`,
            status: 'success'
        });

        // Unlock Feature
        const newFeatures = { ...currentFeatures, [feature]: true };
        const { error: updateError } = await supabaseAdmin
            .from('companies')
            .update({ features: newFeatures })
            .eq('id', companyId);

        if (updateError) {
            console.error('Feature Unlock Failed', updateError);
            throw new Error('Failed to unlock feature after payment. Contact support.');
        }

        return new Response(
            JSON.stringify({ success: true, new_balance: currentBalance - cost, features: newFeatures }),
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
