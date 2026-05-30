import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * AI Agent Task Executor — Cron Function
 *
 * Runs every 5 minutes. Scans all lead tables for tasks (reminder_at)
 * that are due within the next 10 minutes, then dispatches the appropriate
 * AI Employee to handle them via Call/WhatsApp/Email.
 *
 * Flow:
 * 1. Find due tasks (reminder_at <= now + 10min) not yet processed
 * 2. Match each lead to its AI Employee (via company default or assignment)
 * 3. Load memory for the employee+lead pair
 * 4. Ask Gemini what action to take (with full context + tools)
 * 5. Execute the chosen action
 * 6. Update memory + log the processed task
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STANDARD_LEAD_TABLES = [
  "leads",
  "leads_real_estate",
  "leads_saas",
  "leads_healthcare",
  "leads_insurance",
  "leads_travel",
];

// Tool definitions for Gemini function calling
const AI_TOOLS = [
  {
    name: "make_call",
    description:
      "Initiate a phone call to the lead using the AI Caller voice agent. Use when a direct voice conversation is needed — follow-ups, demos, negotiations.",
    parameters: {
      type: "object",
      properties: {
        talking_points: {
          type: "string",
          description:
            "Key talking points and objectives for the call. The AI voice agent will use these during the conversation.",
        },
      },
      required: ["talking_points"],
    },
  },
  {
    name: "send_whatsapp",
    description:
      "Send a WhatsApp message to the lead. Use for quick follow-ups, sharing links/documents, or when a call isn't appropriate.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The WhatsApp message content to send.",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "send_email",
    description:
      "Send an email to the lead. Use for formal communications, proposals, detailed information sharing.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Email subject line." },
        body: {
          type: "string",
          description: "Email body content in plain text.",
        },
      },
      required: ["subject", "body"],
    },
  },
  {
    name: "update_lead_status",
    description:
      "Change the lead's status in the CRM based on conversation stage. Use to reflect progress (e.g., 'interested' → 'demo_scheduled').",
    parameters: {
      type: "object",
      properties: {
        new_status: {
          type: "string",
          description: "The new status value to set.",
        },
        reason: {
          type: "string",
          description: "Brief reason for the status change.",
        },
      },
      required: ["new_status", "reason"],
    },
  },
  {
    name: "update_lead_fields",
    description:
      "Update specific fields on the lead record. Use to record new information gathered during interactions.",
    parameters: {
      type: "object",
      properties: {
        fields: {
          type: "object",
          description:
            'Key-value pairs of fields to update. Example: {"budget": "50000", "requirements": "3BHK near metro"}',
        },
      },
      required: ["fields"],
    },
  },
  {
    name: "create_follow_up_task",
    description:
      "Schedule a follow-up task for this lead. Sets a new reminder_at datetime.",
    parameters: {
      type: "object",
      properties: {
        datetime: {
          type: "string",
          description:
            "ISO 8601 datetime for the follow-up. Example: '2026-06-02T14:00:00+05:30'",
        },
        description: {
          type: "string",
          description: "What this follow-up is about.",
        },
      },
      required: ["datetime", "description"],
    },
  },
  {
    name: "add_note",
    description:
      "Add an internal note to the lead's CRM record. Use to document observations, decisions, or context for the team.",
    parameters: {
      type: "object",
      properties: {
        note: { type: "string", description: "The note content." },
      },
      required: ["note"],
    },
  },
  {
    name: "no_action",
    description:
      "Decide to take no action right now. Use when the context doesn't warrant immediate outreach.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Why no action is being taken.",
        },
      },
      required: ["reason"],
    },
  },
];

