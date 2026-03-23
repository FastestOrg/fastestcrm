import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";




interface UnlockRequest {
    featureName: string;
    amount: number;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            throw new Error("Missing authorization header");
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Client for auth verification (with user's token)
        const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
            global: { headers: { Authorization: authHeader } }
        });

        // Service role client for database operations (bypasses RLS)
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Verify user is authenticated
        const { data: { user }, error: userError } = await supabaseUser.auth.getUser(req.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''));
        if (userError || !user) {
            throw new Error("Unauthorized");
        }

        // Get user's company
        const { data: profile } = await supabaseUser
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (!profile?.company_id) {
            throw new Error("User not associated with a company");
        }

        // Verify user is company admin
        const { data: company } = await supabaseUser
            .from('companies')
            .select('admin_id')
            .eq('id', profile.company_id)
            .single();

        if (!company || company.admin_id !== user.id) {
            throw new Error("Access denied: Only company admins can unlock features");
        }

        // Parse request body
        const { featureName, amount }: UnlockRequest = await req.json();

        if (!featureName || !amount) {
            throw new Error("Feature name and amount are required");
        }

        // Check if feature is already unlocked
        const { data: existingUnlock } = await supabaseAdmin
            .from('features_unlocked')
            .select('id')
            .eq('company_id', profile.company_id)
            .eq('feature_name', featureName)
            .maybeSingle();

        if (existingUnlock) {
            return new Response(
                JSON.stringify({ error: "Feature already unlocked" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get wallet balance
        const { data: wallet, error: walletError } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('company_id', profile.company_id)
            .single();

        if (walletError || !wallet) {
            throw new Error("Wallet not found");
        }

        if (wallet.balance < amount) {
            return new Response(
                JSON.stringify({
                    error: "Insufficient balance",
                    currentBalance: wallet.balance,
                    required: amount
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Deduct from wallet
        const newBalance = Number(wallet.balance) - amount;
        const { error: updateError } = await supabaseAdmin
            .from('wallets')
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq('company_id', profile.company_id);

        if (updateError) {
            throw new Error(`Failed to update wallet: ${updateError.message}`);
        }

        // Create transaction record
        const { error: txError } = await supabaseAdmin
            .from('wallet_transactions')
            .insert({
                wallet_id: profile.company_id,
                amount: -amount,
                type: 'debit_manual_adjustment',
                description: `Unlocked feature: ${featureName}`,
                status: 'success',
                metadata: { feature_name: featureName }
            });

        if (txError) {
            console.error('Transaction record error:', txError);
            // Don't fail if transaction record fails, feature unlock is more important
        }

        // Record feature unlock
        const { error: unlockError } = await supabaseAdmin
            .from('features_unlocked')
            .insert({
                company_id: profile.company_id,
                feature_name: featureName,
                amount_paid: amount,
                unlocked_by: user.id
            });

        if (unlockError) {
            // Try to rollback wallet update
            await supabaseAdmin
                .from('wallets')
                .update({ balance: wallet.balance })
                .eq('company_id', profile.company_id);

            throw new Error(`Failed to unlock feature: ${unlockError.message}`);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Feature unlocked successfully",
                newBalance,
                featureName
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );

    } catch (error: any) {
        console.error("Unlock feature error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Internal server error" }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});
