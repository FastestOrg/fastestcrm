import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { sendSystemEmail, getEmailTemplate } from "../_shared/email.ts";

const PRICE_PER_SEAT = 500;

serve(async (req) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const appUrl = Deno.env.get('APP_URL') || 'https://fastestcrm.com';

    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { data: companies, error } = await supabaseAdmin
            .from('companies')
            .select('id, name, admin_id, total_licenses, subscription_valid_until, subscription_status, grace_period_start')
            .lt('subscription_valid_until', tomorrow.toISOString())
            .in('subscription_status', ['active', 'past_due'])

        if (error) throw error;

        const results = [];

        for (const company of (companies || [])) {
            if (new Date(company.subscription_valid_until) > tomorrow) continue;

            const totalSeats = company.total_licenses || 0;
            if (totalSeats === 0) continue;

            const cost = totalSeats * PRICE_PER_SEAT;

            const { data: wallet } = await supabaseAdmin
                .from('wallets')
                .select('balance')
                .eq('company_id', company.id)
                .single();

            const balance = wallet ? Number(wallet.balance) : 0;

            if (balance >= cost) {
                // SUCCESS RENEWAL
                await supabaseAdmin.from('wallets')
                    .update({ balance: balance - cost, updated_at: new Date().toISOString() })
                    .eq('company_id', company.id);

                await supabaseAdmin.from('wallet_transactions').insert({
                    wallet_id: company.id,
                    amount: cost,
                    type: 'debit_auto_renewal',
                    description: 'Monthly Subscription Auto-Renewal',
                    status: 'success'
                });

                const oldDate = new Date(company.subscription_valid_until);
                const newDate = new Date(oldDate);
                newDate.setMonth(newDate.getMonth() + 1);

                await supabaseAdmin.from('companies')
                    .update({
                        subscription_valid_until: newDate.toISOString(),
                        subscription_status: 'active'
                    })
                    .eq('id', company.id);

                results.push({ company_id: company.id, status: 'renewed' });

            } else {
                // ═══ FAILED RENEWAL — TRIGGER GRACE PERIOD ═══
                const now = new Date();
                const deletionDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

                // Update company: set past_due + grace period fields
                // The DB trigger will also fire, but we set fields explicitly
                // to handle the case where grace_period_start was already set
                const updatePayload: Record<string, any> = {
                    subscription_status: 'past_due',
                };

                // Only set grace period if not already set
                if (!company.grace_period_start) {
                    updatePayload.grace_period_start = now.toISOString();
                    updatePayload.data_deletion_scheduled_at = deletionDate.toISOString();
                }

                await supabaseAdmin.from('companies')
                    .update(updatePayload)
                    .eq('id', company.id);

                // Deactivate all non-admin profiles
                await supabaseAdmin.from('profiles')
                    .update({ is_deactivated: true, updated_at: now.toISOString() })
                    .eq('company_id', company.id)
                    .neq('id', company.admin_id);

                // Send warning email to admin
                try {
                    const { data: adminProfile } = await supabaseAdmin
                        .from('profiles')
                        .select('email, full_name')
                        .eq('id', company.admin_id)
                        .single();

                    if (adminProfile?.email) {
                        const effectiveDeletionDate = company.grace_period_start
                            ? new Date(new Date(company.grace_period_start).getTime() + 180 * 24 * 60 * 60 * 1000)
                            : deletionDate;

                        const emailBody = `
                            <p>Hello ${adminProfile.full_name || 'Admin'},</p>
                            <p>We were unable to auto-renew the subscription for <strong>${company.name}</strong> due to insufficient wallet balance.</p>
                            <p style="font-size: 20px; font-weight: 700; color: #EF4444; text-align: center; margin: 24px 0;">
                                ⚠️ 180-Day Grace Period Has Started
                            </p>
                            <div class="info-box">
                                <div class="info-item"><span class="info-label">Company:</span> ${company.name}</div>
                                <div class="info-item"><span class="info-label">Required Amount:</span> ₹${cost}</div>
                                <div class="info-item"><span class="info-label">Wallet Balance:</span> ₹${balance}</div>
                                <div class="info-item"><span class="info-label">Data Deletion Date:</span> ${effectiveDeletionDate.toLocaleDateString('en-IN', { dateStyle: 'long' })}</div>
                            </div>
                            <p><strong>What's happening now:</strong></p>
                            <ul>
                                <li>All team members (except you) have been <strong>locked out</strong></li>
                                <li>You can only access Settings and Billing pages</li>
                                <li>After 180 days, ALL company data will be <strong>permanently deleted</strong></li>
                            </ul>
                            <p>To restore full access, please add funds to your wallet and renew your subscription.</p>
                        `;

                        const emailHtml = getEmailTemplate(
                            'Subscription Renewal Failed',
                            emailBody,
                            'Add Funds & Renew Now',
                            `${appUrl}/dashboard/company`,
                            'danger'
                        );

                        await sendSystemEmail({
                            to: adminProfile.email,
                            subject: `🚨 URGENT: ${company.name} subscription failed - 180-day countdown started`,
                            html: emailHtml,
                        });
                    }
                } catch (emailErr) {
                    console.error(`Failed to send grace period email for company ${company.id}:`, emailErr);
                }

                console.log(`Company ${company.id} renewal failed. Grace period activated. Balance: ₹${balance}, Required: ₹${cost}`);
                results.push({ company_id: company.id, status: 'failed_grace_period_started' });
            }
        }

        return new Response(
            JSON.stringify({ processed: companies?.length, results }),
            { headers: { 'Content-Type': 'application/json' } }
        )

    } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return new Response(JSON.stringify({ error: message }), { status: 500 });
    }
})
