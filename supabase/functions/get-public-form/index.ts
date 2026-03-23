import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";




serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Initialize Supabase admin client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        let formId: string | null = null;

        // Try to get formId from JSON body (POST) or URL params (GET)
        if (req.method === "POST") {
            try {
                const body = await req.json();
                formId = body.formId;
            } catch (e) {
                // ignore JSON parse error
            }
        } else {
            const url = new URL(req.url);
            formId = url.searchParams.get("formId");
        }

        if (!formId) {
            return new Response(
                JSON.stringify({ error: "Form ID is required" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { data: form, error } = await supabaseAdmin
            .from("forms")
            .select("*")
            .eq("id", formId)
            .single();

        if (error) {
            console.error("Form fetch error:", error);
            return new Response(
                JSON.stringify({ error: "Form not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify(form),
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
