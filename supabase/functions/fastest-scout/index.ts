import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, accept, prefer',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// ─── Fastest-Scout Edge Function ────────────────────────────────────────────
// 3-step AI + Apollo pipeline:
//   1. interpret  → Gemini extracts entities from natural language
//   2. search     → Apollo.io People Search API
//   3. enrich     → Gemini vibe-checks results + generates icebreakers
//   4. save_to_crm → Import selected leads into the user's CRM database

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { action } = body;

    if (!action) throw new Error("action is required");

    // ─── Fetch Keys from DB (Company-specific) ────────────────────────
    const getApiKey = async (service: string, company_id: string): Promise<string> => {
      // 1. Find any active key directly associated with this company
      const { data: keyData, error: keyError } = await supabase
        .from("integration_api_keys")
        .select("api_key")
        .eq("service_name", service)
        .eq("is_active", true)
        .eq("company_id", company_id)
        .limit(1)
        .maybeSingle();

      if (keyError) throw keyError;
      
      if (keyData) return keyData.api_key;

      // Fallback: If no company-specific key found via company_id, 
      // try the legacy method of checking user_ids in that company
      const { data: companyUsers, error: usersError } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_id", company_id);

      if (!usersError && companyUsers && companyUsers.length > 0) {
        const userIds = companyUsers.map((u: any) => u.id);
        const { data: legacyKey } = await supabase
          .from("integration_api_keys")
          .select("api_key")
          .eq("service_name", service)
          .eq("is_active", true)
          .in("user_id", userIds)
          .limit(1)
          .maybeSingle();
        
        if (legacyKey) return legacyKey.api_key;
      }

      // Final Fallback: Global key for gemini
      if (service === 'gemini') {
         const { data: globalKey } = await supabase
          .from("integration_api_keys")
          .select("api_key")
          .eq("service_name", "gemini")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
         if (globalKey) return globalKey.api_key;
      }
      
      const display = service.charAt(0).toUpperCase() + service.slice(1);
      throw new Error(`${display} API key not found for your company. Connect ${display} in the Integrations page.`);
    };

    const company_id = body.company_id;
    if (!company_id) throw new Error("company_id is required");

    // ─── Helper: call Gemini ──────────────────────────────────────────
    const callGemini = async (prompt: string, key: string, responseJson = true) => {
      console.log("[Fastest-Scout] Calling Gemini...");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            topP: 0.85,
            maxOutputTokens: 4096,
            ...(responseJson ? { response_mime_type: "application/json" } : {}),
          },
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("[Fastest-Scout] Gemini API Error:", errText);
        throw new Error(`Gemini API Error: ${errText}`);
      }
      const result = await res.json();
      let text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.error("[Fastest-Scout] Empty response from Gemini. Full result:", JSON.stringify(result));
        throw new Error("Gemini returned an empty response.");
      }
      // Clean markdown fencing
      text = text.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/\n?```$/, "");
      return responseJson ? JSON.parse(text.trim()) : text.trim();
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ACTION: INTERPRET
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (action === "interpret") {
      const { prompt } = body;
      console.log("[Fastest-Scout] Action: interpret | Prompt:", prompt);
      if (!prompt) throw new Error("prompt is required for interpret action");

      const geminiKey = await getApiKey("gemini", company_id);
      console.log("[Fastest-Scout] Gemini key retrieved (length):", geminiKey?.length);

      const systemPrompt = `
You are "Fastest-Scout," an elite Sales Intelligence Agent. Your goal is to translate natural language prospecting requests into structured JSON payloads for the Apollo.io People Search API.

EXTRACTION RULES:
When a user describes a target (e.g., "Find me CEOs of Series B fintechs in London"), extract:
- Person Titles (CEO, Founder, VP of Sales, etc.)
- Geography / Locations
- Organization Categories / Industries
- Company Stage / Size (e.g., Series B, 50-200 employees)
- Keywords (specific technologies or niches)

APOLLO API SCHEMA MAPPING:
- Titles → person_titles[]
- Person locations → person_locations[]
- Organization locations → organization_locations[]
- Employee Count → organization_num_employees_ranges[] (use ranges like "1,10", "11,20", "21,50", "51,100", "101,200", "201,500", "501,1000", "1001,2000", "2001,5000", "5001,10000")
- Revenue → organization_revenue_ranges[]
- Keywords → q_organization_keyword_tags[]

CLARIFICATION:
If the user's target is too broad (e.g., "Find me businesses"), respond with:
{
  "needs_clarification": true,
  "message": "Your question asking for specific details..."
}

Otherwise, return:
{
  "needs_clarification": false,
  "summary": "A human-readable summary of the filters you are about to apply",
  "extracted_entities": {
    "titles": ["..."],
    "locations": ["..."],
    "industries": ["..."],
    "company_stage": "...",
    "keywords": ["..."],
    "employee_range": "..."
  },
  "apollo_params": {
    "q_organization_keyword_tags": [],
    "person_titles": [],
    "person_locations": [],
    "organization_locations": [],
    "organization_num_employees_ranges": [],
    "page": 1,
    "per_page": 25
  }
}