// ─── Helper: DB logging ─────────────────────────────────────────────────────
async function logToDb(supabase: any, message: string, details?: any) {
  try {
    await supabase.from("debug_logs").insert({
      message: `[AI-Agent-Executor] ${message}`,
      details: details
        ? typeof details === "string"
          ? details
          : JSON.stringify(details)
        : null,
    });
  } catch (_) {
    console.error("[AI-Agent-Executor] logToDb failed:", _);
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

// ─── Helper: Calculate next working hours start ─────────────────────────────
function getNextWorkingHoursStart(
  timezone: string,
  startStr: string
): Date {
  const now = new Date();
  try {
    const tzParts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    }).formatToParts(now);

    const tzYear = Number(tzParts.find((p) => p.type === "year")?.value);
    const tzMonth = Number(tzParts.find((p) => p.type === "month")?.value);
    const tzDay = Number(tzParts.find((p) => p.type === "day")?.value);
    const tzHour = Number(tzParts.find((p) => p.type === "hour")?.value);
    const tzMin = Number(tzParts.find((p) => p.type === "minute")?.value);

    const [h, m] = startStr.split(":").map(Number);
    let targetDay = tzDay;
    let targetMonth = tzMonth;
    let targetYear = tzYear;

    if (tzHour > h || (tzHour === h && tzMin >= m)) {
      const d = new Date(tzYear, tzMonth - 1, tzDay + 1);
      targetDay = d.getDate();
      targetMonth = d.getMonth() + 1;
      targetYear = d.getFullYear();
    }

    const isoString = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(
      targetDay
    ).padStart(2, "0")}T${startStr}:00`;

    const tempUtc = new Date(isoString + "Z");
    const formattedParts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    }).formatToParts(tempUtc);

    const fYear = Number(formattedParts.find((p) => p.type === "year")?.value);
    const fMonth = Number(formattedParts.find((p) => p.type === "month")?.value);
    const fDay = Number(formattedParts.find((p) => p.type === "day")?.value);
    const fHour = Number(formattedParts.find((p) => p.type === "hour")?.value);
    const fMin = Number(formattedParts.find((p) => p.type === "minute")?.value);

    const diffMs =
      tempUtc.getTime() -
      new Date(Date.UTC(fYear, fMonth - 1, fDay, fHour, fMin, 0)).getTime();

    return new Date(tempUtc.getTime() + diffMs);
  } catch (err) {
    console.error("Error calculating next working hours start:", err);
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 1);
    return fallback;
  }
}

// ─── Helper: Get Gemini API key for a company ───────────────────────────────
async function getGeminiKey(supabase: any, companyId: string): Promise<string | null> {
  let { data: geminiRow } = await supabase
    .from("integration_api_keys")
    .select("api_key")
    .eq("company_id", companyId)
    .eq("service_name", "gemini")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!geminiRow?.api_key) {
    // Fallback: legacy keys stored by user_id
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", companyId);

    if (profiles?.length > 0) {
      const userIds = profiles.map((p: any) => p.id);
      const { data: legacyKey } = await supabase
        .from("integration_api_keys")
        .select("api_key")
        .in("user_id", userIds)
        .eq("service_name", "gemini")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (legacyKey) geminiRow = legacyKey;
    }
  }

  return geminiRow?.api_key || null;
}

// ─── Helper: Get today's call count for an employee ─────────────────────────
async function getTodayCallCount(supabase: any, employeeId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("ai_employee_actions")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId)
    .eq("action_type", "call")
    .gte("created_at", todayStart.toISOString());

  return count || 0;
}

// ─── Helper: Summarize old messages ─────────────────────────────────────────
async function summarizeMemory(
  geminiKey: string,
  history: any[],
  existingSummary: string | null
): Promise<{ summary: string; trimmedHistory: any[] }> {
  if (history.length <= 20) {
    return { summary: existingSummary || "", trimmedHistory: history };
  }

  // Keep last 10, summarize the rest
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
    const newSummary =
      data.candidates?.[0]?.content?.parts?.[0]?.text || existingSummary || "";
    return { summary: newSummary, trimmedHistory: toKeep };
  } catch {
    return { summary: existingSummary || "", trimmedHistory: history };
  }
}

// ─── Helper: Execute an AI action ───────────────────────────────────────────
async function executeAction(
  supabase: any,
  employee: any,
  lead: any,
  leadTable: string,
  action: any,
  companyId: string
) {
  const actionName = action.name || action.action;
  const args = action.args || action.parameters || {};

  console.log(`[AI-Agent-Executor] Executing ${actionName} for lead ${lead.id}`);

  // Log the action
  const { data: actionLog } = await supabase
    .from("ai_employee_actions")
    .insert({
      employee_id: employee.id,
      lead_id: lead.id,
      company_id: companyId,
      action_type: actionName,
      content: JSON.stringify(args),
      metadata: { lead_table: leadTable, channel: actionName },
      status: employee.autonomy_mode === "guided" ? "pending_approval" : "pending",
    })
    .select()
    .single();

  // In guided mode, don't execute — just log for approval
  if (employee.autonomy_mode === "guided" && actionName !== "no_action" && actionName !== "add_note") {
    await supabase.from("ai_ops_decisions").insert({
      lead_id: lead.id,
      company_id: companyId,
      decision_type: actionName === "update_lead_status" ? "STATUS_UPDATE" : "RE_ENGAGE",
      reasoning: args.reason || args.talking_points || args.description || "AI agent decision",
      action_details: { action: actionName, ...args, employee_id: employee.id, employee_name: employee.name },
      status: "pending_approval",
    });
    return { executed: false, mode: "guided", action: actionName };
  }

  // Full pilot execution
  try {
    switch (actionName) {
      case "make_call": {
        // Check daily limit
        const todayCalls = await getTodayCallCount(supabase, employee.id);
        if (todayCalls >= (employee.daily_call_limit || 50)) {
          await supabase
            .from("ai_employee_actions")
            .update({ status: "failed", error_message: "Daily call limit reached" })
            .eq("id", actionLog?.id);
          return { executed: false, reason: "Daily call limit reached" };
        }

        if (!employee.ai_caller_agent_id) {
          await supabase
            .from("ai_employee_actions")
            .update({ status: "failed", error_message: "No AI Caller agent configured" })
            .eq("id", actionLog?.id);
          return { executed: false, reason: "No AI Caller agent configured" };
        }

        if (!lead.phone) {
          await supabase
            .from("ai_employee_actions")
            .update({ status: "failed", error_message: "Lead has no phone number" })
            .eq("id", actionLog?.id);
          return { executed: false, reason: "Lead has no phone number" };
        }

        // Trigger AI call via the existing trigger-ai-call function
        const callRes = await fetch(`${SUPABASE_URL}/functions/v1/trigger-ai-call`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            lead_id: lead.id,
            lead_phone: lead.phone,
            lead_name: lead.name,
            agent_id: employee.ai_caller_agent_id,
            company_id: companyId,
          }),
        });

        const callResult = await callRes.json();
        await supabase
          .from("ai_employee_actions")
          .update({
            status: callResult.success ? "completed" : "failed",
            error_message: callResult.error || null,
            metadata: { ...actionLog?.metadata, call_result: callResult },
          })
          .eq("id", actionLog?.id);

        return { executed: callResult.success, result: callResult };
      }

      case "send_whatsapp": {
        if (!employee.whatsapp_account_id || !lead.phone) {
          await supabase
            .from("ai_employee_actions")
            .update({
              status: "failed",
              error_message: !employee.whatsapp_account_id
                ? "No WhatsApp account configured"
                : "Lead has no phone number",
            })
            .eq("id", actionLog?.id);
          return { executed: false, reason: "Missing WhatsApp config or lead phone" };
        }

        // Fetch WhatsApp account details
        const { data: waAccount } = await supabase
          .from("whatsapp_accounts")
          .select("*")
          .eq("id", employee.whatsapp_account_id)
          .single();

        if (waAccount) {
          // Send via WhatsApp Cloud API
          try {
            const waRes = await fetch(
              `https://graph.facebook.com/v18.0/${waAccount.phone_number_id}/messages`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${waAccount.access_token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  to: lead.phone.replace(/[^0-9]/g, ""),
                  type: "text",
                  text: { body: args.message },
                }),
              }
            );
            const waResult = await waRes.json();
            await supabase
              .from("ai_employee_actions")
              .update({ status: waRes.ok ? "completed" : "failed", metadata: { ...actionLog?.metadata, wa_result: waResult } })
              .eq("id", actionLog?.id);
          } catch (waErr: any) {
            await supabase
              .from("ai_employee_actions")
              .update({ status: "failed", error_message: waErr.message })
              .eq("id", actionLog?.id);
          }
        }
        return { executed: true };
      }

      case "send_email": {
        if (!employee.email_account_id || !lead.email) {
          await supabase
            .from("ai_employee_actions")
            .update({
              status: "failed",
              error_message: !employee.email_account_id
                ? "No email account configured"
                : "Lead has no email address",
            })
            .eq("id", actionLog?.id);
          return { executed: false, reason: "Missing email config or lead email" };
        }

        try {
          const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/email-proxy`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              action: "send",
              account_id: employee.email_account_id,
              to: lead.email,
              subject: args.subject,
              body: args.body,
            }),
          });
          const emailResult = await emailRes.json();
          await supabase
            .from("ai_employee_actions")
            .update({ status: emailRes.ok ? "completed" : "failed", metadata: { ...actionLog?.metadata, email_result: emailResult } })
            .eq("id", actionLog?.id);
        } catch (emailErr: any) {
          await supabase
            .from("ai_employee_actions")
            .update({ status: "failed", error_message: emailErr.message })
            .eq("id", actionLog?.id);
        }
        return { executed: true };
      }

      case "update_lead_status": {
        await supabase
          .from(leadTable as any)
          .update({ status: args.new_status })
          .eq("id", lead.id);

        await supabase
          .from("ai_employee_actions")
          .update({ status: "completed" })
          .eq("id", actionLog?.id);

        return { executed: true, new_status: args.new_status };
      }

      case "update_lead_fields": {
        const allowedFields = [
          "budget",
          "requirements",
          "notes",
          "college",
          "product_purchased",
          "lead_source",
          "company",
          "designation",
          "city",
          "tags",
        ];
        const safeFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(args.fields || {})) {
          if (allowedFields.includes(key)) {
            safeFields[key] = value;
          }
        }

        if (Object.keys(safeFields).length > 0) {
          await supabase
            .from(leadTable as any)
            .update(safeFields)
            .eq("id", lead.id);
        }

        await supabase
          .from("ai_employee_actions")
          .update({ status: "completed" })
          .eq("id", actionLog?.id);

        return { executed: true, updated_fields: safeFields };
      }

      case "create_follow_up_task": {
        await supabase
          .from(leadTable as any)
          .update({
            reminder_at: args.datetime,
            last_notification_sent_at: null, // Reset so process-reminders picks it up
          })
          .eq("id", lead.id);

        await supabase
          .from("ai_employee_actions")
          .update({ status: "completed" })
          .eq("id", actionLog?.id);

        return { executed: true, new_reminder: args.datetime };
      }

      case "add_note": {
        // Append to lead notes
        const existingNotes = lead.notes || "";
        const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        const newNotes = `${existingNotes}\n\n[AI: ${employee.name} — ${timestamp}]\n${args.note}`.trim();

        await supabase
          .from(leadTable as any)
          .update({ notes: newNotes })
          .eq("id", lead.id);

        await supabase
          .from("ai_employee_actions")
          .update({ status: "completed" })
          .eq("id", actionLog?.id);

        return { executed: true };
      }

      case "no_action": {
        await supabase
          .from("ai_employee_actions")
          .update({ status: "completed" })
          .eq("id", actionLog?.id);
        return { executed: true, skipped: true, reason: args.reason };
      }

      default:
        return { executed: false, reason: `Unknown action: ${actionName}` };
    }
  } catch (err: any) {
    await supabase
      .from("ai_employee_actions")
      .update({ status: "failed", error_message: err.message })
      .eq("id", actionLog?.id);
    return { executed: false, error: err.message };
  }
}

// ─── Main handler ───────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now
  let totalProcessed = 0;
  let totalActions = 0;

  try {
    await logToDb(supabase, "Task executor started", {
      now: now.toISOString(),
      window_end: windowEnd.toISOString(),
    });

    // Discover all lead tables (standard + custom)
    const { data: companies } = await supabase
      .from("companies")
      .select("id, custom_leads_table")
      .not("custom_leads_table", "is", null);

    const customTables = new Set<string>();
    if (companies) {
      for (const co of companies) {
        if (co.custom_leads_table && !STANDARD_LEAD_TABLES.includes(co.custom_leads_table)) {
          customTables.add(co.custom_leads_table);
        }
      }
    }
    const allTables = [...STANDARD_LEAD_TABLES, ...customTables];

    // Process each lead table
    for (const tableName of allTables) {
      try {
        // Find leads with due tasks
        const { data: dueLeads, error: queryErr } = await supabase
          .from(tableName as any)
          .select("*")
          .not("reminder_at", "is", null)
          .lte("reminder_at", windowEnd.toISOString())
          .order("reminder_at", { ascending: true })
          .limit(100);

        if (queryErr || !dueLeads || dueLeads.length === 0) continue;

        for (const lead of dueLeads) {
          try {
            const companyId = lead.company_id;
            if (!companyId) continue;

            // Check if already processed
            const { data: existing } = await supabase
              .from("ai_agent_task_log")
              .select("id")
              .eq("lead_id", lead.id)
              .eq("task_reminder_at", lead.reminder_at)
              .eq("lead_table", tableName)
              .maybeSingle();

            if (existing) continue; // Already processed

            // Find AI Employee for this company (first active one)
            const { data: employees } = await supabase
              .from("ai_employees" as any)
              .select("*")
              .eq("company_id", companyId)
              .eq("is_active", true)
              .limit(1);

            if (!employees || employees.length === 0) continue;
            const employee = employees[0];

            // Verify working hours constraint
            const tz = employee.timezone || "Asia/Kolkata";
            const startHour = employee.working_hours_start || "09:00";
            const endHour = employee.working_hours_end || "18:00";

            if (!isWithinWorkingHours(tz, startHour, endHour)) {
              const nextStart = getNextWorkingHoursStart(tz, startHour);
              await logToDb(
                supabase,
                `Task execution for lead ${lead.name} deferred: outside working hours (${startHour} - ${endHour} ${tz}). Rescheduling to ${nextStart.toISOString()}.`
              );

              await supabase
                .from(tableName as any)
                .update({
                  reminder_at: nextStart.toISOString(),
                  last_notification_sent_at: null,
                })
                .eq("id", lead.id);

              continue;
            }

            // Get Gemini API key
            const geminiKey = await getGeminiKey(supabase, companyId);
            if (!geminiKey) {
              await logToDb(supabase, `No Gemini key for company ${companyId}`);
              continue;
            }

            // Load memory
            const { data: memory } = await supabase
              .from("ai_employee_memory")
              .select("*")
              .eq("employee_id", employee.id)
              .eq("lead_id", lead.id)
              .maybeSingle();

            const history = memory?.memory_data || [];
            const memorySummary = memory?.summary || "";

            // Summarize if needed
            const { summary: finalSummary, trimmedHistory } = await summarizeMemory(
              geminiKey,
              history,
              memorySummary
            );

            // Build channel availability context
            const channels = employee.channels_priority || ["call", "whatsapp", "email"];
            const availableChannels: string[] = [];
            if (channels.includes("call") && employee.ai_caller_agent_id && lead.phone) {
              availableChannels.push("make_call");
            }
            if (channels.includes("whatsapp") && employee.whatsapp_account_id && lead.phone) {
              availableChannels.push("send_whatsapp");
            }
            if (channels.includes("email") && employee.email_account_id && lead.email) {
              availableChannels.push("send_email");
            }

            // Determine task context
            const reminderDate = new Date(lead.reminder_at);
            const isPastDue = reminderDate < now;
            const taskContext = isPastDue
              ? `URGENT: This follow-up was scheduled for ${reminderDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} and is OVERDUE. Act promptly.`
              : `A follow-up task is scheduled for ${reminderDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (coming up in ${Math.round((reminderDate.getTime() - now.getTime()) / 60000)} minutes).`;

            // Build system prompt
            const systemPrompt = `You are "${employee.name}", an AI Sales Employee.

PERSONALITY & BEHAVIOR:
${employee.system_prompt || "Be professional, friendly, and outcome-driven."}

KNOWLEDGE BASE:
${employee.knowledge_base || "No specific knowledge base provided."}

YOUR GOAL:
${employee.outcome_goal || "Move the lead forward in the sales pipeline."}

TASK CONTEXT:
${taskContext}

LEAD INFORMATION:
- Name: ${lead.name}
- Phone: ${lead.phone || "Not available"}
- Email: ${lead.email || "Not available"}
- WhatsApp: ${lead.whatsapp || lead.phone || "Not available"}
- Current Status: ${lead.status || "Unknown"}
- Company: ${lead.company || "Unknown"}
- Source: ${lead.lead_source || "Unknown"}
- Notes: ${lead.notes || "None"}
- Created: ${lead.created_at}

${finalSummary ? `\nCONVERSATION HISTORY SUMMARY:\n${finalSummary}` : ""}

AVAILABLE CHANNELS (in priority order): ${availableChannels.length > 0 ? availableChannels.join(", ") : "None — only add_note and no_action available"}

INSTRUCTIONS:
- Choose the BEST single action to take right now based on the lead's current stage, history, and task context.
- Prefer channels in the priority order listed above.
- If the lead has been contacted recently (check history), consider a different channel or spacing out.
- If changing lead status, use values that make sense for the current conversation stage.
- Always be contextual — use what you know from previous interactions.
- If no outreach channel is available, add a note instead.`;

            // Filter tools to only available ones + always available tools
            const alwaysAvailable = ["update_lead_status", "update_lead_fields", "create_follow_up_task", "add_note", "no_action"];
            const filteredTools = AI_TOOLS.filter(
              (t) => availableChannels.includes(t.name) || alwaysAvailable.includes(t.name)
            );

            // Call Gemini with function calling
            const geminiPayload = {
              contents: [
                ...trimmedHistory,
                {
                  role: "user",
                  parts: [
                    {
                      text: `A scheduled task is due for lead "${lead.name}". Review the context and decide what action to take. Use exactly one tool.`,
                    },
                  ],
                },
              ],
              system_instruction: { parts: [{ text: systemPrompt }] },
              tools: [{ function_declarations: filteredTools }],
              tool_config: { function_calling_config: { mode: "ANY" } },
            };

            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(geminiPayload),
              }
            );

            if (!geminiRes.ok) {
              const errText = await geminiRes.text();
              await logToDb(supabase, `Gemini API error for lead ${lead.id}`, errText);
              continue;
            }

            const geminiData = await geminiRes.json();
            const candidate = geminiData.candidates?.[0]?.content;
            const functionCall = candidate?.parts?.[0]?.functionCall;

            if (!functionCall) {
              // Gemini returned text instead of function call — log as note
              const textResponse = candidate?.parts?.[0]?.text;
              if (textResponse) {
                await executeAction(supabase, employee, lead, tableName, { name: "add_note", args: { note: textResponse } }, companyId);
              }
            } else {
              // Execute the chosen action
              const result = await executeAction(
                supabase,
                employee,
                lead,
                tableName,
                { name: functionCall.name, args: functionCall.args },
                companyId
              );

              totalActions++;

              await logToDb(supabase, `Action executed for lead ${lead.name}`, {
                action: functionCall.name,
                args: functionCall.args,
                result,
                employee: employee.name,
              });
            }

            // Update memory
            const newHistory = [
              ...trimmedHistory,
              {
                role: "user",
                parts: [{ text: `[SYSTEM] Task due: Follow-up for ${lead.name}. Status: ${lead.status}` }],
              },
              {
                role: "model",
                parts: [
                  {
                    text: functionCall
                      ? `[ACTION] ${functionCall.name}: ${JSON.stringify(functionCall.args)}`
                      : "[ACTION] add_note",
                  },
                ],
              },
            ];

            await supabase.from("ai_employee_memory").upsert({
              employee_id: employee.id,
              lead_id: lead.id,
              company_id: companyId,
              memory_data: newHistory.slice(-20),
              summary: finalSummary,
              lead_context_snapshot: {
                status: lead.status,
                name: lead.name,
                phone: lead.phone,
                email: lead.email,
                snapshot_at: now.toISOString(),
              },
              interaction_count: (memory?.interaction_count || 0) + 1,
              last_interaction_at: now.toISOString(),
            });

            // Log to task log (prevents re-processing)
            await supabase.from("ai_agent_task_log").insert({
              lead_id: lead.id,
              employee_id: employee.id,
              company_id: companyId,
              lead_table: tableName,
              task_reminder_at: lead.reminder_at,
              action_taken: functionCall?.name || "add_note",
              channel_used: functionCall?.name || "note",
              result: { args: functionCall?.args },
            });

            totalProcessed++;
          } catch (leadErr: any) {
            console.error(`[AI-Agent-Executor] Error processing lead ${lead.id}:`, leadErr);
            await logToDb(supabase, `Error processing lead ${lead.id}`, leadErr.message);
          }
        }
      } catch (tableErr: any) {
        console.error(`[AI-Agent-Executor] Error processing table ${tableName}:`, tableErr);
        await logToDb(supabase, `Error processing table ${tableName}`, tableErr.message);
      }
    }

    await logToDb(supabase, "Task executor completed", {
      total_processed: totalProcessed,
      total_actions: totalActions,
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        actions: totalActions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[AI-Agent-Executor] Fatal error:", err);
    await logToDb(supabase, "Fatal error", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
