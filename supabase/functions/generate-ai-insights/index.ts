import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { company_id } = await req.json();
    if (!company_id) throw new Error("company_id is required");

    console.log(`[AI Insights] Generating insights for company ${company_id}`);

    // 1. Fetch Gemini API Key
    const { data: keyData, error: keyError } = await supabase
      .from('integration_api_keys')
      .select('api_key')
      .eq('service_name', 'gemini')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (keyError) throw keyError;
    if (!keyData) {
      throw new Error("Gemini API key not found in Integrations. Please connect Google Gemini in the Integrations page first.");
    }
    const geminiKey = keyData.api_key;

    // 2. Determine Leads Table
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('custom_leads_table, industry, name')
      .eq('id', company_id)
      .single();

    if (companyError) throw companyError;

    let tableName = company?.custom_leads_table || 'leads';
    if (!company?.custom_leads_table) {
      const industries = ['real_estate', 'saas', 'healthcare', 'insurance', 'travel'];
      if (industries.includes(company?.industry || '')) {
          tableName = `leads_${company.industry}`;
      }
    }

    console.log(`[AI Insights] Using table: ${tableName}`);

    // 3. Fetch All Leads
    // Fetch a manageable but representative subset if data is HUGE, 
    // but the requirement is "all", so we'll do our best with status counts first.
    // To handle "Take full table data", we'll fetch core summary data.
    const { data: leads, error: leadsError } = await supabase
      .from(tableName as any)
      .select('id, name, email, phone, status, sales_owner_id, lead_source, college, revenue_projected, revenue_received, reminder_at, created_at')
      .eq('company_id', company_id);

    if (leadsError) {
      console.error(`Error querying ${tableName}:`, leadsError.message);
      throw leadsError;
    }

    // 4. Fetch Profiles for employee names
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', company_id);

    const profileMap: Record<string, string> = {};
    if (profiles) {
      profiles.forEach(p => {
        if (p.full_name) profileMap[p.id] = p.full_name;
      });
    }

    // 5. Calculate Data Strength & Metrics
    const fieldsToTrack = ['name', 'email', 'phone', 'status', 'sales_owner_id', 'lead_source'];
    let totalFieldsCount = (leads?.length || 0) * fieldsToTrack.length;
    let filledFieldsCount = 0;
    
    const now = new Date();
    const statusCounts: Record<string, number> = {};
    const employeeMetrics: Record<string, any> = {};
    const urgentLeadsCount = (leads || []).filter(l => l.reminder_at && new Date(l.reminder_at) < now && l.status !== 'paid').length;

    (leads || []).forEach(lead => {
      // Data strength calc
      fieldsToTrack.forEach(f => {
        if (lead[f]) filledFieldsCount++;
      });

      // Status distribution
      statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;

      // Employee performance
      if (lead.sales_owner_id) {
        const name = profileMap[lead.sales_owner_id] || 'Unknown';
        if (!employeeMetrics[name]) {
          employeeMetrics[name] = { total: 0, paid: 0, revenue: 0, urgent_missed: 0 };
        }
        employeeMetrics[name].total++;
        if (lead.status === 'paid') {
          employeeMetrics[name].paid++;
          employeeMetrics[name].revenue += (lead.revenue_received || 0);
        }
        if (lead.reminder_at && new Date(lead.reminder_at) < now && lead.status !== 'paid') {
          employeeMetrics[name].urgent_missed++;
        }
      }
    });

    const dataStrengthPercentage = totalFieldsCount > 0 ? Math.round((filledFieldsCount / totalFieldsCount) * 100) : 0;

    // 6. Gemini Prompt
    const summary = {
      company: company?.name,
      total_leads: leads?.length || 0,
      status_distribution: statusCounts,
      data_strength_percentage: dataStrengthPercentage,
      overdue_reminders: urgentLeadsCount,
      employee_performance_metrics: employeeMetrics,
      // Provide a few recent leads (masked for privacy)
      recent_activity: (leads || []).slice(0, 15).map(l => ({
        status: l.status,
        source: l.lead_source,
        college: l.college,
        owner: profileMap[l.sales_owner_id || ''] || 'Unassigned'
      }))
    };

    const prompt = `
      You are the Master CRM Strategist AI for FastestCRM. Your goal is to provide a premium, deep-dive analysis of a company's sales data.
      
      CONTEXT: "${company?.name}" leads and task performance report.
      DATA: ${JSON.stringify(summary, null, 2)}
      
      TASK LIST:
      1. DATA STRENGTH: Evaluate the completeness of their database (${dataStrengthPercentage}%). Why is it high/low? What's missing?
      2. STRATEGIC STEPS: Suggest exactly 3 action items to increase revenue immediately.
      3. BOTTLENECK: Identify where the pipeline is clogged (e.g., too many 'new' leads not moving, specific employee bottleneck, etc.).
      4. EMPLOYEE PERFORMANCE:
         - Identify the MOST inefficient employee based on conversion rate (paid/total) and revenue per lead.
         - Identify who is "Neglecting Urgent Leads" (highest urgent_missed).
         - Provide one concrete "Improvement Tip" and one "Motivational Message" for the team.

      CONSTRAINTS:
      - Be direct and professional.
      - Return ONLY a JSON object. No markdown, no prose.
      
      JSON STRUCTURE:
      {
        "data_strength": { "percentage": ${dataStrengthPercentage}, "explanation": "Detailed explanation..." },
        "next_actionable_steps": ["Action 1", "Action 2", "Action 3"],
        "bottleneck": "Identification of bottleneck...",
        "employee_insights": {
          "inefficient_employee": "Name + Why",
          "urgent_leads_not_catering": "Name + Why",
          "improvement_advice": "Detailed tip...",
          "motivation": "Motivational quote or message..."
        }
      }
    `;

    // 7. Call Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048,
          response_mime_type: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${errorText}`);
    }

    const result = await response.json();
    let aiContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!aiContent) {
      throw new Error("Gemini returned an empty response.");
    }

    // Clean up potential markdown formatting from Gemini
    if (aiContent.startsWith('```json')) {
      aiContent = aiContent.replace(/```json\n?/, '');
    }
    if (aiContent.startsWith('```')) {
      aiContent = aiContent.replace(/```\n?/, '');
    }
    if (aiContent.endsWith('```')) {
      aiContent = aiContent.replace(/\n?```$/, '');
    }

    let parsedContent;
    try {
        parsedContent = JSON.parse(aiContent.trim());
    } catch (e) {
        console.error("Failed to parse Gemini output as JSON:", aiContent);
        throw new Error("Gemini returned malformed JSON");
    }

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('[AI Insights Function Error]:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
