/**
 * fastsend-campaign — Campaign execution engine
 * 
 * Processes email campaigns: picks next recipients, sends emails via fastsend-send,
 * respects delays, warm-up limits, and send conditions.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function resolveVariables(template: string, leadData: Record<string, any>): string {
  return template.replace(/%([a-zA-Z_]+)%/g, (_, rawKey) => {
    const key = rawKey.toLowerCase();
    if (key === 'company' && leadData['company_name'] !== undefined && leadData['company_name'] !== null) {
      return String(leadData['company_name']);
    }
    if (key === 'company_name' && leadData['company'] !== undefined && leadData['company'] !== null) {
      return String(leadData['company']);
    }
    return leadData[rawKey] ?? leadData[key] ?? `%${rawKey}%`;
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action, campaignId } = body;

    if (action === "start" || action === "resume") {
      // Load campaign
      const { data: campaign, error: campErr } = await adminClient
        .from("email_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (campErr || !campaign) {
        return new Response(
          JSON.stringify({ error: "Campaign not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (campaign.status === "active" && action === "start") {
        return new Response(
          JSON.stringify({ error: "Campaign is already active" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update campaign status
      await adminClient
        .from("email_campaigns")
        .update({
          status: "active",
          started_at: campaign.started_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      // Load sequences
      const { data: sequences } = await adminClient
        .from("email_campaign_sequences")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("step_number", { ascending: true });

      if (!sequences || sequences.length === 0) {
        return new Response(
          JSON.stringify({ error: "No email sequences in this campaign" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Load pending recipients (those who haven't completed the sequence)
      const { data: recipients } = await adminClient
        .from("email_campaign_recipients")
        .select("*")
        .eq("campaign_id", campaignId)
        .in("status", ["pending", "in_progress"])
        .order("created_at", { ascending: true });

      if (!recipients || recipients.length === 0) {
        await adminClient
          .from("email_campaigns")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", campaignId);

        return new Response(
          JSON.stringify({ success: true, message: "No pending recipients. Campaign completed." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accountIds = campaign.account_ids || [];
      if (accountIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "No sender accounts assigned" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Process recipients
      let processed = 0;
      let accountIndex = 0;
      const maxBatch = 50; // Increased batch size

      for (const recipient of recipients) {
        if (processed >= maxBatch) break;

        // Re-check campaign status (in case paused)
        const { data: freshCampaign } = await adminClient
          .from("email_campaigns")
          .select("status")
          .eq("id", campaignId)
          .single();

        if (freshCampaign?.status !== "active") break;

        // Determine which step to send
        const nextStep = recipient.current_step + 1;
        const sequence = sequences.find((s: any) => s.step_number === nextStep);

        if (!sequence) {
          // Recipient has completed all steps
          await adminClient
            .from("email_campaign_recipients")
            .update({ status: "completed" })
            .eq("id", recipient.id);
          continue;
        }

        // Check send condition
        if (sequence.send_condition === "if_no_reply" && recipient.replied_at) {
          await adminClient
            .from("email_campaign_recipients")
            .update({ status: "replied" })
            .eq("id", recipient.id);
          continue;
        }

        if (sequence.send_condition === "if_no_open" && recipient.opened_at) {
          // Skip to next step
          await adminClient
            .from("email_campaign_recipients")
            .update({ current_step: nextStep })
            .eq("id", recipient.id);
          continue;
        }

        // Check if enough time has elapsed for delay
        if (recipient.last_sent_at && sequence.delay_after_ms > 0) {
          const lastSent = new Date(recipient.last_sent_at).getTime();
          const elapsed = Date.now() - lastSent;
          if (elapsed < sequence.delay_after_ms) continue; // Not yet time
        }

        // Pick sender account (round-robin)
        const accountId = accountIds[accountIndex % accountIds.length];
        accountIndex++;

        // Resolve variables in subject and body
        const leadData = recipient.lead_data || {};
        const resolvedSubject = resolveVariables(sequence.subject, leadData);
        const resolvedBody = resolveVariables(sequence.body_html, leadData);

        // Send via fastsend-send function
        try {
          const projectId = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");
          const sendRes = await fetch(`https://${projectId}.supabase.co/functions/v1/fastsend-send`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, // Use service key for internal calls
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              accountId,
              to: recipient.lead_email,
              subject: resolvedSubject,
              bodyHtml: resolvedBody,
              campaignId,
              recipientId: recipient.id,
              sequenceStepId: sequence.id,
              companyId: campaign.company_id,
              leadId: recipient.lead_id,
              leadTable: recipient.lead_table
            }),
          });

          const sendResult = await sendRes.json();

          if (sendResult.success) {
            await adminClient
              .from("email_campaign_recipients")
              .update({
                current_step: nextStep,
                status: nextStep >= sequences.length ? "completed" : "in_progress",
                last_sent_at: new Date().toISOString(),
              })
              .eq("id", recipient.id);
          } else if (sendResult.limitReached) {
            // Account limit reached — skip to next account
            continue;
          } else {
            await adminClient
              .from("email_campaign_recipients")
              .update({ status: "failed" })
              .eq("id", recipient.id);
          }
        } catch (sendErr: any) {
          console.error("Send error:", sendErr);
        }

        processed++;

        // Delay between emails
        if (campaign.delay_between_emails_ms > 0 && processed < maxBatch) {
          const delayMs = Math.min(campaign.delay_between_emails_ms, 5000); // cap at 5s in edge function
          await sleep(delayMs);
        }
      }

      // Check if there's more work to do
      const { data: remaining } = await adminClient
        .from("email_campaign_recipients")
        .select("id")
        .eq("campaign_id", campaignId)
        .in("status", ["pending", "in_progress"])
        .limit(1);

      if (remaining && remaining.length > 0) {
        // Still work to do! Chain the next invocation with a 120s gap
        console.log(`[Campaign] More work remaining for ${campaignId}. Waiting 120 seconds before next batch...`);
        
        const projectId = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");
        
        // We use a backgrounded setTimeout. 
        // Note: For very long delays, a database-driven cron is more reliable,
        // but this works for 120s in most Edge environments.
        setTimeout(() => {
          fetch(`https://${projectId}.supabase.co/functions/v1/fastsend-campaign`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ action: "resume", campaignId })
          }).catch(err => console.error("[Campaign] Chaining error:", err));
        }, 120000); // 120 seconds gap

      } else {
        await adminClient
          .from("email_campaigns")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", campaignId);
      }

      return new Response(
        JSON.stringify({ success: true, processed, message: `Processed ${processed} recipients` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "pause") {
      await adminClient
        .from("email_campaigns")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", campaignId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: start, pause, resume" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
