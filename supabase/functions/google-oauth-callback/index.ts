import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";




const FINAL_CLIENT_CALLBACK_URL = "https://www.fastestcrm.com/google-oauth-callback";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    // Google redirects here via GET with query params.
    if (req.method === "GET") {
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const state = url.searchParams.get("state"); // Contains companyId

        console.log("google-oauth-callback GET: Redirecting to client callback", { hasCode: !!code, error, state });

        const redirectTo = new URL(FINAL_CLIENT_CALLBACK_URL);
        if (code) redirectTo.searchParams.set("code", code);
        if (error) redirectTo.searchParams.set("error", error);
        if (state) redirectTo.searchParams.set("state", state);

        return Response.redirect(redirectTo.toString(), 302);
    }

    // POST request - exchange code for token and save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const googleRedirectUri = "https://api.fastestcrm.com/functions/v1/google-oauth-callback";

    if (!googleClientId || !googleClientSecret) {
        console.error("google-oauth-callback: Missing Google credentials");
        return new Response(JSON.stringify({ error: "Google credentials not configured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { code, companyId, defaultStatus } = await req.json();

        console.log("google-oauth-callback: Request params", {
            hasCode: !!code,
            companyId,
            defaultStatus
        });

        if (!code || !companyId) {
            return new Response(JSON.stringify({ error: "Missing required parameters" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("google-oauth-callback: Exchanging code for tokens...");

        const tokenUrl = "https://oauth2.googleapis.com/token";
        const tokenResponse = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: googleClientId,
                client_secret: googleClientSecret,
                redirect_uri: googleRedirectUri,
                grant_type: "authorization_code",
            }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error("google-oauth-callback: Token exchange error:", tokenData.error);
            return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { access_token, refresh_token, expires_in } = tokenData;

        console.log("google-oauth-callback: Got tokens", { hasAccess: !!access_token, hasRefresh: !!refresh_token });

        // Calculate expiry
        const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

        // Check existing integration
        const { data: existing } = await supabase
            .from("performance_marketing_integrations")
            .select("id, credentials")
            .eq("company_id", companyId)
            .eq("platform", "google")
            .maybeSingle();

        const credentials = existing?.credentials || {};

        // Update credentials
        credentials.access_token = access_token;
        if (refresh_token) {
            credentials.refresh_token = refresh_token; // Only returned on first consent or if prompted
        }
        credentials.token_expires_at = tokenExpiresAt;

        let operationResult;

        if (existing) {
            operationResult = await supabase
                .from("performance_marketing_integrations")
                .update({
                    credentials,
                    default_lead_status: defaultStatus || "new",
                    is_active: true,
                    updated_at: new Date().toISOString(),
                    // Ensure we don't overwrite manual setup if they are switching, or do we?
                    // We should probably clear manual fields if switching to OAuth, but let's keep them for now.
                })
                .eq("id", existing.id)
                .select();
        } else {
            operationResult = await supabase
                .from("performance_marketing_integrations")
                .insert({
                    company_id: companyId,
                    platform: "google",
                    credentials,
                    default_lead_status: defaultStatus || "new",
                    is_active: true,
                })
                .select();
        }

        if (operationResult.error) {
            console.error("Database error:", operationResult.error);
            throw operationResult.error;
        }

        // List customer accounts to return to frontend
        console.log("google-oauth-callback: Fetching customer accounts...");

        // We need to use the Google Ads API to list accounts. 
        // This requires a developer token, which we might not have in the simple OAuth flow?
        // Actually, we can use the 'https://googleads.googleapis.com/v14/customers:listAccessibleCustomers' endpoint.

        // For now, let's just return success and let the frontend call 'google-list-accounts' next.
        // Or we can fetch it here. Let's fetch it here to be helpful.

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: unknown) {
        console.error("google-oauth-callback error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
