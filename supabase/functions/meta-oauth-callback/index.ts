import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";




// Where the popup should end up (a real page that can run JS and postMessage back to opener).
const FINAL_CLIENT_CALLBACK_URL = "https://www.fastestcrm.com/meta-oauth-callback";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Meta redirects here via GET with query params.
  // We immediately forward the user (302) to our real client callback page.
  if (req.method === "GET") {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    console.log("meta-oauth-callback GET: Redirecting to client callback", { hasCode: !!code, error });

    const redirectTo = new URL(FINAL_CLIENT_CALLBACK_URL);
    if (code) redirectTo.searchParams.set("code", code);
    if (error) redirectTo.searchParams.set("error", error);
    if (errorDescription) redirectTo.searchParams.set("error_description", errorDescription);

    return Response.redirect(redirectTo.toString(), 302);
  }

  // POST request - exchange code for token and save to database
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const metaAppId = Deno.env.get("META_APP_ID");
  const metaAppSecret = Deno.env.get("META_APP_SECRET");

  console.log("meta-oauth-callback POST: Starting token exchange");
  console.log("meta-oauth-callback: Environment check", { 
    hasAppId: !!metaAppId, 
    hasAppSecret: !!metaAppSecret,
    supabaseUrl 
  });

  if (!metaAppId || !metaAppSecret) {
    console.error("meta-oauth-callback: Missing Meta App credentials");
    return new Response(JSON.stringify({ error: "Meta App credentials not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { code, redirectUri, companyId, defaultStatus } = await req.json();

    console.log("meta-oauth-callback: Request params", { 
      hasCode: !!code, 
      codeLength: code?.length,
      redirectUri, 
      companyId, 
      defaultStatus 
    });

    if (!code || !redirectUri || !companyId) {
      console.error("meta-oauth-callback: Missing required parameters");
      return new Response(JSON.stringify({ error: "Missing required parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("meta-oauth-callback: Exchanging code for access token...");

    // Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${metaAppSecret}&code=${code}`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    console.log("meta-oauth-callback: Token exchange response status", tokenResponse.status);

    if (tokenData.error) {
      console.error("meta-oauth-callback: Token exchange error:", tokenData.error);
      return new Response(JSON.stringify({ error: tokenData.error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shortLivedToken = tokenData.access_token;
    console.log("meta-oauth-callback: Got short-lived token, length:", shortLivedToken?.length);

    // Exchange for long-lived token
    console.log("meta-oauth-callback: Exchanging for long-lived token...");
    const longLivedUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${metaAppId}&client_secret=${metaAppSecret}&fb_exchange_token=${shortLivedToken}`;

    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json();

    console.log("meta-oauth-callback: Long-lived token response status", longLivedResponse.status);

    const accessToken = longLivedData.access_token || shortLivedToken;
    const expiresIn = longLivedData.expires_in || 3600;

    console.log("meta-oauth-callback: Got access token, length:", accessToken?.length, "expires_in:", expiresIn);

    // Get user's pages with required permissions
    console.log("meta-oauth-callback: Fetching user pages...");
    const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    console.log("meta-oauth-callback: Pages response status", pagesResponse.status);

    if (pagesData.error) {
      console.error("meta-oauth-callback: Pages fetch error:", pagesData.error);
      return new Response(JSON.stringify({ error: pagesData.error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pages = pagesData.data || [];
    console.log("meta-oauth-callback: Found", pages.length, "pages");

    // Store the user token - we'll update with page token when user selects a page
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Check if integration already exists
    console.log("meta-oauth-callback: Checking for existing integration for company", companyId);
    const { data: existing, error: fetchError } = await supabase
      .from("performance_marketing_integrations")
      .select("id")
      .eq("company_id", companyId)
      .eq("platform", "meta")
      .maybeSingle();

    console.log("meta-oauth-callback: Existing integration check", { 
      found: !!existing, 
      existingId: existing?.id,
      fetchError 
    });

    if (fetchError) {
      console.error("meta-oauth-callback: Error checking existing integration:", fetchError);
    }

    let operationResult;
    
    if (existing) {
      // Update existing
      console.log("meta-oauth-callback: Updating existing integration", existing.id);
      operationResult = await supabase
        .from("performance_marketing_integrations")
        .update({
          access_token: accessToken,
          token_expires_at: tokenExpiresAt,
          default_lead_status: defaultStatus || "new",
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select();
      
      console.log("meta-oauth-callback: Update result", { 
        data: operationResult.data, 
        error: operationResult.error 
      });
    } else {
      // Create new integration
      console.log("meta-oauth-callback: Creating new integration for company", companyId);
      operationResult = await supabase
        .from("performance_marketing_integrations")
        .insert({
          company_id: companyId,
          platform: "meta",
          access_token: accessToken,
          token_expires_at: tokenExpiresAt,
          default_lead_status: defaultStatus || "new",
          is_active: true,
        })
        .select();
      
      console.log("meta-oauth-callback: Insert result", { 
        data: operationResult.data, 
        error: operationResult.error 
      });
    }

    if (operationResult.error) {
      console.error("meta-oauth-callback: Database operation failed:", operationResult.error);
      return new Response(JSON.stringify({ error: "Failed to save integration: " + operationResult.error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CRITICAL: Verify the record was actually saved
    console.log("meta-oauth-callback: Verifying database record...");
    const { data: verifyData, error: verifyError } = await supabase
      .from("performance_marketing_integrations")
      .select("id, access_token, company_id, platform")
      .eq("company_id", companyId)
      .eq("platform", "meta")
      .single();

    console.log("meta-oauth-callback: Verification result", {
      found: !!verifyData,
      hasAccessToken: !!verifyData?.access_token,
      tokenLength: verifyData?.access_token?.length,
      verifyError
    });

    if (!verifyData || !verifyData.access_token) {
      console.error("meta-oauth-callback: CRITICAL - Record not saved correctly!");
      return new Response(JSON.stringify({ error: "Failed to verify integration was saved" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("meta-oauth-callback: SUCCESS - Integration saved, returning pages list");

    return new Response(
      JSON.stringify({
        success: true,
        pages: pages.map((p: any) => ({ id: p.id, name: p.name })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("meta-oauth-callback: Caught error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
