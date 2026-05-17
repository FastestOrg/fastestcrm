import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSystemEmail, getEmailTemplate } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  user_id: string;
  title: string;
  message: string;
  type?: string;
  lead_id?: string;
  send_email?: boolean;
  email_subject?: string;
  email_html?: string;
  email_type?: 'info' | 'warning' | 'success' | 'danger';
  cta_text?: string;
  cta_url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body: NotificationPayload = await req.json();
    const { 
      user_id, title, message, type = 'system', lead_id, 
      send_email = false, email_subject, email_html, email_type = 'info',
      cta_text, cta_url
    } = body;

    if (!user_id || !title || !message) {
      throw new Error("Missing required notification fields (user_id, title, message)");
    }

    // 1. Insert In-App Notification
    const { data: notification, error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id,
        title,
        message,
        type,
        lead_id: lead_id || null,
        read: false
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert in-app notification:", insertError);
    }

    // 2. Send Email Notification if requested
    if (send_email) {
      // Fetch user's email if not provided in payload (though usually we have it)
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", user_id)
        .single();

      if (profile?.email) {
        const finalHtml = email_html || getEmailTemplate(title, `<p>${message}</p>`, cta_text, cta_url, email_type);
        
        const emailResult = await sendSystemEmail({
          to: profile.email,
          subject: email_subject || title,
          html: finalHtml
        });

        if (!emailResult.success) {
          console.error("Failed to send notification email:", emailResult.error);
        }
      } else {
        console.warn(`Could not send email to user ${user_id}: No email address found in profile.`);
      }
    }

    // 3. (Optional) Trigger Web Push
    try {
      const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-web-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          user_id,
          title,
          body: message,
          data: { lead_id, notification_id: notification?.id }
        }),
      });
      if (!pushResponse.ok) {
          const errText = await pushResponse.text();
          console.warn(`Web push failed for ${user_id}: ${pushResponse.status} ${errText}`);
      }
    } catch (pushErr) {
      console.error("Error triggering web push:", pushErr);
    }

    return new Response(JSON.stringify({ success: true, notification_id: notification?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Notification Service Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
