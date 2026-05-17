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

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('No authorization header')

        const token = authHeader.replace(/^Bearer\s+/i, '')
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
        if (userError || !user) throw new Error('Not authenticated')
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single()

        if (!profile?.company_id) throw new Error('No company found')
        const companyId = profile.company_id

        const { code } = await req.json()
        if (!code) throw new Error('Code is required')

        // Find Gift Card
        const { data: giftCard, error: fetchError } = await supabaseAdmin
            .from('gift_cards')
            .select('*')
            .eq('code', code)
            .maybeSingle()

        if (fetchError) throw fetchError
        if (!giftCard) throw new Error('Invalid gift card code')

        if (!giftCard.active) throw new Error('Gift card is inactive')
        if (giftCard.is_redeemed) throw new Error('Gift card already redeemed')
        if (giftCard.expires_at && new Date(giftCard.expires_at) < new Date()) {
            throw new Error('Gift card expired')
        }

        // Redeem Process (Transaction)
        // 1. Mark Redeemed
        const { error: updateError } = await supabaseAdmin
            .from('gift_cards')
            .update({
                is_redeemed: true,
                redeemed_by: companyId,
                redeemed_at: new Date().toISOString()
            })
            .eq('code', code)
            .eq('is_redeemed', false) // Optimistic Lock

        if (updateError) throw new Error('Failed to redeem card (maybe already redeemed?)')

        // 2. Add Transaction
        const { error: txError } = await supabaseAdmin
            .from('wallet_transactions')
            .insert({
                wallet_id: companyId,
                amount: giftCard.amount,
                type: 'credit_gift_card',
                description: `Gift Card Redeemed: ${code}`,
                status: 'success'
            })

        if (txError) console.error('TX Log Error', txError)

        // 3. Update Wallet Balance
        const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('company_id', companyId)
            .single()

        const currentBalance = wallet ? Number(wallet.balance) : 0
        const newBalance = currentBalance + Number(giftCard.amount)

        const { error: walletError } = await supabaseAdmin
            .from('wallets')
            .upsert({
                company_id: companyId,
                balance: newBalance,
                updated_at: new Date().toISOString()
            })

        if (walletError) throw new Error('Failed to update wallet balance')

        // --- SEND NOTIFICATION EMAIL TO ADMIN ---
        try {
            const { data: companyAdmin } = await supabaseAdmin
                .from('companies')
                .select('name, admin_id')
                .eq('id', companyId)
                .single()

            if (companyAdmin) {
                const { data: adminProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('email, full_name')
                    .eq('id', companyAdmin.admin_id)
                    .single()

                if (adminProfile?.email) {
                    const { sendSystemEmail, getEmailTemplate } = await import("../_shared/email.ts");
                    
                    const emailBody = `
                        <p>Hello ${adminProfile.full_name || 'Admin'},</p>
                        <p>A gift card has been successfully redeemed for <strong>${companyAdmin.name}</strong>.</p>
                        <div class="info-box">
                            <div class="info-item"><span class="info-label">Gift Card Code:</span> ${code}</div>
                            <div class="info-item"><span class="info-label">Amount Added:</span> ₹${giftCard.amount}</div>
                            <div class="info-item"><span class="info-label">New Balance:</span> ₹${newBalance}</div>
                        </div>
                        <p>Thank you for using FastestCRM!</p>
                    `;

                    const emailHtml = getEmailTemplate("Gift Card Redeemed", emailBody);
                    
                    await sendSystemEmail({
                        to: adminProfile.email,
                        subject: `Wallet Credit: ₹${giftCard.amount} Added via Gift Card`,
                        html: emailHtml
                    });
                    console.log(`Gift card redemption notification sent to ${adminProfile.email}`);
                }
            }
        } catch (emailErr) {
            console.error("Failed to send gift card notification (non-blocking):", emailErr);
        }

        return new Response(
            JSON.stringify({ success: true, amount: giftCard.amount, new_balance: newBalance }),
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
