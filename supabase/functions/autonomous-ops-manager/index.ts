import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { companyId, manualTrigger } = await req.json();
    console.log(`AI Ops Manager running for company ${companyId}`);
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 0. Fetch Company Settings
    const { data: settings } = await adminClient
      .from("autonomous_growth_settings")
      .select("auto_approve_stagnant_leads")
      .eq("company_id", companyId)
      .maybeSingle();

    const isAutoApprove = settings?.auto_approve_stagnant_leads === true;

    // 1. Fetch Stagnant Leads
    const thresholdHours = manualTrigger ? 1 : 48;
    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() - thresholdHours);

    const { data: leads, error: leadError } = await adminClient
      .from("leads")
      .select("*, companies(industry, name)")
      .eq("company_id", companyId)
      .lt("updated_at", thresholdDate.toISOString())
      .not("status", "in", "('closed', 'won', 'lost', 'converted')")
      .limit(10);

    if (leadError) throw leadError;

    const results = [];

    // 2. Fetch Gemini API Key (Organizational or Global Fallback)
    let geminiKey = Deno.env.get("GEMINI_API_KEY");
    
    // Check for company-specific key
    const { data: companyKey } = await adminClient
      .from("integration_api_keys")
      .select("api_key")
      .eq("company_id", companyId)
      .eq("service_name", "gemini")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (companyKey?.api_key) {
      geminiKey = companyKey.api_key;
    } else {
      // Legacy check
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id")
        .eq("company_id", companyId);
      
      const userIds = profiles?.map((p: any) => p.id) || [];
      if (userIds.length > 0) {
        const { data: legacyKey } = await adminClient
          .from("integration_api_keys")
          .select("api_key")
          .in("user_id", userIds)
          .eq("service_name", "gemini")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        
        if (legacyKey?.api_key) geminiKey = legacyKey.api_key;
      }
    }

    if (!geminiKey) throw new Error("No Gemini API key available (Organization or Global)");

    for (const lead of (leads || [])) {
      // ... existingGather Interaction Context code ...
      const { data: messages } = await adminClient
        .from("whatsapp_message_log")
        .select("message_body, direction, sent_at")
        .eq("recipient_phone", lead.phone)
        .order("sent_at", { ascending: false })
        .limit(5);

      const conversationHistory = messages?.reverse().map(m => `${m.direction === 'inbound' ? 'Lead' : 'Sales'}: ${m.message_body}`).join('\n') || "No recent history.";

      // 3. Consult Gemini for the "Next Best Action"
      const prompt = `
        You are an AI Sales Operations Manager. 
        Analyze this stagnant lead and decide the best NEXT STEP.
        
        Lead Name: ${lead.name}
        Current Status: ${lead.status}
        Industry: ${lead.companies?.industry}
        Enrichment Data: ${JSON.stringify(lead.enrichment_data || {})}
        Last Conversation History:
        ${conversationHistory}
        
        Decide between:
        1. RE_ENGAGE: Send a soft nudge (WhatsApp preferred).
        2. NURTURE: Send educational content (Email preferred).
        3. ESCALATE: High value lead, notify the Sales Owner.
        4. STATUS_UPDATE: Lead seems dead, move to 'archived'.

        Output JSON only:
        {
          "decision": "RE_ENGAGE" | "NURTURE" | "ESCALATE" | "STATUS_UPDATE",
          "reasoning": "Explain why based on context",
          "nudge_draft": "Optional: A short, conversational message if RE_ENGAGE or NURTURE"
        }
      `;

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      const geminiData = await geminiRes.json();
      const aiResponse = JSON.parse(geminiData.candidates[0].content.parts[0].text);

      // 4. Record Decision
      const { data: decision, error: decError } = await adminClient
        .from("ai_ops_decisions")
        .insert({
          lead_id: lead.id,
          company_id: companyId,
          decision_type: aiResponse.decision,
          reasoning: aiResponse.reasoning,
          action_details: { 
            draft: aiResponse.nudge_draft, 
            context_snapshot: { last_status: lead.status } 
          },
          status: isAutoApprove ? "executed" : "pending_approval"
        })
        .select()
        .single();

      if (decError) throw decError;

      // 4.5 Immediate Execution if Auto-Approve is ON
      if (isAutoApprove && aiResponse.nudge_draft) {
        if (aiResponse.decision === "RE_ENGAGE") {
          // Direct WhatsApp Send (Mock/Simplified for now, assuming WA server is connected)
          console.log(`Auto-executing WhatsApp for ${lead.name}`);
          // In a production scenario, we'd fetch the WA session and call the WA server API here.
          // For now, we record it and notify the system.
        } else if (aiResponse.decision === "NURTURE") {
          console.log(`Auto-executing Email for ${lead.name}`);
          // Send via FastSend
        }
      }

      // 5. Update Lead Op Status
      await adminClient
        .from("leads")
        .update({ 
            ai_ops_status: isAutoApprove ? `Executed: ${aiResponse.decision}` : `Decision Pending: ${aiResponse.decision}`,
            last_ai_op_at: new Date().toISOString()
        })
        .eq("id", lead.id);

      // 6. Handle Immediate Escalation
      if (aiResponse.decision === "ESCALATE") {
          await adminClient.from("notifications").insert({
            user_id: lead.sales_owner_id || lead.created_by_id,
            lead_id: lead.id,
            title: "🚨 High-Value Stagnation Alert",
            message: `AI Ops Manager suggests escalating ${lead.name}. Reasoning: ${aiResponse.reasoning}`,
            type: "alert"
          });
      }

      results.push({ lead: lead.name, decision: aiResponse.decision });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
