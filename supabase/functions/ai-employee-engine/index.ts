import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Tool definitions for Gemini function calling ───────────────────────────
const TOOL_DECLARATIONS = [
  {
    name: "make_call",
    description: "Initiate a phone call to the lead using the AI Caller voice agent.",
    parameters: {
      type: "object",
      properties: {
        talking_points: { type: "string", description: "Key talking points and objectives for the call." },
      },
      required: ["talking_points"],
    },
  },
  {
    name: "send_whatsapp",
    description: "Send a WhatsApp message to the lead.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "The WhatsApp message content." },
      },
      required: ["message"],
    },
  },
  {
    name: "send_email",
    description: "Send an email to the lead.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Email subject line." },
        body: { type: "string", description: "Email body content." },
      },
      required: ["subject", "body"],
    },
  },
  {
    name: "update_lead_status",
    description: "Change the lead's CRM status based on conversation stage.",
    parameters: {
      type: "object",
      properties: {
        new_status: { type: "string", description: "The new status value." },
        reason: { type: "string", description: "Brief reason for the change." },
      },
      required: ["new_status", "reason"],
    },
  },
  {
    name: "update_lead_fields",
    description: "Update specific fields on the lead record.",
    parameters: {
      type: "object",
      properties: {
        fields: { type: "object", description: 'Key-value pairs of fields to update.' },
      },
      required: ["fields"],
    },
  },
  {
    name: "create_follow_up_task",
    description: "Schedule a follow-up task for this lead by setting a reminder.",
    parameters: {
      type: "object",
      properties: {
        datetime: { type: "string", description: "ISO 8601 datetime for the follow-up." },
        description: { type: "string", description: "What this follow-up is about." },
      },
      required: ["datetime", "description"],
    },
  },
  {
    name: "add_note",
    description: "Add an internal note to the lead's CRM record.",
    parameters: {
      type: "object",
      properties: {
        note: { type: "string", description: "The note content." },
      },
      required: ["note"],
    },
  },
  {
    name: "respond_to_message",
    description: "Send a text response in the current conversation channel (reply in chat).",
    parameters: {
      type: "object",
      properties: {
        response: { type: "string", description: "The text response to send." },
      },
      required: ["response"],
    },
  },
];

