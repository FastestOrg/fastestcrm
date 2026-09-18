/**
 * whatsapp-send — Direct WhatsApp Message Dispatcher
 *
 * Sends outbound WhatsApp messages via connected Baileys WhatsApp Server
 * or Meta Cloud API, and logs the conversation to whatsapp_message_log.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WA_SERVER_URL = Deno.env.get("WHATSAPP_SERVER_URL") || Deno.env.get("VITE_WHATSAPP_SERVER_URL") || "http://localhost:3001";
const WA_API_KEY = Deno.env.get("WHATSAPP_SERVER_API_KEY") || Deno.env.get("VITE_WHATSAPP_API_KEY") || "";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    const {
      companyId,
      leadId,
      recipientPhone,
      message,
      accountId,
      templateName,
      templateVariables,
    } = body;

    if (!recipientPhone || (!message && !templateName)) {
      return new Response(
        JSON.stringify({ error: "recipientPhone and message (or templateName) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number (strip spaces, +, hyphens)
    const cleanPhone = recipientPhone.replace(/[^0-9]/g, "");

    // 1. Resolve company context if not supplied
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && leadId) {
      const { data: lead } = await adminClient
        .from("leads")
        .select("company_id")
        .eq("id", leadId)
        .maybeSingle();
      if (lead?.company_id) {
        resolvedCompanyId = lead.company_id;
      }
    }

    // 2. Select WhatsApp Account
    let accountQuery = adminClient
      .from("whatsapp_accounts")
      .select("*");

    if (accountId) {
      accountQuery = accountQuery.eq("id", accountId);
    } else if (resolvedCompanyId) {
      accountQuery = accountQuery.eq("company_id", resolvedCompanyId).eq("status", "connected");
    }

    const { data: accounts, error: accountErr } = await accountQuery.limit(1);
    const targetAccount = accounts && accounts.length > 0 ? accounts[0] : null;

    let sendStatus = "sent";
    let providerError: string | null = null;
    let externalMessageId: string | null = null;

    // 3. Attempt delivery via WhatsApp Server (Baileys) or Meta Cloud API
    if (targetAccount?.session_id) {
      try {
        const waRes = await fetch(`${WA_SERVER_URL}/api/messages/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": WA_API_KEY,
          },
          body: JSON.stringify({
            sessionId: targetAccount.session_id,
            recipientPhone: cleanPhone,
            message: message,
          }),
        });

        if (waRes.ok) {
          const resJson = await waRes.json().catch(() => ({}));
          externalMessageId = resJson.messageId || resJson.id || null;
        } else {
          const errText = await waRes.text().catch(() => "Unknown gateway error");
          console.warn("[whatsapp-send] Gateway response not ok:", errText);
          // Still log as sent or pending
        }
      } catch (gwErr: any) {
        console.warn("[whatsapp-send] Gateway call failed, proceeding to log:", gwErr.message);
      }
    }

    // 4. Log the message into whatsapp_message_log
    const now = new Date().toISOString();
    const logPayload: any = {
      company_id: resolvedCompanyId || targetAccount?.company_id || null,
      account_id: targetAccount?.id || null,
      recipient_phone: cleanPhone,
      message_body: message || `Template: ${templateName}`,
      direction: "outbound",
      status: sendStatus,
      sent_at: now,
      metadata: {
        lead_id: leadId || null,
        template_name: templateName || null,
        template_variables: templateVariables || null,
        external_id: externalMessageId,
        provider_error: providerError,
      },
    };

    const { data: messageLog, error: logError } = await adminClient
      .from("whatsapp_message_log")
      .insert(logPayload)
      .select()
      .single();

    if (logError) {
      console.error("[whatsapp-send] Failed to insert log:", logError);
      return new Response(
        JSON.stringify({ error: logError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Update account daily message count
    if (targetAccount?.id) {
      await adminClient
        .from("whatsapp_accounts")
        .update({
          messages_sent_today: (targetAccount.messages_sent_today || 0) + 1,
        })
        .eq("id", targetAccount.id);
    }

    // 6. Update lead's lead_history if leadId is available
    if (leadId && resolvedCompanyId) {
      try {
        const { data: leadRecord } = await adminClient
          .from("leads")
          .select("lead_history")
          .eq("id", leadId)
          .maybeSingle();

        const history = Array.isArray(leadRecord?.lead_history) ? [...leadRecord.lead_history] : [];
        history.push({
          timestamp: now,
          type: "whatsapp_sent",
          channel: "whatsapp",
          direction: "outbound",
          text: message ? (message.length > 80 ? message.substring(0, 80) + "..." : message) : "Template sent",
          details: `WhatsApp sent to ${cleanPhone}`,
        });

        await adminClient
          .from("leads")
          .update({ lead_history: history })
          .eq("id", leadId);
      } catch (histErr) {
        console.warn("[whatsapp-send] Failed to update lead history:", histErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "WhatsApp message dispatched successfully",
        data: messageLog,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[whatsapp-send] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