USER QUERY: "${prompt}"
`;

      const parsed = await callGemini(systemPrompt, geminiKey);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ACTION: SEARCH
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (action === "search") {
      const { apollo_params } = body;
      if (!apollo_params) throw new Error("apollo_params required for search action");

      const apolloKey = await getApiKey("apollo", company_id);

      const apolloPayload = {
        ...apollo_params,
        page: apollo_params.page || 1,
        per_page: Math.min(apollo_params.per_page || 25, 50),
      };
      console.log("[Fastest-Scout] Calling Apollo People Search with payload:", JSON.stringify(apolloPayload));

      const apolloRes = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Cache-Control": "no-cache",
          "x-api-key": apolloKey,
        },
        body: JSON.stringify(apolloPayload),
      });

      const apolloRawText = await apolloRes.text();
      console.log("[Fastest-Scout] Apollo Response Status:", apolloRes.status);
      console.log("[Fastest-Scout] Apollo Response (first 500 chars):", apolloRawText.substring(0, 500));

      if (!apolloRes.ok) {
        console.error("[Fastest-Scout] Apollo API Error:", apolloRawText);
        throw new Error(`Apollo API Error (${apolloRes.status}): ${apolloRawText}`);
      }

      let apolloData;
      try {
        apolloData = JSON.parse(apolloRawText);
      } catch (parseErr) {
        console.error("[Fastest-Scout] Failed to parse Apollo response as JSON:", apolloRawText.substring(0, 300));
        throw new Error("Apollo returned an invalid JSON response.");
      }

      const people = apolloData.people || apolloData.contacts || [];
      const totalCount = apolloData.pagination?.total_entries || apolloData.pagination?.total || people.length;

      // Map to a clean structure
      const leads = people.map((p: any) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
        title: p.title,
        headline: p.headline,
        email: p.email,
        email_status: p.email_status,
        linkedin_url: p.linkedin_url,
        photo_url: p.photo_url,
        city: p.city,
        state: p.state,
        country: p.country,
        organization: {
          name: p.organization?.name,
          website_url: p.organization?.website_url,
          industry: p.organization?.industry,
          estimated_num_employees: p.organization?.estimated_num_employees,
          short_description: p.organization?.short_description,
          logo_url: p.organization?.logo_url,
          founded_year: p.organization?.founded_year,
          keywords: p.organization?.keywords || [],
        },
      }));

      return new Response(
        JSON.stringify({ leads, total_count: totalCount, page: apollo_params.page || 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ACTION: ENRICH
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (action === "enrich") {
      const { leads, original_prompt } = body;
      if (!leads || !original_prompt) throw new Error("leads and original_prompt required for enrich action");

      const geminiKey = await getApiKey("gemini", company_id);

      const enrichPrompt = `
You are "Fastest-Scout," an elite AI Sales Intelligence enrichment agent.

ORIGINAL USER REQUEST: "${original_prompt}"

LEADS DATA (from Apollo.io):
${JSON.stringify(leads.slice(0, 25), null, 2)}

YOUR TASK:
1. **Vibe Check**: Score each lead from 0 to 100 based on how well they match the "spirit" of the user's original request. Consider title relevance, company fit, industry alignment, and location match.
2. **Group**: Categorize leads as "🔥 Hot Match" (score ≥ 75), "⚡ Good Fit" (score 50-74), or "🔍 Explore" (score < 50).
3. **Icebreakers**: For the top 3 highest-scored leads, generate a personalized icebreaker message (1-2 sentences) based on their company description and role.
4. **Quick Summary**: Write a 1-2 sentence summary of why these leads collectively match the user's "vibe".

RETURN JSON:
{
  "quick_summary": "These leads are...",
  "enriched_leads": [
    {
      "id": "apollo_id",
      "vibe_score": 85,
      "vibe_category": "🔥 Hot Match",
      "relevance_reason": "Short explanation of why this lead fits",
      "icebreaker": "Hey [Name], I noticed your company just..."  // null if not in top 3
    }
  ]
}

IMPORTANT: Return ALL leads from the input, enriched with scores. Sort by vibe_score descending.
`;

      const enriched = await callGemini(enrichPrompt, geminiKey);
      return new Response(JSON.stringify(enriched), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ACTION: SAVE TO CRM
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (action === "save_to_crm") {
      const { leads_to_save, company_id, user_id } = body;
      if (!leads_to_save || !company_id || !user_id) {
        throw new Error("leads_to_save, company_id, and user_id required for save_to_crm action");
      }

      // Determine leads table
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("custom_leads_table, industry")
        .eq("id", company_id)
        .single();

      if (companyError) throw companyError;

      let tableName = company?.custom_leads_table || "leads";
      if (!company?.custom_leads_table) {
        const industries = ["real_estate", "saas", "healthcare", "insurance", "travel"];
        if (industries.includes(company?.industry || "")) {
          tableName = `leads_${company.industry}`;
        }
      }

      const insertData = leads_to_save.map((lead: any) => ({
        company_id,
        sales_owner_id: user_id,
        name: lead.name,
        email: lead.email || null,
        phone: null,
        status: "new",
        lead_source: "Fastest Scout (Apollo)",
        notes: [
          lead.title ? `Title: ${lead.title}` : "",
          lead.organization?.name ? `Company: ${lead.organization.name}` : "",
          lead.organization?.industry ? `Industry: ${lead.organization.industry}` : "",
          lead.linkedin_url ? `LinkedIn: ${lead.linkedin_url}` : "",
          lead.city ? `Location: ${[lead.city, lead.state, lead.country].filter(Boolean).join(", ")}` : "",
        ].filter(Boolean).join("\n"),
      }));

      const { data: inserted, error: insertError } = await supabase
        .from(tableName as any)
        .insert(insertData)
        .select("id");

      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({
          success: true,
          message: `${inserted?.length || 0} leads imported to your CRM successfully.`,
          count: inserted?.length || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error("[Fastest-Scout Error]:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
