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

    console.log(`Processing enrichment for lead ${leadId} (Company: ${companyId})`);

    // 1. Fetch Company Settings & API Key
    const { data: settings } = await adminClient
      .from("autonomous_growth_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!settings || !settings.is_enabled) {
      console.log("Autonomy disabled for this company. Skipping.");
      return new Response(JSON.stringify({ skipped: true, reason: "Autonomy disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Fallback if direct company_id lookup fails
    if (!integration?.api_key) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id")
        .eq("company_id", companyId);

      const userIds = profiles?.map((p: any) => p.id) || [];
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

    if (!integration?.api_key) {
      throw new Error("No active Gemini API key found for this company.");
    }

    // 2.5 Perform Real-time Research via Brave Search (if key is available)
    const braveKey = Deno.env.get("BRAVE_SEARCH_API_KEY");
    let searchResults = "No live search results available.";
    
    if (braveKey) {
        try {
            console.log("Performing Brave Search research...");
            const searchQuery = `company ${record.company || record.domain} industry news pain points`;
            const braveRes = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}`, {
                headers: { "Accept": "application/json", "X-Subscription-Token": braveKey }
            });
            const braveData = await braveRes.json();
            searchResults = JSON.stringify(braveData.web?.results?.slice(0, 3).map((r: any) => ({
                title: r.title,
                description: r.description,
                url: r.url
            })));
        } catch (searchErr) {
            console.error("Brave Search Error:", searchErr.message);
        }
    }

    // 3. Perform AI Research
    const prompt = `You are a Senior Strategic Sales Analyst specializing in the EDUCATION and SALES verticals.
Research and enrich the following lead data for a B2B sales context.

## Lead Context
Name: ${record.name || "Unknown"}
Company: ${record.company || "Unknown"}
Domain: ${record.domain || "Unknown"}
Industry: ${record.industry || "General"}
Notes: ${record.notes || "None"}

## Live Web Research (Brave Search)
${searchResults}

## Task
1. Analyze the company's core offering. If they are in Education/EdTech, focus on enrollment and curriculum challenges. If in Sales/CRM, focus on lead volume and conversion.
2. Identify likely "Pain Points" specifically for their scale.
3. Suggest a "Value Hook" for our sales outreach.
4. Categorize their "Buyer Intent" (High, Medium, Low).

## RESTRICTIONS
- NEVER suggest actions that involve deleting data.
- Focus on growth and optimization.

## Output Format
Return ONLY valid JSON:
{
  "pain_points": ["Point 1", "Point 2"],
  "likely_competitors": ["Comp A", "Comp B"],
  "value_hook": "A short sentence starting with 'Since you are...'",
  "buyer_intent": "High",
  "research_summary": "A 2-sentence professional summary of the company."
}
`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${integration.api_key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    const aiData = await res.json();
    if (aiData.error) throw new Error(`Gemini Error: ${aiData.error.message}`);
    
    const enrichedText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!enrichedText) throw new Error("Gemini returned empty response.");

    // Clean JSON markdown if present
    const cleanedJson = enrichedText.replace(/```json\s*|```/g, "").trim();
    const enrichmentData = JSON.parse(cleanedJson);

    // 4. Update Lead
    const { error: updateError } = await adminClient
      .from("leads")
      .update({
        enrichment_data: enrichmentData,
        enrichment_status: "completed",
        last_enriched_at: new Date().toISOString(),
        lead_history: [...(record.lead_history || []), { 
            at: new Date().toISOString(), 
            action: "AI Enrichment Completed", 
            by: "Autonomous Agent" 
        }]
      })
      .eq("id", leadId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, data: enrichmentData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Enrichment Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
