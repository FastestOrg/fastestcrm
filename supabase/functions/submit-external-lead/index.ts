import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";




// Simple in-memory rate limiting (per IP, resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // Slightly higher for API usage
const RATE_WINDOW_MS = 60000; // 1 minute

interface ExternalSubmission {
    formId: string;
    data: Record<string, any>; // Keyed by attribute name (e.g., "name", "email", "phone")
}

// Allowed lead attributes map for validation
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
        const body: ExternalSubmission = await req.json();
        const { formId, data } = body;

        // Validate required fields
        if (!formId) {
            return new Response(
                JSON.stringify({ error: "formId is required" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!data || typeof data !== 'object') {
            return new Response(
                JSON.stringify({ error: "data object is required" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Validate form ID format (UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(formId)) {
            return new Response(
                JSON.stringify({ error: "Invalid formId format" }),
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

        // Check form is published or active
        if (form.status !== "published" && form.status !== "active") {
            return new Response(
                JSON.stringify({ error: "This form is not accepting submissions" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Validate and sanitize form data
        const formFields = form.fields as any[];
        const leadData: Record<string, any> = {
            form_id: form.id,
            status: "new",
            created_by_id: form.created_by_id,
            sales_owner_id: form.created_by_id, // Set sales_owner so creator can see the lead
            company_id: creatorProfile?.company_id // Ensure company_id is set
        };

        // Iterate through submitted data and map to known attributes
        for (const [key, rawValue] of Object.entries(data)) {
            // Find if this key (attribute) corresponds to a field in the form
            // We only accept data that matches a field in the form definition to prevent junk data
            const matchingField = formFields.find(f => f.attribute === key);

            if (!matchingField) {
                console.log(`Attribute '${key}' not found in form definition. Skipping.`);
                continue;
            }

            if (!ALLOWED_ATTRIBUTES.includes(key)) {
                console.log(`Attribute '${key}' is not in allowed list. Skipping.`);
                continue;
            }

            let value = rawValue;

            // Sanitize and validate based on attribute type
            if (typeof value !== "string" && typeof value !== "number") {
                // Try to stringify
                value = String(value);
            }

            if (typeof value === "string") {
                value = value.trim().substring(0, 500);
            }

            // Specific validations
            if (key === "email") {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(String(value))) {
                    return new Response(
                        JSON.stringify({ error: `Invalid email format for field '${key}'` }),
                        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            }

            if (key === "phone" || key === "whatsapp") {
                // Basic cleanup
                value = String(value).replace(/[^0-9\s+\-()]/g, "");
            }

            leadData[key] = value;
        }

        // Check required fields from the form definition
        for (const field of formFields) {
            if (field.required && field.attribute && !leadData[field.attribute]) {
                return new Response(
                    JSON.stringify({ error: `Missing required field: ${field.attribute}` }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        // Validate minimal requirement: name must be present
        if (!leadData.name || typeof leadData.name !== "string" || leadData.name.length < 1) {
            return new Response(
                JSON.stringify({ error: "Name attribute is required and must be a non-empty string" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
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
                JSON.stringify({ error: "Failed to create lead. Please check your data." }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`External lead created: ${lead.id} from form: ${formId}, IP: ${clientIP}`);

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
