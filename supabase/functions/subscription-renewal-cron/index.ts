import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSystemEmail, getEmailTemplate } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Check if it's Sunday (Skip Sunday)
    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const today = new Date().getDay();
    if (today === 0) {
      console.log("Skipping Sunday execution.");
      return new Response(JSON.stringify({ message: "Skipping Sunday" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Processing subscription renewal reminders...");

    // 2. Query companies with expired subscriptions and low wallet balance
    // We fetch companies where subscription_valid_until is in the past
    // and we join with wallets to check balance.
    // Assuming a renewal might cost at least 100 INR.
    const { data: expiredCompanies, error: queryError } = await supabaseAdmin
      .from("companies")
      .select(`
        id, 
        name, 
        slug,
        admin_id, 
        subscription_valid_until,
        subscription_status,
        wallets (balance)
      `)
      .lt("subscription_valid_until", new Date().toISOString())
      .or("subscription_status.eq.past_due,subscription_status.eq.canceled,subscription_status.eq.active");

    if (queryError) throw queryError;

    let emailsSent = 0;

    for (const company of expiredCompanies || []) {
      const balance = company.wallets?.[0]?.balance || 0;
      
      // If balance is too low to auto-renew (e.g. < 999)
      if (balance < 999) {
        // Fetch Admin Profile
        const { data: adminProfile } = await supabaseAdmin
          .from("profiles")
          .select("email, full_name")
          .eq("id", company.admin_id)
          .single();

        if (adminProfile?.email) {
          const appUrl = Deno.env.get("APP_URL") || "https://fastestcrm.com";
          const renewalUrl = `${appUrl}/dashboard/settings?tab=billing`;
          
          const emailBody = `
            <p>Hello ${adminProfile.full_name || 'Admin'},</p>
            <p>Your subscription for <strong>${company.name}</strong> has expired or is about to be halted due to insufficient wallet balance.</p>
            <p>To ensure uninterrupted service for your team, please add money to your wallet to enable auto-renewal.</p>
            <div class="info-box">
              <div class="info-item"><span class="info-label">Company:</span> ${company.name}</div>
              <div class="info-item"><span class="info-label">Current Balance:</span> ₹${balance}</div>
              <div class="info-item"><span class="info-label">Status:</span> ${company.subscription_status || 'Expired'}</div>
            </div>
            <p>Once you add sufficient funds, our system will automatically attempt to renew your subscription.</p>
          `;

          const emailHtml = getEmailTemplate("Action Required: Renew Your Subscription", emailBody, "Add Money to Wallet", renewalUrl);
          
          const result = await sendSystemEmail({
            to: adminProfile.email,
            subject: `Action Required: Renew Subscription for ${company.name}`,
            html: emailHtml
          });

          if (result.success) emailsSent++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: expiredCompanies?.length || 0, emailsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Cron Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
