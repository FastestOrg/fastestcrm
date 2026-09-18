/**
 * whatsapp-webhook — Inbound WhatsApp Webhook Processor
 *
 * Handles:
 * 1. GET: Webhook verification handshake (Meta Cloud API / Baileys Gateway)
 * 2. POST: Inbound message ingestion, phone-to-lead resolution, and logging to whatsapp_message_log
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_VERIFY_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ?? "fastestcrm_wa_verify_token";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ─── 1. Webhook Verification Handshake (GET) ──────────────────────────────
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
      console.log("[whatsapp-webhook] Verification successful!");
      return new Response(challenge, { status: 200 });
    }

    // Default verify probe fallback
    if (token === WEBHOOK_VERIFY_TOKEN) {
      return new Response(challenge || "OK", { status: 200 });
    }

    return new Response("Verification failed", { status: 403 });
  }

  // ─── 2. Inbound Message Ingestion (POST) ──────────────────────────────────
  if (req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Support Meta Cloud API format and generic webhook payloads
      let messagesToProcess: Array<{
        from: string;
        body: string;
        messageId?: string;
        timestamp?: string;
        accountId?: string;
        companyId?: string;
      }> = [];

      // Case A: Meta WhatsApp Cloud API structure
      if (body.object === "whatsapp_business_account" && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          for (const change of entry.changes || []) {
            const value = change.value;
            const phoneNumberId = value?.metadata?.phone_number_id;

            // Find matching whatsapp_account by phone_number_id or phone
            let matchingAccountId: string | undefined;
            let matchingCompanyId: string | undefined;

            if (phoneNumberId) {
              const { data: acc } = await adminClient
                .from("whatsapp_accounts")
                .select("id, company_id")
                .eq("phone_number_id", phoneNumberId)
                .maybeSingle();

              if (acc) {
                matchingAccountId = acc.id;
                matchingCompanyId = acc.company_id;
              }
            }

            for (const msg of value?.messages || []) {
              let textBody = "";
              if (msg.type === "text") {
                textBody = msg.text?.body || "";
              } else if (msg.type === "button") {
                textBody = msg.button?.text || "";
              } else if (msg.type === "interactive") {
                textBody = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "";
              } else {
                textBody = `[${msg.type || "media"} message]`;
              }

              if (msg.from && textBody) {
                messagesToProcess.push({
                  from: msg.from,
                  body: textBody,
                  messageId: msg.id,
                  timestamp: msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toISOString() : new Date().toISOString(),
                  accountId: matchingAccountId,
                  companyId: matchingCompanyId,
                });
              }
            }
          }
        }
      } 
      // Case B: Direct Gateway / Baileys webhook payload format
      else if (body.from && (body.body || body.message)) {
        messagesToProcess.push({
          from: String(body.from),
          body: body.body || body.message || "",
          messageId: body.messageId || body.id,
          timestamp: body.timestamp || new Date().toISOString(),
          accountId: body.accountId || body.account_id,
          companyId: body.companyId || body.company_id,
        });
      }

      console.log(`[whatsapp-webhook] Processing ${messagesToProcess.length} inbound messages...`);

      const results: any[] = [];

      for (const item of messagesToProcess) {
        const cleanPhone = item.from.replace(/[^0-9]/g, "");
        const last10Digits = cleanPhone.slice(-10);

        // Resolve company and lead if not already provided
        let targetCompanyId = item.companyId;
        let targetLeadId: string | null = null;

        // Search across lead tables for matching phone
        const leadTables = ["leads", "leads_real_estate", "leads_saas", "leads_healthcare", "leads_insurance", "leads_travel"];
        for (const tbl of leadTables) {
          const { data: matchedLeads } = await adminClient
            .from(tbl)
            .select("id, company_id, name, phone")
            .ilike("phone", `%${last10Digits}%`)
            .limit(1);

          if (matchedLeads && matchedLeads.length > 0) {
            targetLeadId = matchedLeads[0].id;
            if (!targetCompanyId) {
              targetCompanyId = matchedLeads[0].company_id;
            }
            break;
          }
        }

        // If company still unknown, lookup first connected whatsapp account
        if (!targetCompanyId) {
          const { data: defaultAcc } = await adminClient
            .from("whatsapp_accounts")
            .select("id, company_id")
            .limit(1)
            .maybeSingle();

          if (defaultAcc) {
            targetCompanyId = defaultAcc.company_id;
            if (!item.accountId) item.accountId = defaultAcc.id;
          }
        }

        if (targetCompanyId) {
          // Insert into whatsapp_message_log as inbound
          const { data: inserted, error: insertErr } = await adminClient
            .from("whatsapp_message_log")
            .insert({
              company_id: targetCompanyId,
              account_id: item.accountId || null,
              recipient_phone: cleanPhone,
              message_body: item.body,
              status: "delivered",
              direction: "inbound",
              sent_at: item.timestamp || new Date().toISOString(),
            })
            .select()
            .single();

          if (!insertErr && inserted) {
            results.push({ success: true, logId: inserted.id, leadId: targetLeadId });
          } else {
            results.push({ success: false, error: insertErr?.message });
          }
        }
      }

      return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } catch (e: any) {
      console.error("[whatsapp-webhook] Error:", e);
      return new Response(JSON.stringify({ error: e.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
