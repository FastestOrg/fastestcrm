import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Token Refresh ────────────────────────────────────────────────────────────

async function refreshGoogleAccessToken(account: any, adminClient: any): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !account.refresh_token) {
    throw new Error("Cannot refresh: missing credentials or refresh_token");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error("Token refresh failed: " + (data.error_description || data.error));

  const expiresAt = new Date(Date.now() + (data.expires_in || 3599) * 1000).toISOString();

  await adminClient
    .from("email_accounts")
    .update({ access_token: data.access_token, token_expires_at: expiresAt, status: "connected" })
    .eq("id", account.id);

  return data.access_token;
}

async function getValidAccessToken(account: any, adminClient: any): Promise<string> {
  if (account.token_expires_at) {
    const expiresAt = new Date(account.token_expires_at).getTime();
    if (Date.now() > expiresAt - 5 * 60 * 1000) {
      return await refreshGoogleAccessToken(account, adminClient);
    }
  }
  return account.access_token;
}

// ─── SMTP Helpers ─────────────────────────────────────────────────────────────

/**
 * Reads a complete SMTP response, which may span multiple lines.
 * Multi-line responses use "XYZ-text" (dash) for continuation lines
 * and "XYZ text" (space) for the final line.
 */
async function readSmtpResponse(conn: Deno.Conn): Promise<string> {
  const decoder = new TextDecoder();
  let fullResponse = "";
  const buf = new Uint8Array(4096);

  while (true) {
    try {
      const n = await conn.read(buf);
      if (n === null) break;
      fullResponse += decoder.decode(buf.subarray(0, n));
      // Check if the last complete line is a terminal response (code + space, not dash)
      const lines = fullResponse.split("\r\n").filter(l => l.length > 0);
      const lastLine = lines[lines.length - 1];
      // Terminal SMTP line: 3 digits followed by a space (not a dash)
      if (lastLine && /^\d{3} /.test(lastLine)) {
        break;
      }
      // Also break if we get a simple single-line response that ends with \r\n
      if (fullResponse.endsWith("\r\n") && /^\d{3} /.test(fullResponse)) {
        break;
      }
    } catch (_e) {
      break;
    }
  }
  return fullResponse;
}

async function sendSmtpCommand(conn: Deno.Conn, command: string): Promise<string> {
  await conn.write(new TextEncoder().encode(command + "\r\n"));
  return await readSmtpResponse(conn);
}

async function testSMTPLive(account: any): Promise<{ success: boolean; error?: string }> {
  let conn: Deno.Conn | null = null;
  try {
    if (account.smtp_secure && (account.smtp_port === 465)) {
      conn = await Deno.connectTls({ hostname: account.smtp_host, port: account.smtp_port });
    } else {
      conn = await Deno.connect({ hostname: account.smtp_host, port: account.smtp_port || 587 });
    }

    // Read greeting
    let response = await readSmtpResponse(conn);
    if (!response.includes("220")) throw new Error("SMTP greeting failed: " + response.substring(0, 200));

    // Send EHLO and read full multi-line response
    response = await sendSmtpCommand(conn, `EHLO fastestcrm.com`);
    if (!response.includes("250")) throw new Error("EHLO failed: " + response.substring(0, 200));

    // STARTTLS upgrade for port 587
    if (account.smtp_port === 587 || (!account.smtp_secure && account.smtp_port !== 465)) {
      if (response.includes("STARTTLS")) {
        response = await sendSmtpCommand(conn, "STARTTLS");
        if (response.includes("220")) {
          conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: account.smtp_host });
          response = await sendSmtpCommand(conn, `EHLO fastestcrm.com`);
          if (!response.includes("250")) throw new Error("EHLO after STARTTLS failed: " + response.substring(0, 200));
        }
      }
    }

    // Choose auth method based on whether we have an access token (OAuth) or password
    if (account.access_token) {
      // XOAUTH2 for Gmail/OAuth
      const xoauth2Str = `user=${account.smtp_user || account.email_address}\x01auth=Bearer ${account.access_token}\x01\x01`;
      const base64Str = base64Encode(new TextEncoder().encode(xoauth2Str));
      response = await sendSmtpCommand(conn, `AUTH XOAUTH2 ${base64Str}`);
      if (!response.includes("235")) throw new Error("XOAUTH2 authentication failed: " + response.substring(0, 200));
    } else {
      // AUTH LOGIN
      response = await sendSmtpCommand(conn, "AUTH LOGIN");
      if (response.includes("334")) {
        response = await sendSmtpCommand(conn, base64Encode(new TextEncoder().encode(account.smtp_user || account.email_address)));
        if (!response.includes("334")) {
          throw new Error("SMTP rejected username: " + response.substring(0, 200));
        }
        // Send password
        response = await sendSmtpCommand(conn, base64Encode(new TextEncoder().encode(account.smtp_password || "")));
        if (!response.includes("235")) {
          throw new Error("SMTP authentication failed: " + response.substring(0, 200));
        }
      } else {
        throw new Error("AUTH LOGIN not accepted: " + response.substring(0, 200));
      }
    }

    await sendSmtpCommand(conn, "QUIT");
    conn.close();
    return { success: true };
  } catch (err: any) {
    if (conn) try { conn.close(); } catch {}
    return { success: false, error: err.message };
  }
}

