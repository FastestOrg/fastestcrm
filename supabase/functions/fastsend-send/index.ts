/**
 * fastsend-send — Edge function for sending emails via SMTP
 * 
 * Handles individual email delivery with tracking pixel injection.
 * Uses raw SMTP commands via Deno.connect for maximum compatibility.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── SMTP Helper ──────────────────────────────────────────────────────────────

async function readResponse(conn: Deno.Conn): Promise<string> {
  const buf = new Uint8Array(4096);
  const n = await conn.read(buf);
  if (n === null) return "";
  return new TextDecoder().decode(buf.subarray(0, n));
}

async function sendCommand(conn: Deno.Conn, command: string): Promise<string> {
  await conn.write(new TextEncoder().encode(command + "\r\n"));
  return await readResponse(conn);
}

async function sendEmailViaSMTP(account: any, to: string, subject: string, htmlBody: string, trackingPixelId: string): Promise<{ success: boolean; error?: string }> {
  let conn: Deno.Conn | null = null;
  
  try {
    // Connect to SMTP server
    if (account.smtp_secure && account.smtp_port === 465) {
      conn = await Deno.connectTls({
        hostname: account.smtp_host,
        port: account.smtp_port,
      });
    } else {
      conn = await Deno.connect({
        hostname: account.smtp_host,
        port: account.smtp_port || 587,
      });
    }

    // Read greeting
    let response = await readResponse(conn);
    if (!response.startsWith("220")) throw new Error("SMTP greeting failed: " + response);

    // EHLO
    response = await sendCommand(conn, `EHLO fastestcrm.com`);

    // STARTTLS if port 587
    if (account.smtp_port === 587 || (!account.smtp_secure && account.smtp_port !== 465)) {
      response = await sendCommand(conn, "STARTTLS");
      if (response.startsWith("220")) {
        conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: account.smtp_host });
        response = await sendCommand(conn, `EHLO fastestcrm.com`);
      }
    }

    // Authenticate
    if (account.access_token) {
      // XOAUTH2
      const xoauth2Str = `user=${account.email_address}\x01auth=Bearer ${account.access_token}\x01\x01`;
      const base64Str = base64Encode(new TextEncoder().encode(xoauth2Str));
      response = await sendCommand(conn, `AUTH XOAUTH2 ${base64Str}`);
      if (!response.startsWith("235")) throw new Error("OAuth authentication failed: " + response);
    } else {
      // AUTH LOGIN
      response = await sendCommand(conn, "AUTH LOGIN");
      if (!response.startsWith("334")) throw new Error("AUTH LOGIN not supported: " + response);

      response = await sendCommand(conn, base64Encode(new TextEncoder().encode(account.smtp_user || account.email_address)));
      if (!response.startsWith("334")) throw new Error("Username rejected: " + response);

      response = await sendCommand(conn, base64Encode(new TextEncoder().encode(account.smtp_password)));
      if (!response.startsWith("235")) throw new Error("Authentication failed: " + response);
    }

    // MAIL FROM
    response = await sendCommand(conn, `MAIL FROM:<${account.email_address}>`);
    if (!response.startsWith("250")) throw new Error("MAIL FROM rejected: " + response);

    // RCPT TO
    response = await sendCommand(conn, `RCPT TO:<${to}>`);
    if (!response.startsWith("250")) throw new Error("RCPT TO rejected: " + response);

    // DATA
    response = await sendCommand(conn, "DATA");
    if (!response.startsWith("354")) throw new Error("DATA not accepted: " + response);

    // Build tracking pixel URL
    const projectId = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");
    const trackingUrl = `https://${projectId}.supabase.co/functions/v1/fastsend-track?pid=${trackingPixelId}`;
    const trackingPixelHtml = `<img src="${trackingUrl}" width="1" height="1" style="display:none" alt="" />`;

    // Inject tracking pixel into HTML body
    const bodyWithTracking = htmlBody.includes("</body>")
      ? htmlBody.replace("</body>", trackingPixelHtml + "</body>")
      : htmlBody + trackingPixelHtml;

    // Compose message
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const fromName = account.display_name || account.email_address;
    
    const message = [
      `From: "${fromName}" <${account.email_address}>`,
      `To: <${to}>`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      `X-Mailer: FastSend/1.0`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      subject, // fallback plain text
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      bodyWithTracking,
      ``,
      `--${boundary}--`,
      `.`,
    ].join("\r\n");

    response = await sendCommand(conn, message);
    if (!response.startsWith("250")) throw new Error("Message not accepted: " + response);

    // QUIT
    await sendCommand(conn, "QUIT");
    conn.close();

    return { success: true };
  } catch (err: any) {
    try { conn?.close(); } catch {}
    return { success: false, error: err.message };
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

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
    const { accountId, to, subject, bodyHtml, campaignId, recipientId, sequenceStepId, companyId } = body;

    // Load account
    const { data: account } = await adminClient
      .from("email_accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (!account) {
      return new Response(JSON.stringify({ error: "Email account not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check daily limit
    const effectiveLimit = account.warmup_enabled
      ? Math.min(account.daily_limit, account.warmup_daily_target + (account.warmup_current_day * account.warmup_ramp_per_day))
      : account.daily_limit;

    if (account.emails_sent_today >= effectiveLimit) {
      return new Response(JSON.stringify({ error: "Daily send limit reached", limitReached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate tracking pixel ID
    const trackingPixelId = crypto.randomUUID();

    // Send email
    const result = await sendEmailViaSMTP(account, to, subject, bodyHtml, trackingPixelId);

    const now = new Date().toISOString();

    if (result.success) {
      // Increment daily counter
      await adminClient.rpc("increment_email_sent", { account_uuid: accountId });

      // Log the send
      await adminClient.from("email_campaign_logs").insert({
        company_id: companyId || account.company_id,
        campaign_id: campaignId || null,
        recipient_id: recipientId || null,
        sequence_step_id: sequenceStepId || null,
        sent_by_account_id: accountId,
        recipient_email: to,
        subject,
        status: "sent",
        tracking_pixel_id: trackingPixelId,
        sent_at: now,
      });
    }

    return new Response(
      JSON.stringify({
        success: result.success,
        error: result.error,
        trackingPixelId: result.success ? trackingPixelId : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
