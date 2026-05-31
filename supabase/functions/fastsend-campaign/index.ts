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
  return template.replace(/%([a-zA-Z_]+)%/g, (_, key) => {
    return leadData[key] ?? leadData[key.toLowerCase()] ?? `%${key}%`;
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processConcurrent(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    const p = task();
    executing.add(p);
    p.finally(() => executing.delete(p));
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
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
      const concurrencyLimit = 10;

      const recipientUpdates: any[] = [];
      const campaignLogs: any[] = [];
      const tasks: (() => Promise<void>)[] = [];

      // Re-check campaign status (in case paused)
      const { data: freshCampaign } = await adminClient
        .from("email_campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();

      if (freshCampaign?.status === "active") {
        for (const recipient of recipients) {
          if (processed >= maxBatch) break;

          // Determine which step to send
          const nextStep = recipient.current_step + 1;
          const sequence = sequences.find((s: any) => s.step_number === nextStep);

          if (!sequence) {
            // Recipient has completed all steps
            recipientUpdates.push({
              id: recipient.id,
              status: "completed",
              updated_at: new Date().toISOString()
            });
            continue;
          }

          // Check send condition
          if (sequence.send_condition === "if_no_reply" && recipient.replied_at) {
            recipientUpdates.push({
              id: recipient.id,
              status: "replied",
              updated_at: new Date().toISOString()
            });
            continue;
          }

          if (sequence.send_condition === "if_no_open" && recipient.opened_at) {
            // Skip to next step
            recipientUpdates.push({
              id: recipient.id,
              current_step: nextStep,
              updated_at: new Date().toISOString()
            });
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

          processed++;

          const currentRecipient = recipient;
          const currentAccountId = accountId;
          const currentResolvedSubject = resolvedSubject;
          const currentResolvedBody = resolvedBody;
          const currentSequence = sequence;

          tasks.push(async () => {
            try {
              const projectId = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");
              const sendRes = await fetch(`https://${projectId}.supabase.co/functions/v1/fastsend-send`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, // Use service key for internal calls
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  accountId: currentAccountId,
                  to: currentRecipient.lead_email,
                  subject: currentResolvedSubject,
                  bodyHtml: currentResolvedBody,
                  campaignId,
                  recipientId: currentRecipient.id,
                  sequenceStepId: currentSequence.id,
                  companyId: campaign.company_id,
                  leadId: currentRecipient.lead_id,
                  leadTable: currentRecipient.lead_table
                }),
              });

              const sendResult = await sendRes.json();

              if (sendResult.success) {
                recipientUpdates.push({
                  id: currentRecipient.id,
                  current_step: nextStep,
                  status: nextStep >= sequences.length ? "completed" : "in_progress",
                  last_sent_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
              } else if (sendResult.limitReached) {
                // Account limit reached — this count shouldn't block, but for now mark as pending to retry
              } else {
                const now = new Date().toISOString();
                recipientUpdates.push({
                  id: currentRecipient.id,
                  status: "failed",
                  error_message: sendResult.error || "Unknown error",
                  updated_at: now
                });

                // Log failed status in email_campaign_logs
                campaignLogs.push({
                  company_id: campaign.company_id,
                  campaign_id: campaignId,
                  recipient_id: currentRecipient.id,
                  sequence_step_id: currentSequence.id,
                  sent_by_account_id: currentAccountId,
                  recipient_email: currentRecipient.lead_email,
                  subject: currentResolvedSubject,
                  status: "failed",
                  error_message: sendResult.error || "Unknown error",
                  sent_at: now,
                });
              }
            } catch (sendErr: any) {
              console.error("Send error:", sendErr);
              const now = new Date().toISOString();
              recipientUpdates.push({
                id: currentRecipient.id,
                status: "failed",
                error_message: sendErr.message || "Unknown execution error",
                updated_at: now
              });

              // Log caught failed status in email_campaign_logs
              campaignLogs.push({
                company_id: campaign.company_id,
                campaign_id: campaignId,
                recipient_id: currentRecipient.id,
                sequence_step_id: currentSequence.id,
                sent_by_account_id: currentAccountId,
                recipient_email: currentRecipient.lead_email,
                subject: currentResolvedSubject,
                status: "failed",
                error_message: sendErr.message || "Unknown execution error",
                sent_at: now,
              });
            }

            // Optional delay between emails in the concurrent pool
            if (campaign.delay_between_emails_ms > 0) {
              const delayMs = Math.min(campaign.delay_between_emails_ms, 5000); // cap at 5s in edge function
              await sleep(delayMs);
            }
          });
        }

        // Execute fetches concurrently
        if (tasks.length > 0) {
          await processConcurrent(tasks, concurrencyLimit);
        }

        // Bulk upsert updates to email_campaign_recipients
        if (recipientUpdates.length > 0) {
          const { error: bulkUpError } = await adminClient
            .from("email_campaign_recipients")
            .upsert(recipientUpdates);
          if (bulkUpError) {
            console.error("Bulk update email_campaign_recipients error:", bulkUpError.message);
          }
        }

        // Bulk insert logs into email_campaign_logs
        if (campaignLogs.length > 0) {
          const { error: bulkLogError } = await adminClient
            .from("email_campaign_logs")
            .insert(campaignLogs);
          if (bulkLogError) {
            console.error("Bulk insert email_campaign_logs error:", bulkLogError.message);
          }
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