// ─── Helper: Summarize old messages when history exceeds 20 ─────────────────
async function summarizeMemory(
  geminiKey: string,
  history: any[],
  existingSummary: string | null
): Promise<{ summary: string; trimmedHistory: any[] }> {
  if (history.length <= 20) {
    return { summary: existingSummary || "", trimmedHistory: history };
  }

  const toSummarize = history.slice(0, history.length - 10);
  const toKeep = history.slice(history.length - 10);

  const summaryPrompt = `Summarize the following conversation history into a concise paragraph. Include key facts, decisions made, objections raised, and current relationship status.
  
${existingSummary ? `Previous summary: ${existingSummary}\n\n` : ""}New messages to summarize:
${toSummarize.map((m: any) => `${m.role}: ${m.parts?.[0]?.text || ""}`).join("\n")}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: summaryPrompt }] }],
          generationConfig: { maxOutputTokens: 500 },
        }),
      }
    );
    const data = await res.json();
    const newSummary = data.candidates?.[0]?.content?.parts?.[0]?.text || existingSummary || "";
    return { summary: newSummary, trimmedHistory: toKeep };
  } catch {
    return { summary: existingSummary || "", trimmedHistory: history };
  }
}

// ─── Helper: Check if within working hours ──────────────────────────────────
function isWithinWorkingHours(
  timezone: string,
  startStr: string,
  endStr: string
): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === "hour")?.value || "00";
    const minutePart = parts.find((p) => p.type === "minute")?.value || "00";
    const currentTimeStr = `${hourPart}:${minutePart}`;

    if (startStr <= endStr) {
      return currentTimeStr >= startStr && currentTimeStr <= endStr;
    } else {
      return currentTimeStr >= startStr || currentTimeStr <= endStr;
    }
  } catch (e) {
    console.error("Error formatting timezone:", e);
    return true; // Fallback
  }
}

// ─── Helper: Execute a tool-called action ───────────────────────────────────
async function executeToolAction(
  supabase: any,
  employee: any,
  lead: any,
  functionCall: any,
  companyId: string,
  channelType?: string
): Promise<any> {
  const actionName = functionCall.name;
  const args = functionCall.args || {};

  // Check working hours for outreach actions
  const outreachActions = ["make_call", "send_whatsapp", "send_email"];
  if (outreachActions.includes(actionName)) {
    const tz = employee.timezone || "Asia/Kolkata";
    const startHour = employee.working_hours_start || "09:00";
    const endHour = employee.working_hours_end || "18:00";

    if (!isWithinWorkingHours(tz, startHour, endHour)) {
      const { data: actionLog } = await supabase
        .from("ai_employee_actions")
        .insert({
          employee_id: employee.id,
          lead_id: lead.id,
          company_id: companyId,
          action_type: actionName,
          content: JSON.stringify(args),
          metadata: { channel: channelType || actionName },
          status: "failed",
          error_message: `Cannot execute outreach outside working hours (${startHour} - ${endHour} ${tz})`,
        })
        .select()
        .single();
        
      return { 
        action: actionName, 
        error: `Cannot execute ${actionName} outside working hours (${startHour} - ${endHour} ${tz}).` 
      };
    }
  }

  // Log the action
  const actionStatus = employee.autonomy_mode === "guided"
    && actionName !== "respond_to_message"
    && actionName !== "add_note"
    && actionName !== "no_action"
    ? "pending_approval"
    : "pending";

  const { data: actionLog } = await supabase
    .from("ai_employee_actions")
    .insert({
      employee_id: employee.id,
      lead_id: lead.id,
      company_id: companyId,
      action_type: actionName,
      content: JSON.stringify(args),
      metadata: { channel: channelType || actionName },
      status: actionStatus,
    })
    .select()
    .single();

  // In guided mode for outreach/CRM actions, queue for approval
  if (actionStatus === "pending_approval") {
    await supabase.from("ai_ops_decisions").insert({
      lead_id: lead.id,
      company_id: companyId,
      decision_type: actionName === "update_lead_status" ? "STATUS_UPDATE" : "WORKFLOW_ACTION",
      reasoning: args.reason || args.talking_points || args.description || "AI employee decision",
      action_details: { action: actionName, ...args, employee_id: employee.id, employee_name: employee.name },
      status: "pending_approval",
    });
    return { action: actionName, content: args, mode: "guided", pending_approval: true, actionId: actionLog?.id };
  }

  // Full pilot / auto-execute
  try {
    switch (actionName) {
      case "make_call": {
        if (!employee.ai_caller_agent_id || !lead.phone) {
          await supabase.from("ai_employee_actions")
            .update({ status: "failed", error_message: "Missing caller config or phone" })
            .eq("id", actionLog?.id);
          return { action: actionName, error: "Missing caller config or phone" };
        }

        const callRes = await fetch(`${SUPABASE_URL}/functions/v1/trigger-ai-call`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({
            lead_id: lead.id,
            lead_phone: lead.phone,
            lead_name: lead.name,
            agent_id: employee.ai_caller_agent_id,
            company_id: companyId,
          }),
        });
        const callResult = await callRes.json();
        await supabase.from("ai_employee_actions")
          .update({ status: callResult.success ? "completed" : "failed", error_message: callResult.error || null })
          .eq("id", actionLog?.id);
        return { action: actionName, result: callResult, actionId: actionLog?.id };
      }

      case "send_whatsapp": {
        if (!employee.whatsapp_account_id || !lead.phone) {
          await supabase.from("ai_employee_actions")
            .update({ status: "failed", error_message: "Missing WhatsApp config or phone" })
            .eq("id", actionLog?.id);
          return { action: actionName, error: "Missing config" };
        }

        const { data: waAccount } = await supabase
          .from("whatsapp_accounts")
          .select("*")
          .eq("id", employee.whatsapp_account_id)
          .single();

        if (waAccount) {
          const waRes = await fetch(
            `https://graph.facebook.com/v18.0/${waAccount.phone_number_id}/messages`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${waAccount.access_token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: lead.phone.replace(/[^0-9]/g, ""),
                type: "text",
                text: { body: args.message },
              }),
            }
          );
          await supabase.from("ai_employee_actions")
            .update({ status: waRes.ok ? "completed" : "failed" })
            .eq("id", actionLog?.id);
        }
        return { action: actionName, content: args.message, actionId: actionLog?.id };
      }

      case "send_email": {
        if (!employee.email_account_id || !lead.email) {
          await supabase.from("ai_employee_actions")
            .update({ status: "failed", error_message: "Missing email config or address" })
            .eq("id", actionLog?.id);
          return { action: actionName, error: "Missing config" };
        }

        const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/email-proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({
            action: "send",
            account_id: employee.email_account_id,
            to: lead.email,
            subject: args.subject,
            body: args.body,
          }),
        });
        const emailResult = await emailRes.json();
        await supabase.from("ai_employee_actions")
          .update({ status: emailRes.ok ? "completed" : "failed" })
          .eq("id", actionLog?.id);
        return { action: actionName, content: args, result: emailResult, actionId: actionLog?.id };
      }

      case "update_lead_status": {
        await supabase.from("leads").update({ status: args.new_status }).eq("id", lead.id);
        await supabase.from("ai_employee_actions").update({ status: "completed" }).eq("id", actionLog?.id);
        return { action: actionName, new_status: args.new_status, actionId: actionLog?.id };
      }

      case "update_lead_fields": {
        const allowedFields = ["budget", "requirements", "notes", "college", "product_purchased", "lead_source", "company", "designation", "city", "tags"];
        const safeFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(args.fields || {})) {
          if (allowedFields.includes(key)) safeFields[key] = value;
        }
        if (Object.keys(safeFields).length > 0) {
          await supabase.from("leads").update(safeFields).eq("id", lead.id);
        }
        await supabase.from("ai_employee_actions").update({ status: "completed" }).eq("id", actionLog?.id);
        return { action: actionName, updated_fields: safeFields, actionId: actionLog?.id };
      }

      case "create_follow_up_task": {
        await supabase.from("leads").update({
          reminder_at: args.datetime,
          last_notification_sent_at: null,
        }).eq("id", lead.id);
        await supabase.from("ai_employee_actions").update({ status: "completed" }).eq("id", actionLog?.id);
        return { action: actionName, datetime: args.datetime, actionId: actionLog?.id };
      }

      case "add_note": {
        const existing = lead.notes || "";
        const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        const newNotes = `${existing}\n\n[AI: ${employee.name} — ${timestamp}]\n${args.note}`.trim();
        await supabase.from("leads").update({ notes: newNotes }).eq("id", lead.id);
        await supabase.from("ai_employee_actions").update({ status: "completed" }).eq("id", actionLog?.id);
        return { action: actionName, actionId: actionLog?.id };
      }

      case "respond_to_message": {
        await supabase.from("ai_employee_actions").update({ status: "completed" }).eq("id", actionLog?.id);
        return { action: actionName, content: args.response, actionId: actionLog?.id };
      }

      default:
        return { action: actionName, error: "Unknown action" };
    }
  } catch (err: any) {
    await supabase.from("ai_employee_actions")
      .update({ status: "failed", error_message: err.message })
      .eq("id", actionLog?.id);
    return { action: actionName, error: err.message };
  }
}

