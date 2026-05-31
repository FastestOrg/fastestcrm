import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") || "1033874890501-p253hb5at1qb077rcoitv6pjc9elf75n.apps.googleusercontent.com";
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!googleClientId || !googleClientSecret) {
    return new Response(JSON.stringify({ error: "Google credentials not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { action, code, userId, companyId, redirectUri } = await req.json();

    // Action: get_auth_url — returns OAuth URL
    if (action === "get_auth_url") {
      const scope = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events";
      const state = JSON.stringify({ userId, companyId });
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: exchange_code — exchange code for tokens and save
    if (action === "exchange_code") {
      if (!code || !userId || !companyId) {
        return new Response(JSON.stringify({ error: "Missing required parameters" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json();
      if (tokenData.error) {
        console.error("Token exchange error:", tokenData);
        return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { access_token, refresh_token, expires_in } = tokenData;
      const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

      // Upsert calendar connection
      const { error: upsertError } = await supabase
        .from("calendar_connections")
        .upsert({
          user_id: userId,
          company_id: companyId,
          provider: "google",
          access_token,
          refresh_token: refresh_token || undefined,
          token_expires_at: tokenExpiresAt,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,provider" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        throw upsertError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: refresh_token — refresh an expired token
    if (action === "refresh_token") {
      const { data: conn } = await supabase
        .from("calendar_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", "google")
        .single();

      if (!conn?.refresh_token) {
        return new Response(JSON.stringify({ error: "No refresh token found" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          refresh_token: conn.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const tokenData = await tokenResponse.json();
      if (tokenData.error) {
        return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      await supabase.from("calendar_connections").update({
        access_token: tokenData.access_token,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId).eq("provider", "google");

      return new Response(JSON.stringify({ access_token: tokenData.access_token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("calendar-oauth error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
