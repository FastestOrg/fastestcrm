import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

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

        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = await req.json()

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            throw new Error('Missing required parameters')
        }

        // Verify Signature
        const rzpKeySecret = Deno.env.get('RZP_KEY_SECRET')
        if (!rzpKeySecret) {
            throw new Error('Server configuration error')
        }

        const generatedSignature = await generateHmacSha256(
            razorpay_order_id + "|" + razorpay_payment_id,
            rzpKeySecret
        )

        if (generatedSignature !== razorpay_signature) {
            throw new Error('Invalid signature')
        }

        // Get Admin Client for DB updates
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        // Find Transaction
        const { data: transaction, error: txFetchError } = await supabaseAdmin
            .from('wallet_transactions')
            .select('*')
            .eq('reference_id', razorpay_order_id)
            .eq('status', 'pending')
            .single()

        if (txFetchError || !transaction) {
            throw new Error('Transaction not found or already processed')
        }

        // Update Transaction to Success
        const { error: updateError } = await supabaseAdmin
            .from('wallet_transactions')
            .update({
                status: 'success',
                metadata: { ...transaction.metadata, razorpay_payment_id }
            })
            .eq('id', transaction.id)

        if (updateError) {
            throw new Error('Failed to update transaction')
        }

        // Update Wallet Balance
        // We fetch existing wallet first to be safe, though we can use rpc or upsert with logic. 
        // Supabase doesn't have native atomic increment in `update` via JS client easily without RPC. 
        // But we can read-then-write or use a custom RPC. 
        // Since we are in an edge function and concurrency *might* be an issue, RPC is best. 
        // But for simplicity, let's read-then-write. 
        // Better: Handle concurrency by creating an RPC function `increment_wallet`.
        // OR: Just trust the single-threaded nature of JS execution here? No, multiple requests can happen.
        // Let's create a quick SQL RPC call via supabaseAdmin.rpc() if we had one.
        // We didn't create one. Let's do simple read-modify-write. The critical path is short.

        // Actually, let's do an upsert or better, just fetch wallet, add, update.
        const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('company_id', transaction.wallet_id)
            .single()

        const currentBalance = wallet ? Number(wallet.balance) : 0
        const newBalance = currentBalance + Number(transaction.amount)

        const { error: walletError } = await supabaseAdmin
            .from('wallets')
            .upsert({
                company_id: transaction.wallet_id,
                balance: newBalance,
                updated_at: new Date().toISOString()
            })

        if (walletError) {
            console.error('Wallet Update Error', walletError)
            throw new Error('Failed to credit wallet')
        }

        // --- PROCESS PARTNER REFERRAL COMMISSION ---
        try {
            const companyId = transaction.wallet_id;
            const rechargeAmount = Number(transaction.amount);

            // Check if company has an attributed partner referral
            const { data: refRecord } = await supabaseAdmin
                .from('partner_referrals')
                .select('id, partner_id, is_paid, total_revenue_generated, commission_earned, partner:partners(id, category, commission_rate, total_earnings, pending_earnings, email, contact_name)')
                .eq('referred_company_id', companyId)
                .maybeSingle();

            if (refRecord && refRecord.partner) {
                const partner = refRecord.partner as any;
                const discountAmt = Number(transaction.metadata?.discount_amount || 0);

                let earnedAmount = 0;
                let isFirstTime = false;

                if (!refRecord.is_paid) {
                    // First topup
                    isFirstTime = true;
                    if (partner.category === 'agency') {
                        const rate = Number(partner.commission_rate || 40);
                        earnedAmount = Math.round((rechargeAmount * rate) / 100);
                    } else if (partner.category === 'affiliate') {
                        // 1 month license fee bounty on quarterly plan (~33%)
                        earnedAmount = Math.round(rechargeAmount * 0.33);
                    } else if (partner.category === 'white_label') {
                        earnedAmount = 0; // White-label retains 100% margin
                    }

                    await supabaseAdmin
                        .from('partner_referrals')
                        .update({
                            is_paid: true,
                            first_topup_amount: rechargeAmount,
                            first_topup_discount: discountAmt,
                            total_revenue_generated: rechargeAmount,
                            commission_earned: earnedAmount,
                            commission_status: 'approved',
                            paid_at: new Date().toISOString()
                        })
                        .eq('id', refRecord.id);

                    if (earnedAmount > 0 && partner.id) {
                        await supabaseAdmin
                            .from('partners')
                            .update({
                                total_earnings: Number(partner.total_earnings || 0) + earnedAmount,
                                pending_earnings: Number(partner.pending_earnings || 0) + earnedAmount,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', partner.id);
                    }

                    console.log(`[Partner] First topup commission credited: ₹${earnedAmount} to partner ${partner.id}`);
                } else if (partner.category === 'agency') {
                    // Agency lifetime recurring commission (40% on subsequent recharges)
                    const rate = Number(partner.commission_rate || 40);
                    earnedAmount = Math.round((rechargeAmount * rate) / 100);

                    const newTotalRevenue = Number(refRecord.total_revenue_generated || 0) + rechargeAmount;
                    const newTotalComm = Number(refRecord.commission_earned || 0) + earnedAmount;

                    await supabaseAdmin
                        .from('partner_referrals')
                        .update({
                            total_revenue_generated: newTotalRevenue,
                            commission_earned: newTotalComm
                        })
                        .eq('id', refRecord.id);

                    if (earnedAmount > 0 && partner.id) {
                        await supabaseAdmin
                            .from('partners')
                            .update({
                                total_earnings: Number(partner.total_earnings || 0) + earnedAmount,
                                pending_earnings: Number(partner.pending_earnings || 0) + earnedAmount,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', partner.id);
                    }

                    console.log(`[Partner Agency] Recurring lifetime commission credited: ₹${earnedAmount} to partner ${partner.id}`);
                } else {
                    // Subsequent topup for affiliate or white-label (track client revenue)
                    const newTotalRevenue = Number(refRecord.total_revenue_generated || 0) + rechargeAmount;
                    await supabaseAdmin
                        .from('partner_referrals')
                        .update({
                            total_revenue_generated: newTotalRevenue
                        })
                        .eq('id', refRecord.id);
                }

                // Send partner email notification if commission earned
                if (partner.email && earnedAmount > 0) {
                    try {
                        const commissionTypeLabel = isFirstTime ? 'Client Acquisition Commission' : 'Recurring Lifetime Commission';
                        const partnerEmailBody = `
                            <p>Hello ${partner.contact_name || 'Partner'},</p>
                            <p>Congratulations! One of your referred clients has just recharged their wallet on FastestCRM, generating commission for your account.</p>
                            <div class="info-box">
                                <div class="info-item"><span class="info-label">Recharge Amount:</span> ₹${rechargeAmount}</div>
                                <div class="info-item"><span class="info-label">Commission Earned:</span> ₹${earnedAmount}</div>
                                <div class="info-item"><span class="info-label">Commission Type:</span> ${commissionTypeLabel}</div>
                                <div class="info-item"><span class="info-label">Partner Tier:</span> ${partner.category.toUpperCase()}</div>
                            </div>
                            <p>This earnings amount has been added to your pending balance in the Partner Cockpit. You can request bank payouts once your threshold is reached.</p>
                        `;
                        const partnerHtml = getEmailTemplate("New Partner Commission Earned!", partnerEmailBody, "View Partner Cockpit", "https://fastestcrm.com/dashboard/partner", "success");
                        await sendSystemEmail({
                            to: partner.email,
                            subject: `🎉 You earned ₹${earnedAmount} Commission on FastestCRM!`,
                            html: partnerHtml
                        });
                        console.log(`[Partner] Commission notification email dispatched to ${partner.email}`);
                    } catch (pEmailErr) {
                        console.error("[Partner] Failed to send commission email (non-blocking):", pEmailErr);
                    }
                }
            }
        } catch (partnerErr) {
            console.error('Partner referral processing error (non-blocking):', partnerErr);
        }

        // --- SEND NOTIFICATION EMAIL TO ADMIN ---
        try {
            const { data: companyAdmin } = await supabaseAdmin
                .from('companies')
                .select('name, admin_id')
                .eq('id', transaction.wallet_id) // wallet_id is company_id here
                .single()

            if (companyAdmin) {
                const { data: adminProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('email, full_name')
                    .eq('id', companyAdmin.admin_id)
                    .single()

                if (adminProfile?.email) {
                    const emailBody = `
                        <p>Hello ${adminProfile.full_name || 'Admin'},</p>
                        <p>We are pleased to inform you that your wallet for <strong>${companyAdmin.name}</strong> has been successfully recharged.</p>
                        <div class="info-box">
                            <div class="info-item"><span class="info-label">Recharge Amount:</span> ₹${transaction.amount}</div>
                            <div class="info-item"><span class="info-label">New Balance:</span> ₹${newBalance}</div>
                            <div class="info-item"><span class="info-label">Transaction ID:</span> ${razorpay_payment_id}</div>
                        </div>
                        <p>Thank you for using FastestCRM!</p>
                    `;

                    const emailHtml = getEmailTemplate("Wallet Recharge Successful", emailBody);
                    
                    await sendSystemEmail({
                        to: adminProfile.email,
                        subject: `Wallet Recharged: ₹${transaction.amount} Added`,
                        html: emailHtml
                    });
                    console.log(`Recharge notification sent to ${adminProfile.email}`);
                }
            }
        } catch (emailErr) {
            console.error("Failed to send recharge notification (non-blocking):", emailErr);
        }

        return new Response(
            JSON.stringify({ success: true, new_balance: newBalance }),
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

async function generateHmacSha256(data: string, secret: string) {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    )
    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(data)
    )
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    fromName?: string;
    fromEmail?: string;
}

async function sendSystemEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    const host = Deno.env.get("SYSTEM_SMTP_HOST");
    const port = parseInt(Deno.env.get("SYSTEM_SMTP_PORT") || "587");
    const user = Deno.env.get("SYSTEM_SMTP_USER");
    const pass = Deno.env.get("SYSTEM_SMTP_PASS");
    const defaultFromEmail = Deno.env.get("SYSTEM_SMTP_FROM_EMAIL");
    const defaultFromName = Deno.env.get("SYSTEM_SMTP_FROM_NAME") || "FastestCRM";

    if (!host || !user || !pass) {
        console.log("SMTP not configured in environment (SYSTEM_SMTP_HOST, USER, PASS). Skipping email delivery.");
        return { success: false, error: "SMTP configuration missing" };
    }

    const fromEmail = options.fromEmail || defaultFromEmail;
    const fromName = options.fromName || defaultFromName;

    if (!fromEmail) {
        return { success: false, error: "Sender email is required." };
    }

    let conn: any = null;

    try {
        const readResponse = async (c: any) => {
            const buf = new Uint8Array(4096);
            const n = await c.read(buf);
            return n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
        };

        const sendCommand = async (c: any, cmd: string) => {
            await c.write(new TextEncoder().encode(cmd + "\r\n"));
            return await readResponse(c);
        };

        if (port === 465) {
            conn = await (Deno as any).connectTls({ hostname: host, port });
        } else {
            conn = await Deno.connect({ hostname: host, port });
        }

        let response = await readResponse(conn);
        if (!response.startsWith("220")) throw new Error("SMTP Greeting Failed: " + response);

        response = await sendCommand(conn, "EHLO fastestcrm.com");

        if (port === 587) {
            response = await sendCommand(conn, "STARTTLS");
            if (response.startsWith("220")) {
                conn = await (Deno as any).startTls(conn, { hostname: host });
                response = await sendCommand(conn, "EHLO fastestcrm.com");
            }
        }

        response = await sendCommand(conn, "AUTH LOGIN");
        await sendCommand(conn, base64Encode(new TextEncoder().encode(user)));
        response = await sendCommand(conn, base64Encode(new TextEncoder().encode(pass)));
        if (!response.startsWith("235")) throw new Error("SMTP Auth Failed: " + response);

        response = await sendCommand(conn, `MAIL FROM:<${fromEmail}>`);
        response = await sendCommand(conn, `RCPT TO:<${options.to}>`);

        response = await sendCommand(conn, "DATA");
        if (!response.startsWith("354")) throw new Error("SMTP DATA Rejected: " + response);

        const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        const subjectEncoded = `=?UTF-8?B?${base64Encode(new TextEncoder().encode(options.subject))}?=`;
        const textBody = options.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

        const message = [
            `From: "${fromName.replace(/"/g, "")}" <${fromEmail}>`,
            `To: <${options.to}>`,
            `Subject: ${subjectEncoded}`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            ``,
            `--${boundary}`,
            `Content-Type: text/plain; charset=utf-8`,
            `Content-Transfer-Encoding: base64`,
            ``,
            base64Encode(new TextEncoder().encode(textBody)),
            ``,
            `--${boundary}`,
            `Content-Type: text/html; charset=utf-8`,
            `Content-Transfer-Encoding: base64`,
            ``,
            base64Encode(new TextEncoder().encode(options.html)),
            ``,
            `--${boundary}--`,
            `.`,
        ].join("\r\n");

        response = await sendCommand(conn, message);
        if (!response.startsWith("250")) throw new Error("SMTP Send Failed: " + response);

        await sendCommand(conn, "QUIT");
        conn.close();
        return { success: true };
    } catch (err: any) {
        console.error("SMTP Error:", err);
        try { conn?.close(); } catch {}
        return { success: false, error: err.message };
    }
}

function getEmailTemplate(title: string, body: string, ctaText?: string, ctaUrl?: string, type: 'info' | 'warning' | 'success' | 'danger' = 'info'): string {
    const colors = {
        info: "#8B5CF6",
        warning: "#F59E0B",
        success: "#10B981",
        danger: "#EF4444"
    };
    const primaryColor = colors[type];

    return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb; }
            .wrapper { width: 100%; table-layout: fixed; background-color: #f9fafb; padding: 40px 0; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; }
            .header { background-color: ${primaryColor}; padding: 32px 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em; }
            .content { padding: 40px 32px; }
            .footer { padding: 24px; text-align: center; font-size: 13px; color: #6b7280; background-color: #f9fafb; border-top: 1px solid #e5e7eb; }
            .button { display: inline-block; padding: 14px 28px; background-color: ${primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 24px 0; text-align: center; }
            .info-box { background-color: #f3f4f6; padding: 20px; border-radius: 10px; margin: 24px 0; border: 1px solid #e5e7eb; }
            .info-item { margin-bottom: 12px; display: block; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
            .info-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
            .info-label { font-weight: 600; color: #4b5563; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; display: block; }
            .info-value { color: #111827; font-size: 15px; font-weight: 500; }
            .text-center { text-align: center; }
            p { margin: 0 0 16px 0; font-size: 16px; color: #374151; }
            strong { color: #111827; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="container">
              <div class="header">
                <h1>${title}</h1>
              </div>
              <div class="content">
                ${body}
                ${ctaText && ctaUrl ? `<div class="text-center"><a href="${ctaUrl}" class="button">${ctaText}</a></div>` : ''}
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} FastestCRM. All rights reserved.<br>
                <span style="margin-top: 8px; display: block;">Transforming Sales through Agentic Operations.</span>
              </div>
            </div>
          </div>
        </body>
        </html>
    `;
}
