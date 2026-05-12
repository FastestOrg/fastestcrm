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
    const { transcript, leadId, companyId, mode } = await req.json();
    if (!transcript) {
        throw new Error("No transcript provided");
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch Lead context if available
    let leadContext = "";
    if (leadId) {
        const { data: lead } = await adminClient
            .from("leads")
            .select("name, company, enrichment_data")
            .eq("id", leadId)
            .single();
        if (lead) {
            leadContext = `Lead: ${lead.name} at ${lead.company}. AI Enrichment: ${JSON.stringify(lead.enrichment_data)}`;
        }
    }

    // 2. Fetch Gemini API Key
    let { data: integration } = await adminClient
      .from("integration_api_keys")
      .select("api_key")
      .eq("company_id", companyId)
      .eq("service_name", "gemini")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    // Fallback for legacy keys (by user_id)
    if (!integration?.api_key) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id")
        .eq("company_id", companyId);
      
      if (profiles && profiles.length > 0) {
        const userIds = profiles.map((p: any) => p.id);
        const { data: legacyKey } = await adminClient
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
      throw new Error("No active Gemini API key found for this company. Please connect Google Gemini in the Integrations page.");
    }

    // 3. Generate Content using Gemini
    let prompt = "";
    if (mode === 'quotation_suggestion') {
      prompt = `You are a Professional Quotation Specialist. 
Analyze the following request and generate a list of appropriate line items for a formal quotation.

## Context
${transcript}

## Task
Generate a list of 3-5 line items that would be included in this quotation.
For each item, provide:
1. A clear description.
2. A suggested quantity.
3. A suggested unit price (if possible based on context, otherwise use realistic market prices).

## Output Format
Return ONLY valid JSON:
{
  "line_items": [
    { "description": "...", "quantity": 1, "unit_price": 5000 }
  ],
  "summary_battlecard": "Brief summary of why these items were chosen."
}
`;
    } else {
      prompt = `You are a High-Performance Sales Coach. 
Analyze the following meeting snippet and create a "Live Battlecard" for the sales rep.

## Lead Context
${leadContext}

## Meeting Transcript / Notes
${transcript}

## Task
1. Identify the 3 most likely "Objections" current or coming.
2. Provide a "Pro Rebuttal" for each.
3. Suggest a "Proactive Question" to regain control of the call.
4. Suggest a "Hard Close" or "Soft Close" strategy based on intent signals.

## Output Format
Return ONLY valid JSON:
{
  "objections": [{ "point": "Price", "rebuttal": "...", "confidence": "high" }],
  "tactical_tips": ["Tip 1", "Tip 2"],
  "closing_strategy": "The Recommendation",
  "summary_battlecard": "A 3-sentence summary of how to win this deal."
}
`;
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${integration.api_key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        }),
      }
    );

    const aiData = await res.json();
    if (aiData.error) throw new Error(`Gemini Error: ${aiData.error.message}`);
    
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    const cleanedJson = content.replace(/```json\s*|```/g, "").trim();
    const result = JSON.parse(cleanedJson);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Closing Orchestrator Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
