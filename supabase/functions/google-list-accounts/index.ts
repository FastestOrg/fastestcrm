import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";




serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const googleDevToken = Deno.env.get("GOOGLE_DEV_TOKEN"); // Need Developer Token

    // Note: We need a developer token. If we don't have one, we can't fully list ACCOUNTS but we can list ACCESSIBLE CUSTOMERS.
    // Assuming we might not have a dev token yet, let's try to proceed with minimal requirements or assume one.
    // If no dev token, we can't use the API proper. Let's assume we need one or handle the error gracefully.

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { companyId } = await req.json();

        if (!companyId) {
            return new Response(JSON.stringify({ error: "Missing companyId" }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Get integration
        const { data: integration } = await supabase
            .from("performance_marketing_integrations")
            .select("credentials")
            .eq("company_id", companyId)
            .eq("platform", "google")
            .single();

        if (!integration || !integration.credentials || !integration.credentials.access_token) {
            return new Response(JSON.stringify({ error: "Integration not found or not connected" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const accessToken = integration.credentials.access_token;
        // const refreshToken = integration.credentials.refresh_token; 
        // Ideally we should refresh the token if expired using refresh_token.

        // For MVP, just try to list accessible customers
        // https://developers.google.com/google-ads/api/rest/reference/rest/v17/customers/listAccessibleCustomers

        // NOTE: Without a developer-token, we can only access test accounts or fail. 
        // BUT listAccessibleCustomers DOES NOT require a developer token? No, it DOES.
        // Wait, documentation says: "Common headers... developer-token: The developer token..."
        // So we MUST have a developer token.

        if (!googleDevToken) {
            console.warn("Missing GOOGLE_DEV_TOKEN. Returning mock data or error.");
            // For development/demo without a real dev token, maybe we just return an error explaining it?
            // Or if the user provided one in secrets.
            // Let's assume they might not have one and fail gracefully.
            return new Response(JSON.stringify({ error: "Google Ads Developer Token is missing in secrets." }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const listUrl = "https://googleads.googleapis.com/v17/customers:listAccessibleCustomers";
        const listResponse = await fetch(listUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "developer-token": googleDevToken,
            },
        });

        const listData = await listResponse.json();

        if (listData.error) {
            console.error("Google Ads API Error:", listData.error);
            return new Response(JSON.stringify({ error: listData.error.message }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // listData.resourceNames is array of "customers/{customer_id}"
        const resourceNames = listData.resourceNames || [];
        const accounts = resourceNames.map((r: string) => ({
            id: r.split('/')[1],
            name: `Account ${r.split('/')[1]}` // We can't get the name easily without querying each customer resource, which is expensive/complex here.
        }));

        // To get names, we would need to query each customer. 
        // Client can fetch detailed info later if needed, or we just display ID.
        // Or we can try to fetch the first few? 
        // Let's just return IDs for now to keep it simple and see if it works.

        return new Response(JSON.stringify({ accounts }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: unknown) {
        console.error("google-list-accounts error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