async function readImapResponse(conn: Deno.Conn): Promise<string> {
  const decoder = new TextDecoder();
  let fullResponse = "";
  const buf = new Uint8Array(4096);
  try {
    const n = await conn.read(buf);
    if (n === null) return "";
    fullResponse = decoder.decode(buf.subarray(0, n));
  } catch (_e) {
    return "";
  }
  return fullResponse;
}

async function testIMAPLive(account: any): Promise<{ success: boolean; error?: string }> {
  let conn: Deno.Conn | null = null;
  try {
    const port = account.imap_port || 993;
    // Most IMAP servers use TLS on 993
    if (port === 993) {
      conn = await Deno.connectTls({ hostname: account.imap_host, port });
    } else {
      conn = await Deno.connect({ hostname: account.imap_host, port });
    }

    let response = await readImapResponse(conn);
    if (!response.includes("OK")) throw new Error("IMAP greeting failed: " + response.substring(0, 200));

    // Auth
    const sendImap = async (cmd: string) => {
      await conn!.write(new TextEncoder().encode(cmd + "\r\n"));
      return await readImapResponse(conn!);
    };

    if (account.access_token && account.provider === 'gmail') {
      // Gmail XOAUTH2 for IMAP
      const authString = `user=${account.email_address}\x01auth=Bearer ${account.access_token}\x01\x01`;
      const base64Auth = base64Encode(new TextEncoder().encode(authString));
      response = await sendImap(`A001 AUTHENTICATE XOAUTH2 ${base64Auth}`);
    } else {
      // Standard LOGIN
      response = await sendImap(`A001 LOGIN "${account.imap_user || account.email_address}" "${account.imap_password || account.smtp_password}"`);
    }

    if (!response.includes("A001 OK")) throw new Error("IMAP login failed: " + response.substring(0, 200));

    await sendImap("A002 LOGOUT");
    conn.close();
    return { success: true };
  } catch (err: any) {
    if (conn) try { conn.close(); } catch {}
    return { success: false, error: "IMAP Error: " + err.message };
  }
}

