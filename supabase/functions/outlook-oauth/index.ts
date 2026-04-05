import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID")!;
const MICROSOFT_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/outlook-oauth?action=callback`;

const SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "Mail.Read",
  "Mail.Send",
  "Mail.ReadWrite",
  "User.Read",
  "User.ReadWrite.All",
].join(" ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "authorize") {
      // Validate user auth
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userId = claimsData.claims.sub;

      // Build Microsoft OAuth URL with state = userId
      const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
      authUrl.searchParams.set("client_id", MICROSOFT_CLIENT_ID);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("response_mode", "query");
      authUrl.searchParams.set("state", userId);
      authUrl.searchParams.set("prompt", "consent");

      return new Response(JSON.stringify({ url: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state"); // userId
      const error = url.searchParams.get("error");

      if (error) {
        return new Response(`<html><body><h2>Authorization failed</h2><p>${error}</p><script>window.close();</script></body></html>`, {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (!code || !state) {
        return new Response(`<html><body><h2>Missing parameters</h2><script>window.close();</script></body></html>`, {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Exchange code for tokens
      const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          client_secret: MICROSOFT_CLIENT_SECRET,
          code,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
          scope: SCOPES,
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access_token) {
        console.error("Token exchange failed:", tokenData);
        return new Response(`<html><body><h2>Token exchange failed</h2><p>${tokenData.error_description || "Unknown error"}</p><script>setTimeout(()=>window.close(),3000);</script></body></html>`, {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Get user email from Graph API
      const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const meData = await meRes.json();
      const adminEmail = meData.mail || meData.userPrincipalName || "";

      // Get company_id from profile
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: profile } = await adminClient
        .from("profiles")
        .select("company_id")
        .eq("id", state)
        .single();

      if (!profile?.company_id) {
        return new Response(`<html><body><h2>Company not found</h2><script>setTimeout(()=>window.close(),3000);</script></body></html>`, {
          headers: { "Content-Type": "text/html" },
        });
      }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

      // Upsert email integration
      const { error: upsertError } = await adminClient
        .from("email_integrations")
        .upsert(
          {
            company_id: profile.company_id,
            provider: "outlook",
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: expiresAt,
            admin_email: adminEmail,
            is_active: true,
            email_dashboard_enabled: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" }
        );

      if (upsertError) {
        console.error("Upsert failed:", upsertError);
        return new Response(`<html><body><h2>Failed to save integration</h2><p>${upsertError.message}</p><script>setTimeout(()=>window.close(),3000);</script></body></html>`, {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Success - close popup and notify parent
      return new Response(
        `<html><body><h2>✅ Outlook connected successfully!</h2><p>Connected as ${adminEmail}</p><script>
          if(window.opener){window.opener.postMessage({type:'OUTLOOK_OAUTH_SUCCESS'},'*');}
          setTimeout(()=>window.close(),2000);
        </script></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("outlook-oauth error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
