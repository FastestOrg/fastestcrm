import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts";

const PRICE_PER_SEAT = 500;

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

        const { action, quantity, months } = await req.json();

        // Get user's company
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!profile?.company_id) throw new Error('No company found');
        const companyId = profile.company_id;

        // Get company details
        const { data: company } = await supabaseAdmin
            .from('companies')
            .select('id, total_licenses, subscription_valid_until, subscription_status, admin_id')
            .eq('id', companyId)
            .single();

        if (!company) throw new Error('Company not found');
        if (company.admin_id !== user.id) throw new Error('Only admin can manage subscription');

        // Get wallet balance
        const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('company_id', companyId)
            .single();

        const currentBalance = wallet ? Number(wallet.balance) : 0;

        let cost = 0;
        let description = '';
        let updates: Record<string, any> = {};

        if (action === 'add_seats') {
            const qty = Number(quantity);
            if (qty < 1) throw new Error('Invalid quantity');

            const now = new Date();
            const validUntil = company.subscription_valid_until ? new Date(company.subscription_valid_until) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            let daysRemaining = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 3600 * 24));
            if (daysRemaining < 0) daysRemaining = 0;

            if (daysRemaining === 0) {
                daysRemaining = 30;
                updates = {
                    subscription_valid_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    subscription_status: 'active',
                    grace_period_start: null,
                    data_deletion_scheduled_at: null,
                }
            }

            const dailyRate = PRICE_PER_SEAT / 30;
            cost = Math.ceil(dailyRate * daysRemaining * qty);

            description = `Purchased ${qty} seat(s) for ${daysRemaining} days`;
            updates = {
                ...updates,
                total_licenses: (company.total_licenses || 0) + qty,
                ...(company.subscription_valid_until ? {} : {
                    subscription_valid_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    subscription_status: 'active'
                })
            };

        } else if (action === 'extend_subscription') {
            const durationMonths = Number(months);
            if (![1, 3, 6, 12].includes(durationMonths)) throw new Error('Invalid duration');

            const totalSeats = company.total_licenses || 1;

            let discount = 0;
            if (durationMonths === 3) discount = 0.10;
            else if (durationMonths === 6) discount = 0.20;
            else if (durationMonths === 12) discount = 0.40;

            const baseCost = totalSeats * PRICE_PER_SEAT * durationMonths;
            cost = Math.ceil(baseCost * (1 - discount));

            description = `Extended subscription by ${durationMonths} months (${discount * 100}% off)`;

            const currentValidUntil = company.subscription_valid_until && new Date(company.subscription_valid_until) > new Date()
                ? new Date(company.subscription_valid_until)
                : new Date();

            const newValidUntil = new Date(currentValidUntil);
            newValidUntil.setMonth(newValidUntil.getMonth() + durationMonths);

            updates = {
                subscription_valid_until: newValidUntil.toISOString(),
                subscription_status: 'active',
                // Clear grace period on re-subscription (DB trigger also reactivates users)
                grace_period_start: null,
                data_deletion_scheduled_at: null,
            };
        } else {
            throw new Error('Invalid action');
        }

        if (currentBalance < cost) {
            throw new Error(`Insufficient wallet balance. Required: ₹${cost}, Available: ₹${currentBalance}. Please recharge.`);
        }

        const { error: walletError } = await supabaseAdmin
            .from('wallets')
            .update({ balance: currentBalance - cost, updated_at: new Date().toISOString() })
            .eq('company_id', companyId);

        if (walletError) throw new Error('Wallet deduction failed');

        await supabaseAdmin.from('wallet_transactions').insert({
            wallet_id: companyId,
            amount: cost,
            type: 'debit_license_purchase',
            description: description,
            status: 'success'
        });

        const { error: companyError } = await supabaseAdmin
            .from('companies')
            .update(updates)
            .eq('id', companyId);

        if (companyError) {
            console.error('Company Update Failed', companyError);

            const { error: rollbackError } = await supabaseAdmin
                .from('wallets')
                .update({ balance: currentBalance, updated_at: new Date().toISOString() })
                .eq('company_id', companyId);

            if (rollbackError) {
                console.error('CRITICAL: Failed to rollback wallet after subscription update failed', rollbackError);
            } else {
                await supabaseAdmin.from('wallet_transactions').insert({
                    wallet_id: companyId,
                    amount: cost,
                    type: 'credit_manual_adjustment',
                    description: 'Refund: Subscription update failed',
                    status: 'success'
                });
            }

            throw new Error('Failed to update subscription. Please contact support.');
        }

        return new Response(
            JSON.stringify({ success: true, cost, updates }),
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
