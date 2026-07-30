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

        let { data: form, error } = await supabaseAdmin
            .from("forms")
            .select("*")
            .eq("id", formId)
            .single();

        if (error || !form) {
            // Check active BYOS connections if not found on platform DB
            const { data: activeConnections } = await supabaseAdmin
                .from("byos_connections")
                .select("company_id, supabase_url, supabase_anon_key")
                .eq("status", "active");

            if (activeConnections && activeConnections.length > 0) {
                for (const conn of activeConnections) {
                    try {
                        const byosRes = await fetch(`${conn.supabase_url}/rest/v1/forms?id=eq.${formId}&select=*`, {
                            headers: {
                                apikey: conn.supabase_anon_key,
                                Authorization: `Bearer ${conn.supabase_anon_key}`,
                            },
                        });
                        if (byosRes.ok) {
                            const byosForms = await byosRes.json();
                            if (byosForms && byosForms.length > 0) {
                                form = byosForms[0];
                                error = null;
                                break;
                            }
                        }
                    } catch (err) {
                        console.warn(`BYOS form check failed for company ${conn.company_id}:`, err);
                    }
                }
            }
        }

        if (error || !form) {
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
