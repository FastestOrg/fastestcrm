import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { record } = await req.json();
    if (!record || !record.id) {
        return new Response(JSON.stringify({ error: "No lead record provided" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const leadId = record.id;
    const companyId = record.company_id;

    console.log(`Processing outreach orchestration for lead ${leadId}`);

    // 1. Fetch Company Autonomy Settings
    const { data: settings } = await adminClient
      .from("autonomous_growth_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!settings || !settings.auto_outreach_enabled) {
      console.log("Auto-outreach disabled. Skipping.");
      return new Response(JSON.stringify({ skipped: true, reason: "Auto-outreach disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const campaignTable = settings.preferred_channel === "whatsapp" ? "whatsapp_campaigns" : "email_campaigns";
    const recipientTable = settings.preferred_channel === "whatsapp" ? "whatsapp_campaign_recipients" : "email_campaign_recipients";

    // 2. Find an active 'Agentic' Campaign in the preferred channel
    const { data: campaigns } = await adminClient
      .from(campaignTable)
      .select("id, name, campaign_mode")
      .eq("company_id", companyId)
      .eq("campaign_mode", "agentic")
      .eq("status", "running")
      .limit(1);

    if (!campaigns || campaigns.length === 0) {
      console.log(`No active Agentic ${settings.preferred_channel} campaigns found.`);
      return new Response(JSON.stringify({ skipped: true, reason: `No active agentic ${settings.preferred_channel} campaign` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const campaign = campaigns[0];

    // 3. Insert Lead into Campaign Recipients
    const { data: existing } = await adminClient
      .from(recipientTable)
      .select("id")
      .eq("campaign_id", campaign.id)
      .eq("lead_id", leadId)
      .maybeSingle();

    if (existing) {
        return new Response(JSON.stringify({ skipped: true, reason: "Lead already in campaign" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const approvalStatus = settings.autonomy_mode === "semi-autonomous" ? "pending" : "approved";

    const { error: insertError } = await adminClient
      .from(recipientTable)
      .insert({
        campaign_id: campaign.id,
        lead_id: leadId,
        lead_email: record.email,
        lead_name: record.name,
        lead_data: record.enrichment_data || {},
        status: "pending",
        current_step: 1,
        approval_status: approvalStatus
      });

    if (insertError) throw insertError;

    // 4. Log Action
    const logAction = approvalStatus === "pending" 
        ? `Added to ${settings.preferred_channel} campaign (Pending Approval): ${campaign.name}`
        : `Added to Autonomous ${settings.preferred_channel} campaign: ${campaign.name}`;

    await adminClient
      .from("leads")
      .update({
        lead_history: [...(record.lead_history || []), { 
            at: new Date().toISOString(), 
            action: logAction, 
            by: "Autonomous Orchestrator" 
        }]
      })
      .eq("id", leadId);

    return new Response(JSON.stringify({ success: true, campaign: campaign.name, mode: settings.autonomy_mode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Orchestration Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
