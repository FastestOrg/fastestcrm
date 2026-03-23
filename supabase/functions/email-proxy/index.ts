import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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

    // Get user's company
    const { data: profile } = await adminClient.from("profiles").select("company_id").eq("id", userId).single();
    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get email integration
    const { data: integration } = await adminClient
      .from("email_integrations")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .single();

    if (!integration) {
      return new Response(JSON.stringify({ error: "No active email integration" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's alias
    const { data: alias } = await adminClient
      .from("email_aliases")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .single();

    const accessToken = await refreshTokenIfNeeded(adminClient, integration);

    if (req.method === "GET") {
      // Fetch inbox emails
      const url = new URL(req.url);
      const page = parseInt(url.searchParams.get("page") || "1");
      const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
      const folder = url.searchParams.get("folder") || "inbox";
      const skip = (page - 1) * pageSize;

      let graphUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=${pageSize}&$skip=${skip}&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,receivedDateTime,isRead,bodyPreview,body,hasAttachments`;

      // If user has an alias, filter to only their alias emails
      if (alias) {
        graphUrl += `&$filter=toRecipients/any(r:r/emailAddress/address eq '${alias.alias_email}')`;
      }

      const messagesRes = await fetch(graphUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!messagesRes.ok) {
        const errBody = await messagesRes.json();
        console.error("Graph messages error:", errBody);

        // Fallback: try without filter if filter fails
        if (alias && errBody?.error?.code === "ErrorInvalidUrlQuery") {
          const fallbackUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=${pageSize}&$skip=${skip}&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,receivedDateTime,isRead,bodyPreview,body,hasAttachments`;
          const fallbackRes = await fetch(fallbackUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const fallbackData = await fallbackRes.json();
          return new Response(JSON.stringify({ messages: fallbackData.value || [], alias: alias?.alias_email }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ error: "Failed to fetch emails", details: errBody }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const messagesData = await messagesRes.json();

      return new Response(
        JSON.stringify({
          messages: messagesData.value || [],
          nextLink: messagesData["@odata.nextLink"] || null,
          alias: alias?.alias_email,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { action: emailAction } = body;

      if (emailAction === "send") {
        const { to, subject, bodyContent, replyToId } = body;

        if (!to || !subject || !bodyContent) {
          return new Response(JSON.stringify({ error: "to, subject, bodyContent required" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const message: any = {
          subject,
          body: { contentType: "HTML", content: bodyContent },
          toRecipients: Array.isArray(to)
            ? to.map((email: string) => ({ emailAddress: { address: email } }))
            : [{ emailAddress: { address: to } }],
        };

        // Set from address to alias if available
        if (alias) {
          message.from = {
            emailAddress: {
              address: alias.alias_email,
              name: alias.display_name || alias.alias_email,
            },
          };
        }

        let graphUrl = "https://graph.microsoft.com/v1.0/me/sendMail";
        const sendBody: any = { message, saveToSentItems: true };

        if (replyToId) {
          // Reply to existing message
          graphUrl = `https://graph.microsoft.com/v1.0/me/messages/${replyToId}/reply`;
          const replyRes = await fetch(graphUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: { body: { contentType: "HTML", content: bodyContent } } }),
          });

          if (!replyRes.ok) {
            const errBody = await replyRes.text();
            return new Response(JSON.stringify({ error: "Reply failed", details: errBody }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          const sendRes = await fetch(graphUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(sendBody),
          });

          if (!sendRes.ok) {
            const errBody = await sendRes.text();
            return new Response(JSON.stringify({ error: "Send failed", details: errBody }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (emailAction === "markRead") {
        const { messageId } = body;
        await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isRead: true }),
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("email-proxy error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
