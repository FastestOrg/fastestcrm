import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client to auth user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get requester
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get requester company_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.company_id) {
      throw new Error("User has no company context");
    }
    const companyId = profile.company_id;

    // Parse request body
    const { countryCode, phoneDigits } = await req.json();
    if (!countryCode || !phoneDigits) {
      throw new Error("Missing countryCode or phoneDigits");
    }

    const targetDigits = parseInt(phoneDigits);
    const expectedFullLength = countryCode.length + targetDigits;

    // Determine correct leads table for the company
    const { data: companyData } = await supabaseAdmin
      .from("companies")
      .select("industry, custom_leads_table")
      .eq("id", companyId)
      .maybeSingle();

    let tableName = companyData?.custom_leads_table || 'leads';

    if (!companyData?.custom_leads_table) {
      switch (companyData?.industry) {
        case 'real_estate': tableName = 'leads_real_estate'; break;
        case 'saas': tableName = 'leads_saas'; break;
        case 'healthcare': tableName = 'leads_healthcare'; break;
        case 'insurance': tableName = 'leads_insurance'; break;
        case 'travel': tableName = 'leads_travel'; break;
      }
    }

    // Fetch all leads for this company
    // For large databases, consider batching, but we'll try fetching up to 50k
    let allLeads: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: leads, error: leadsError } = await supabaseAdmin
        .from(tableName)
        .select("id, phone")
        .eq("company_id", companyId)
        .not("phone", "is", null)
        .range(from, from + limit - 1);
        
      if (leadsError) throw leadsError;

      if (leads && leads.length > 0) {
        allLeads = allLeads.concat(leads);
        from += limit;
      } else {
        hasMore = false;
      }
    }

    let updatedCount = 0;
    let wrongNumberCount = 0;
    let skippedCount = 0;

    // Prepare batches for updates
    // Supabase JS doesn't have a reliable bulk update except via RPC.
    // We can do individual updates or use Promise.all in small chunks.
    const updatesToPerform = [];

    for (const lead of allLeads) {
      if (!lead.phone) continue;
      
      const phoneStr = lead.phone.replace(/[^0-9]/g, ''); // strip non-numeric
      const length = phoneStr.length;

      if (length === targetDigits) {
        // missing country code -> add it
        updatesToPerform.push({ id: lead.id, action: 'update_phone', newPhone: countryCode + phoneStr });
      } else if (length === expectedFullLength && phoneStr.startsWith(countryCode)) {
        // already correct -> do nothing
        skippedCount++;
      } else if (length < targetDigits || length > expectedFullLength || (length === expectedFullLength && !phoneStr.startsWith(countryCode))) {
        // wrong number -> mark status
        // Any incorrect length or non-matching startsWith is a Wrong Number.
        updatesToPerform.push({ id: lead.id, action: 'wrong_number' });
      } else {
        // Just in case there are missing conditions
        skippedCount++;
      }
    }

    // Execute updates in chunks of 50 to avoid hammering the DB
    const executeChunk = async (chunk: any[]) => {
      await Promise.all(chunk.map(async (u) => {
        try {
          if (u.action === 'update_phone') {
            await supabaseAdmin.from(tableName).update({ phone: u.newPhone }).eq("id", u.id);
            updatedCount++;
          } else if (u.action === 'wrong_number') {
            await supabaseAdmin.from(tableName).update({ status: 'Wrong Number' }).eq("id", u.id);
            wrongNumberCount++;
          }
        } catch (e) {
          console.error(`Error updating lead ${u.id}:`, e);
        }
      }));
    };

    const chunkSize = 50;
    for (let i = 0; i < updatesToPerform.length; i += chunkSize) {
      await executeChunk(updatesToPerform.slice(i, i + chunkSize));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${allLeads.length} leads. Updated: ${updatedCount}, Marked as Wrong Number: ${wrongNumberCount}, Skipped: ${skippedCount}`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Sync leads Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } } 
      // 200 OK so frontend can parse error JSON as user asked in previous conversation 18d65c58
    );
  }
});