async function sendTestEmail(account: any, to: string): Promise<{ success: boolean; error?: string }> {
  let conn: Deno.Conn | null = null;
  try {
    if (account.smtp_secure && (account.smtp_port === 465)) {
      conn = await Deno.connectTls({ hostname: account.smtp_host, port: account.smtp_port });
    } else {
      conn = await Deno.connect({ hostname: account.smtp_host, port: account.smtp_port || 587 });
    }

    // Read initial greeting
    let response = await readSmtpResponse(conn);
    if (!response.includes("220")) throw new Error("Greeting failed: " + response.substring(0, 200));

    // EHLO - read full multi-line response
    response = await sendSmtpCommand(conn, `EHLO fastestcrm.com`);
    
    // STARTTLS upgrade for port 587
    if (account.smtp_port === 587 || (!account.smtp_secure && account.smtp_port !== 465)) {
      if (response.includes("STARTTLS")) {
        response = await sendSmtpCommand(conn, "STARTTLS");
        if (response.includes("220")) {
          conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: account.smtp_host });
          await sendSmtpCommand(conn, `EHLO fastestcrm.com`);
        }
      }
    }

    // Auth - support both XOAUTH2 and password
    if (account.access_token) {
      const xoauth2Str = `user=${account.smtp_user || account.email_address}\x01auth=Bearer ${account.access_token}\x01\x01`;
      const base64Str = base64Encode(new TextEncoder().encode(xoauth2Str));
      response = await sendSmtpCommand(conn, `AUTH XOAUTH2 ${base64Str}`);
      if (!response.includes("235")) throw new Error("OAuth authentication failed: " + response.substring(0, 200));
    } else {
      response = await sendSmtpCommand(conn, "AUTH LOGIN");
      if (!response.includes("334")) throw new Error("AUTH LOGIN not accepted: " + response.substring(0, 200));
      response = await sendSmtpCommand(conn, base64Encode(new TextEncoder().encode(account.smtp_user || account.email_address)));
      if (!response.includes("334")) throw new Error("SMTP rejected username: " + response.substring(0, 200));
      response = await sendSmtpCommand(conn, base64Encode(new TextEncoder().encode(account.smtp_password)));
      if (!response.includes("235")) throw new Error("Authentication failed: " + response.substring(0, 200));
    }

    await sendSmtpCommand(conn, `MAIL FROM:<${account.email_address}>`);
    await sendSmtpCommand(conn, `RCPT TO:<${to}>`);
    response = await sendSmtpCommand(conn, "DATA");
    if (!response.includes("354")) throw new Error("Data command rejected: " + response.substring(0, 200));

    const message = [
      `From: "FastSend Test" <${account.email_address}>`,
      `To: <${to}>`,
      `Subject: FastSend SMTP Test Success ✅`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      `<h2>SMTP Connection Successful!</h2>`,
      `<p>This is a test email from your FastestCRM FastSend dashboard.</p>`,
      `<p>Configured SMTP Host: <b>${account.smtp_host}</b></p>`,
      `<p>Time: ${new Date().toLocaleString()}</p>`,
      `.`,
    ].join("\r\n");

    response = await sendSmtpCommand(conn, message);
    if (!response.includes("250")) throw new Error("Message send failed: " + response.substring(0, 200));

    await sendSmtpCommand(conn, "QUIT");
    conn.close();
    return { success: true };
  } catch (err: any) {
    if (conn) try { conn.close(); } catch {}
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
    const { data: claimsData } = await supabase.auth.getUser(token);
    if (!claimsData?.user) throw new Error("Unauthorized");

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action, accountId, to, ...rawDetails } = body;

    let account: any = null;
    if (accountId) {
      const { data } = await adminClient.from("email_accounts").select("*").eq("id", accountId).single();
      account = data;

      // Auto-refresh Google token if needed
      if (account?.access_token && account?.provider === "gmail") {
        try {
          const freshToken = await getValidAccessToken(account, adminClient);
          account.access_token = freshToken;
        } catch (refreshErr: any) {
          await adminClient.from("email_accounts").update({
            status: "error",
            last_error: "Token refresh failed: " + refreshErr.message,
          }).eq("id", account.id);
          return new Response(JSON.stringify({ error: "Gmail token expired. Please re-connect." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else {
      account = rawDetails;
    }

    if (!account && action !== 'test_send') {
      throw new Error("No account details provided");
    }

    if (action === "test") {
      const smtpResult = await testSMTPLive(account);
      let imapResult = { success: true };

      if (smtpResult.success && account.protocol === 'imap_smtp') {
        imapResult = await testIMAPLive(account);
      }
      
      const result = {
        success: smtpResult.success && imapResult.success,
        error: smtpResult.error || imapResult.error
      };

      if (accountId) {
        await adminClient.from("email_accounts").update({
          status: result.success ? "connected" : "error",
          last_error: result.error || null,
          updated_at: new Date().toISOString(),
        }).eq("id", accountId);
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test_send") {
      if (!to) throw new Error("Recipient required for test email");
      const result = await sendTestEmail(account, to);
      
      // Update account status based on test send result if accountId is present
      if (accountId) {
        await adminClient.from("email_accounts").update({
          status: result.success ? "connected" : "error",
          last_error: result.error || null,
          updated_at: new Date().toISOString(),
        }).eq("id", accountId);
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
