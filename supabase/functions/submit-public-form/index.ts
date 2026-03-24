import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";




// Simple in-memory rate limiting (per IP, resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW_MS = 60000; // 1 minute

interface FormSubmission {
  formId: string;
  formData: Record<string, string>;
  linkId?: string;
  utmSource?: string;
}

// Allowed lead attributes that can be mapped from form fields
const ALLOWED_ATTRIBUTES = [
  // Common / Education
  "name", "email", "phone", "whatsapp", "college", "graduating_year",
  "branch", "domain", "cgpa", "state", "preferred_language", "company",
  "batch_month", "utm_source", "utm_medium", "utm_campaign", "notes", "status",
  "lead_source", "sales_owner_id",

  // Real Estate
  "property_type", "budget_min", "budget_max", "preferred_location",
  "property_size", "purpose", "possession_timeline", "site_visit_date",
  "broker_name", "property_name", "unit_number", "deal_value",
  "commission_percentage", "commission_amount"
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    // Check rate limit
    const now = Date.now();
    const rateData = rateLimitMap.get(clientIP);

    if (rateData) {
      if (now < rateData.resetTime) {
        if (rateData.count >= RATE_LIMIT) {
          console.log(`Rate limit exceeded for IP: ${clientIP}`);
          return new Response(
            JSON.stringify({ error: "Too many requests. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        rateData.count++;
      } else {
        // Reset the window
        rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_WINDOW_MS });
      }
    } else {
      rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_WINDOW_MS });
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body
    const body: FormSubmission = await req.json();
    const { formId, formData, linkId, utmSource } = body;

    // Validate required fields
    if (!formId) {
      return new Response(
        JSON.stringify({ error: "Form ID is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate form ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(formId)) {
      return new Response(
        JSON.stringify({ error: "Invalid form ID format" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the form to get creator and validate it exists
    const { data: form, error: formError } = await supabaseAdmin
      .from("forms")
      .select("id, created_by_id, fields, status")
      .eq("id", formId)
      .single();

    if (formError || !form) {
      console.error("Form fetch error:", formError);
      return new Response(
        JSON.stringify({ error: "Form not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine target table based on creator's company settings
    let targetTable = 'leads';
    const { data: creatorProfile } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('id', form.created_by_id)
      .single();

    if (creatorProfile?.company_id) {
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('custom_leads_table, industry')
        .eq('id', creatorProfile.company_id)
        .single();

      if (company?.custom_leads_table) {
        targetTable = company.custom_leads_table;
        console.log(`Using custom table ${targetTable} for form submission`);
      } else if (company?.industry === 'real_estate') {
        targetTable = 'leads_real_estate';
        console.log(`Using industry table ${targetTable} for form submission`);
      }
    }

    // Check form is published
    if (form.status !== "published" && form.status !== "active") {
      return new Response(
        JSON.stringify({ error: "This form is not accepting submissions" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and sanitize form data
    const fields = form.fields as any[];
    const leadData: Record<string, any> = {
      form_id: form.id,
      status: "new",
      created_by_id: form.created_by_id,
      sales_owner_id: form.created_by_id, // Set sales_owner so creator can see the lead
      company_id: creatorProfile?.company_id // Ensure company_id is set
    };

    // Process each form field
    for (const field of fields) {
      if (!field.attribute || !formData[field.id]) continue;

      // Only allow known attributes
      if (!ALLOWED_ATTRIBUTES.includes(field.attribute)) {
        console.log(`Skipping unknown attribute: ${field.attribute}`);
        continue;
      }

      let value = formData[field.id];

      // Sanitize and validate based on attribute type
      if (typeof value !== "string") {
        value = String(value);
      }

      // Trim and limit length
      value = value.trim().substring(0, 500);

      // Specific validations
      if (field.attribute === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return new Response(
            JSON.stringify({ error: "Invalid email format" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (field.attribute === "phone" || field.attribute === "whatsapp") {
        // Allow only digits, spaces, +, -, ()
        value = value.replace(/[^0-9\s+\-()]/g, "");
      }

      if (field.attribute === "graduating_year" || field.attribute === "cgpa") {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) continue;
        leadData[field.attribute] = numValue;
        continue;
      }

      leadData[field.attribute] = value;
    }

    // Validate required field: name must be present
    if (!leadData.name || typeof leadData.name !== "string" || leadData.name.length < 1) {
      return new Response(
        JSON.stringify({ error: "Name is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add link ID if present
    if (linkId && uuidRegex.test(linkId)) {
      leadData.lg_link_id = linkId;
    }

    // Add UTM source if present
    if (utmSource && typeof utmSource === "string") {
      if (targetTable === 'leads') {
        leadData.ca_name = utmSource.trim().substring(0, 100);
      } else {
        // For real estate or custom tables, map to utm_source if not already set
        if (!leadData.utm_source) {
          leadData.utm_source = utmSource.trim().substring(0, 100);
        }
      }
    }

    // Insert the lead
    const { data: lead, error: insertError } = await supabaseAdmin
      .from(targetTable)
      .insert(leadData)
      .select("id")
      .single();

    if (insertError) {
      console.error("Lead insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to submit form. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Lead created: ${lead.id} from form: ${formId}, IP: ${clientIP}`);

    // Notify the form creator about the new submission (fire-and-forget)
    try {
      const submitterName = leadData.name || 'Someone';
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: form.created_by_id,
          title: 'New Form Submission 📋',
          message: `${submitterName} just submitted your form`,
          type: 'form_submission',
          lead_id: lead.id,
          read: false,
        });
      // Send Web Push notification
      const _supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const _serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      fetch(`${_supabaseUrl}/functions/v1/send-web-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_serviceRoleKey}` },
        body: JSON.stringify({ user_id: form.created_by_id, title: 'New Form Submission \u{1F4CB}', body: `${submitterName} just submitted your form` }),
      }).catch(e => console.error('[Push] submit-public-form:', e));
    } catch (notifyErr) {
      // Non-critical — do not fail the response
      console.error('Failed to create form submission notification:', notifyErr);
    }

    return new Response(
      JSON.stringify({ success: true, leadId: lead.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
