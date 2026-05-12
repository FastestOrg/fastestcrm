import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const leadId = url.searchParams.get("lid");
    const leadTable = url.searchParams.get("lt") || "leads";
    const companyId = url.searchParams.get("cid");

    if (!leadId || !companyId) {
      return new Response("Missing parameters", { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Update lead status to unsubscribed
    const { error: leadError } = await supabase
      .from(leadTable as any)
      .update({ status: "unsubscribed" })
      .eq("id", leadId)
      .eq("company_id", companyId);

    if (leadError) {
      console.error("Lead update error:", leadError);
      return new Response("Error updating lead status", { status: 500 });
    }

    // Also cancel any pending/in-progress recipients for this lead
    await supabase
      .from("email_campaign_recipients")
      .update({ status: "unsubscribed" })
      .eq("lead_id", leadId)
      .eq("lead_table", leadTable);

    // Redirect to a confirmation page or show a simple message
    // The user mentioned fastestcrm.com/unsubscribe/... but if it doesn't exist, we can show a nice HTML page
    return new Response(
      `<html>
        <head>
          <title>Unsubscribed</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f9fafb; }
            .card { background: white; padding: 2rem; border-radius: 8px; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 400px; }
            h1 { color: #111827; margin-bottom: 0.5rem; }
            p { color: #6b7280; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Success</h1>
            <p>You have been successfully unsubscribed from this mailing list. You will no longer receive emails from us.</p>
          </div>
        </body>
      </html>`,
      {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