// ─── Main handler ───────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { employeeId, leadId, companyId, message, channelType } = await req.json();

    if (!employeeId || !leadId || !companyId) {
      throw new Error("Missing required parameters: employeeId, leadId, companyId");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch AI Employee Config
    const { data: employee, error: employeeError } = await supabase
      .from("ai_employees")
      .select("*")
      .eq("id", employeeId)
      .single();

    if (employeeError || !employee) {
      throw new Error(`AI Employee not found: ${employeeError?.message}`);
    }

    // 2. Fetch Lead Context (full record + history)
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error(`Lead not found: ${leadError?.message}`);
    }

    // Fetch recent lead history (status changes, interactions)
    const { data: leadHistory } = await supabase
      .from("lead_history")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch recent AI actions on this lead
    const { data: recentActions } = await supabase
      .from("ai_employee_actions")
      .select("action_type, content, status, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5);

    // 3. Fetch/Initialize Memory with summarization
    const { data: memory } = await supabase
      .from("ai_employee_memory")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("lead_id", leadId)
      .maybeSingle();

    const rawHistory = memory?.memory_data || [];
    const existingSummary = memory?.summary || null;

    // 4. Fetch Gemini API Key
    let { data: integration } = await supabase
      .from("integration_api_keys")
      .select("api_key")
      .eq("company_id", companyId)
      .eq("service_name", "gemini")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    // Fallback for legacy keys (by user_id)
    if (!integration?.api_key) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_id", companyId);
      
      if (profiles && profiles.length > 0) {
        const userIds = profiles.map((p: any) => p.id);
        const { data: legacyKey } = await supabase
          .from("integration_api_keys")
          .select("api_key")
          .in("user_id", userIds)
          .eq("service_name", "gemini")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        
        if (legacyKey) integration = legacyKey;
      }
    }

    if (!integration?.api_key) {
      throw new Error("No active Gemini API key found for this company. Please connect it in the Integrations page.");
    }

    // 5. Summarize memory if needed
    const { summary: finalSummary, trimmedHistory } = await summarizeMemory(
      integration.api_key,
      rawHistory,
      existingSummary
    );

    // 6. Build available tools based on employee config
    const availableTools = TOOL_DECLARATIONS.filter((t) => {
      if (t.name === "make_call") return !!employee.ai_caller_agent_id && !!lead.phone;
      if (t.name === "send_whatsapp") return !!employee.whatsapp_account_id && !!lead.phone;
      if (t.name === "send_email") return !!employee.email_account_id && !!lead.email;
      return true; // CRM actions + respond_to_message + add_note always available
    });

    // 7. Assemble rich system prompt
    const recentActionsText = (recentActions || [])
      .map((a: any) => `- ${a.action_type}: ${a.content} (${a.status}) at ${new Date(a.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`)
      .join("\n");

    const historyText = (leadHistory || [])
      .map((h: any) => `- ${h.field_changed}: ${h.old_value} → ${h.new_value} (${new Date(h.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })})`)
      .join("\n");

    const channelsPriority = employee.channels_priority || ["call", "whatsapp", "email"];

    const systemInstruction = `You are an AI Employee named "${employee.name}". 

PERSONA & BEHAVIOR:
${employee.system_prompt || "Be professional, friendly, and outcome-driven."}

YOUR GOAL:
${employee.outcome_goal || "Move the lead forward in the sales pipeline."}

KNOWLEDGE BASE:
${employee.knowledge_base || "No specific knowledge base provided."}

LEAD FULL CONTEXT:
- Name: ${lead.name}
- Phone: ${lead.phone || "N/A"}
- Email: ${lead.email || "N/A"}
- WhatsApp: ${lead.whatsapp || lead.phone || "N/A"}
- Current Status: ${lead.status || "Unknown"}
- Company: ${lead.company || "Unknown"}
- Designation: ${lead.designation || "Unknown"}
- City: ${lead.city || "Unknown"}
- Lead Source: ${lead.lead_source || "Unknown"}
- Budget: ${lead.budget || "Not specified"}
- Requirements: ${lead.requirements || "Not specified"}
- College: ${lead.college || "N/A"}
- Product: ${lead.product_purchased || "None"}
- Notes: ${lead.notes || "None"}
- Created: ${lead.created_at}
- Last Updated: ${lead.updated_at}
- Reminder: ${lead.reminder_at || "None scheduled"}

${finalSummary ? `\nCONVERSATION HISTORY SUMMARY (older interactions):\n${finalSummary}` : ""}

${recentActionsText ? `\nRECENT AI ACTIONS ON THIS LEAD:\n${recentActionsText}` : ""}

${historyText ? `\nLEAD HISTORY (recent changes):\n${historyText}` : ""}

CHANNEL PRIORITY ORDER: ${channelsPriority.join(" → ")}
AUTONOMY MODE: ${employee.autonomy_mode || "guided"} ${employee.autonomy_mode === "guided" ? "(outreach actions will need human approval)" : "(auto-execute all actions)"}

INSTRUCTIONS:
- Use the tools provided to take action. You can call exactly ONE tool per turn.
- For direct conversation replies (e.g., responding to an incoming message), use "respond_to_message".
- For outreach (proactive contact), prefer channels in the priority order listed.
- When changing lead status, choose values that reflect the actual conversation stage.
- Use "create_follow_up_task" to schedule next touchpoints.
- Use "add_note" to log important observations for the team.
- NEVER reveal that you are an AI unless specifically asked.
- Be contextual — use conversation history and lead info to personalize interactions.
- If the lead seems unresponsive, consider trying a different channel.`;

    const userMessage = message || "Initiate contact based on lead status.";

    // 8. Call Gemini with function calling
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${integration.api_key}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [
          ...trimmedHistory,
          { role: "user", parts: [{ text: userMessage }] }
        ],
        tools: [{ function_declarations: availableTools }],
        tool_config: { function_calling_config: { mode: "AUTO" } },
        generationConfig: { temperature: 0.7 },
      }),
    });

    const aiResult = await response.json();
    if (aiResult.error) throw new Error(`Gemini API Error: ${aiResult.error.message}`);

    const candidate = aiResult.candidates?.[0]?.content;
    const functionCall = candidate?.parts?.[0]?.functionCall;
    const textResponse = candidate?.parts?.[0]?.text;

    let actionResult: any;

    if (functionCall) {
      // Gemini chose a tool — execute it
      actionResult = await executeToolAction(supabase, employee, lead, functionCall, companyId, channelType);
    } else if (textResponse) {
      // Gemini returned plain text — treat as a respond_to_message
      actionResult = await executeToolAction(
        supabase, employee, lead,
        { name: "respond_to_message", args: { response: textResponse } },
        companyId, channelType
      );
    } else {
      throw new Error("Gemini returned empty response");
    }

    // 9. Update Memory with summarization
    const newHistory = [
      ...trimmedHistory,
      { role: "user", parts: [{ text: userMessage }] },
      { role: "model", parts: [functionCall ? { functionCall } : { text: textResponse || "" }] },
    ].slice(-20);

    await supabase
      .from("ai_employee_memory")
      .upsert({
        employee_id: employeeId,
        lead_id: leadId,
        company_id: companyId,
        memory_data: newHistory,
        summary: finalSummary,
        lead_context_snapshot: {
          status: lead.status,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          snapshot_at: new Date().toISOString(),
        },
        interaction_count: (memory?.interaction_count || 0) + 1,
        last_interaction_at: new Date().toISOString(),
      });

    console.log(`AI Employee ${employee.name} (ID: ${employeeId}) → ${actionResult?.action || "respond"} for lead ${lead.name}`);

    return new Response(JSON.stringify({ 
      success: true, 
      ...actionResult,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("AI Employee Engine Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
