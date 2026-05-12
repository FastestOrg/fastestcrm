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

    // 2. Fetch Lead Context
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error(`Lead not found: ${leadError?.message}`);
    }

    // 3. Fetch/Initialize Memory
    const { data: memory, error: memoryError } = await supabase
      .from("ai_employee_memory")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("lead_id", leadId)
      .maybeSingle();

    const history = memory?.memory_data || [];

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

    // 5. Assemble Context
    const systemInstruction = `
      You are an AI Employee named "${employee.name}". 
      Your Persona: ${employee.system_prompt}
      Your Goal: ${employee.outcome_goal}
      Knowledge Base: ${employee.knowledge_base}
      
      Lead Context:
      Name: ${lead.name}
      Company: ${lead.company}
      Current Status: ${lead.status}
      Other Context: ${JSON.stringify(lead.enrichment_data || {})}

      INSTRUCTIONS:
      - Be professional, empathetic, and outcome-driven.
      - Use the provided context to build rapport.
      - NEVER mention you are an AI unless explicitly asked and it's helpful.
      - Always drive toward the outcome goal.
      - If you decide to send a WhatsApp or Email, return a JSON response with the 'action' and 'content'.
    `;

    const userMessage = message || "Initiate contact based on lead status.";

    // 6. Call Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${integration.api_key}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [
          ...history,
          { role: "user", parts: [{ text: userMessage }] }
        ],
        generationConfig: {
          temperature: 0.7,
          response_mime_type: "application/json"
        }
      }),
    });

    const aiResult = await response.json();
    if (aiResult.error) throw new Error(`Gemini API Error: ${aiResult.error.message}`);

    const aiResponseText = aiResult.candidates?.[0]?.content?.parts?.[0]?.text;
    const aiAction = JSON.parse(aiResponseText);

    // 7. Execute Action (Record in DB)
    const { data: actionLog, error: actionError } = await supabase
      .from("ai_employee_actions")
      .insert({
        employee_id: employeeId,
        lead_id: leadId,
        action_type: aiAction.action || 'note',
        content: aiAction.content || '',
        metadata: { ...aiAction, channel: channelType },
        status: 'pending' // Usually would be 'completed' if synchronous, but outreach is often async
      })
      .select()
      .single();

    if (actionError) console.error("Failed to log action:", actionError);

    console.log(`AI Employee ${employee.name} (ID: ${employeeId}) decided to ${aiAction.action} for lead ${lead.name}`);
    
    // 8. Update Memory
    const newHistory = [
      ...history,
      { role: "user", parts: [{ text: userMessage }] },
      { role: "model", parts: [{ text: aiResponseText }] }
    ].slice(-20); 

    await supabase
      .from("ai_employee_memory")
      .upsert({
        employee_id: employeeId,
        lead_id: leadId,
        memory_data: newHistory,
        last_interaction_at: new Date().toISOString()
      });

    return new Response(JSON.stringify({ 
      success: true, 
      action: aiAction.action, 
      content: aiAction.content,
      actionId: actionLog?.id,
      aiResponse: aiAction
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
