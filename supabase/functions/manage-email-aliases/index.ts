import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function refreshTokenIfNeeded(adminClient: any, integration: any) {
  const expiresAt = new Date(integration.token_expires_at);
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return integration.access_token;
  }

  const CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID")!;
  const CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;

  const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: integration.refresh_token,
      grant_type: "refresh_token",
      scope: "openid profile email offline_access Mail.Read Mail.Send Mail.ReadWrite User.Read User.ReadWrite.All",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`Token refresh failed: ${tokenData.error_description}`);

  const newExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  await adminClient
    .from("email_integrations")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || integration.refresh_token,
      token_expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user's company & verify admin
    const { data: profile } = await adminClient.from("profiles").select("company_id").eq("id", userId).single();
    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: company } = await adminClient.from("companies").select("admin_id").eq("id", profile.company_id).single();
    if (company?.admin_id !== userId) {
      return new Response(JSON.stringify({ error: "Only company admin can manage aliases" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get email integration
    const { data: integration } = await adminClient
      .from("email_integrations")
      .select("*")
      .eq("company_id", profile.company_id)
      .single();

    if (!integration) {
      return new Response(JSON.stringify({ error: "No email integration found. Connect Outlook first." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      // List aliases
      const { data: aliases } = await adminClient
        .from("email_aliases")
        .select("*, profiles:user_id(full_name, email)")
        .eq("company_id", profile.company_id);

      return new Response(JSON.stringify({ aliases: aliases || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { user_id: targetUserId, alias_email, display_name } = body;

      if (!targetUserId || !alias_email) {
        return new Response(JSON.stringify({ error: "user_id and alias_email required" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Refresh token if needed
      const accessToken = await refreshTokenIfNeeded(adminClient, integration);

      // Try to create alias via Microsoft Graph API
      // Note: Creating aliases requires admin consent and User.ReadWrite.All
      // We get the target user's Microsoft UPN first
      try {
        // Get all users from Microsoft to find the target
        const usersRes = await fetch("https://graph.microsoft.com/v1.0/users?$select=id,userPrincipalName,proxyAddresses,mail", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const usersData = await usersRes.json();

        // Find the Microsoft user matching the target's email
        const { data: targetProfile } = await adminClient.from("profiles").select("email").eq("id", targetUserId).single();

        const msUser = usersData.value?.find(
          (u: any) => u.mail?.toLowerCase() === targetProfile?.email?.toLowerCase() || u.userPrincipalName?.toLowerCase() === targetProfile?.email?.toLowerCase()
        );

        if (msUser) {
          // Add the alias as a proxy address
          const currentProxies = msUser.proxyAddresses || [];
          const newProxy = `smtp:${alias_email}`;
          if (!currentProxies.includes(newProxy)) {
            const updateRes = await fetch(`https://graph.microsoft.com/v1.0/users/${msUser.id}`, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                proxyAddresses: [...currentProxies, newProxy],
              }),
            });

            if (!updateRes.ok) {
              const errData = await updateRes.json();
              console.error("Graph API error adding alias:", errData);
              // Still save locally even if Graph fails
            }
          }
        }
      } catch (graphErr) {
        console.error("Graph API alias creation error:", graphErr);
        // Continue - save alias locally regardless
      }

      // Save alias in our DB
      const { data: alias, error: insertErr } = await adminClient
        .from("email_aliases")
        .insert({
          company_id: profile.company_id,
          user_id: targetUserId,
          alias_email,
          display_name: display_name || alias_email.split("@")[0],
        })
        .select()
        .single();

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ alias }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      const body = await req.json();
      const { alias_id } = body;

      if (!alias_id) {
        return new Response(JSON.stringify({ error: "alias_id required" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteErr } = await adminClient
        .from("email_aliases")
        .delete()
        .eq("id", alias_id)
        .eq("company_id", profile.company_id);

      if (deleteErr) {
        return new Response(JSON.stringify({ error: deleteErr.message }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("manage-email-aliases error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
