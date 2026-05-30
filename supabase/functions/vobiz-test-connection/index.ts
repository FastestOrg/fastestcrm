import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        // Auth check — require a valid Supabase session
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return new Response(JSON.stringify({ success: false, error: "Unauthorized — please refresh and try again" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Parse request body
        const body = await req.json().catch(() => ({}));
        const { auth_id, auth_token } = body;
        if (!auth_id || !auth_token) {
            return new Response(JSON.stringify({ success: false, error: "auth_id and auth_token are required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Proxy the credential test to Vobiz with a hard 10-second timeout.
        // Running server-side avoids browser CORS restrictions entirely.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);

        let vobizRes: Response;
        try {
            vobizRes = await fetch(`https://api.vobiz.ai/api/v1/Account/${auth_id}/`, {
                method: "GET",
                headers: {
                    "X-Auth-ID": auth_id,
                    "X-Auth-Token": auth_token,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                signal: controller.signal,
            });
        } catch (fetchErr: any) {
            clearTimeout(timeoutId);
            const isTimeout = fetchErr.name === "AbortError";
            console.error("Vobiz fetch error:", fetchErr.message);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: isTimeout
                        ? "Vobiz API timed out after 10 seconds. The API may be unreachable — your credentials were saved but could not be verified online."
                        : `Could not reach Vobiz API: ${fetchErr.message}`,
                    // Allow the dialog to treat a timeout as a soft-pass so the user can still proceed
                    timeout: isTimeout,
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }
        clearTimeout(timeoutId);

        const rawText = await vobizRes.text();
        console.log(`Vobiz response status=${vobizRes.status}, body=${rawText.slice(0, 300)}`);

        let vobizBody: any = {};
        try {
            vobizBody = JSON.parse(rawText);
        } catch {
            // Non-JSON response — treat any 2xx as success
        }

        if (vobizRes.ok) {
            return new Response(JSON.stringify({ success: true, account: vobizBody }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(
            JSON.stringify({
                success: false,
                error: vobizBody?.error || vobizBody?.message || vobizBody?.api_error ||
                    `Vobiz returned HTTP ${vobizRes.status}. Check your Auth ID and Token.`,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (err: any) {
        console.error("vobiz-test-connection unhandled error:", err);
        return new Response(JSON.stringify({ success: false, error: err.message || "Internal error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
