/**
 * fastsend-oauth — Edge function for Google OAuth integration
 * 
 * Handles generating Google Auth URLs and exchanging authorization codes for tokens.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
// Redirect URI for the Supabase Edge Function or frontend
const REDIRECT_URI = "postmessage"; 

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action, code, companyId, redirectUri } = body;

    const usedRedirectUri = redirectUri || REDIRECT_URI; // Accept explicit redirect URI from client (needed for standard web OAuth flow)

    if (action === "exchange") {
      if (!CLIENT_ID || !CLIENT_SECRET) {
        return new Response(JSON.stringify({ error: "Google OAuth is not configured on the server." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: usedRedirectUri,
          grant_type: "authorization_code"
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to exchange code", details: tokenData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Get user profile from Google using the access token
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const profileData = await profileRes.json();

      if (!profileRes.ok || !profileData.email) {
        return new Response(JSON.stringify({ error: "Failed to fetch Google profile data" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const emailAddress = profileData.email;
      const displayName = profileData.name || emailAddress;
      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3599) * 1000).toISOString();

      // Upsert into email_accounts
      const { data: updatedAccount, error: upsertError } = await adminClient
        .from("email_accounts")
        .upsert({
          company_id: companyId,
          user_id: userData.user.id,
          provider: "gmail",
          email_address: emailAddress,
          display_name: displayName,
          protocol: "imap_smtp",
          smtp_host: "smtp.gmail.com",
          smtp_port: 587,
          smtp_user: emailAddress,
          imap_host: "imap.gmail.com",
          imap_port: 993,
          imap_user: emailAddress,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token, // Might be undefined if not requested offline access, but we should always get one on first consent
          token_expires_at: expiresAt,
          status: "connected",
        }, { onConflict: "email_address, company_id" })
        .select()
        .single();
        
      if (upsertError) {
         return new Response(JSON.stringify({ error: "Failed to save account", details: upsertError }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(
        JSON.stringify({ success: true, account: updatedAccount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
