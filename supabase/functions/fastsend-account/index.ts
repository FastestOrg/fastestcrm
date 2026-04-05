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

// ─── SMTP Helpers ─────────────────────────────────────────────────────────────

async function readResponse(conn: Deno.Conn): Promise<string> {
  const buf = new Uint8Array(4096);
  try {
    const n = await conn.read(buf);
    if (n === null) return "";
    return new TextDecoder().decode(buf.subarray(0, n));
  } catch (e) {
    return "";
  }
}

async function sendCommand(conn: Deno.Conn, command: string): Promise<string> {
  await conn.write(new TextEncoder().encode(command + "\r\n"));
  return await readResponse(conn);
}

async function testSMTPLive(account: any): Promise<{ success: boolean; error?: string }> {
  let conn: Deno.Conn | null = null;
  try {
    // 1. Connect
    if (account.smtp_secure && (account.smtp_port === 465)) {
      conn = await Deno.connectTls({ hostname: account.smtp_host, port: account.smtp_port });
    } else {
      conn = await Deno.connect({ hostname: account.smtp_host, port: account.smtp_port || 587 });
    }

    // 2. Greeting
    let response = await readResponse(conn);
    if (!response.startsWith("220")) throw new Error("SMTP greeting failed: " + response);

    // 3. EHLO
    response = await sendCommand(conn, `EHLO fastestcrm.com`);
    if (!response.startsWith("250")) throw new Error("EHLO failed: " + response);

    // 4. STARTTLS if needed
    if (account.smtp_port === 587 || (!account.smtp_secure && account.smtp_port !== 465)) {
        if (response.includes("STARTTLS")) {
            response = await sendCommand(conn, "STARTTLS");
            if (response.startsWith("220")) {
                conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: account.smtp_host });
                response = await sendCommand(conn, `EHLO fastestcrm.com`);
            }
        }
    }

    // 5. AUTH LOGIN check
    response = await sendCommand(conn, "AUTH LOGIN");
    if (response.startsWith("334")) {
        // Just checking if it responds to AUTH LOGIN, we won't send credentials here to keep it a "test"
        // Actually, let's try one step of auth to be sure
        response = await sendCommand(conn, base64Encode(new TextEncoder().encode(account.smtp_user || account.email_address)));
        if (!response.startsWith("334") && !response.startsWith("235")) {
             throw new Error("SMTP rejected username: " + response);
        }
    }

    await sendCommand(conn, "QUIT");
    conn.close();
    return { success: true };
  } catch (err: any) {
    if (conn) try { conn.close(); } catch {}
    return { success: false, error: err.message };
  }
}

async function sendTestEmail(account: any, to: string): Promise<{ success: boolean; error?: string }> {
  let conn: Deno.Conn | null = null;
  try {
    // Connect
    if (account.smtp_secure && (account.smtp_port === 465)) {
      conn = await Deno.connectTls({ hostname: account.smtp_host, port: account.smtp_port });
    } else {
      conn = await Deno.connect({ hostname: account.smtp_host, port: account.smtp_port || 587 });
    }

    let response = await readResponse(conn);
    if (!response.startsWith("220")) throw new Error("Greeting failed");

    await sendCommand(conn, `EHLO fastestcrm.com`);
    
    if (account.smtp_port === 587 || (!account.smtp_secure && account.smtp_port !== 465)) {
        await sendCommand(conn, "STARTTLS");
        conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: account.smtp_host });
        await sendCommand(conn, `EHLO fastestcrm.com`);
    }

    // Auth
    await sendCommand(conn, "AUTH LOGIN");
    await sendCommand(conn, base64Encode(new TextEncoder().encode(account.smtp_user || account.email_address)));
    response = await sendCommand(conn, base64Encode(new TextEncoder().encode(account.smtp_password)));
    if (!response.startsWith("235")) throw new Error("Authentication failed: " + response);

    // Flow
    await sendCommand(conn, `MAIL FROM:<${account.email_address}>`);
    await sendCommand(conn, `RCPT TO:<${to}>`);
    response = await sendCommand(conn, "DATA");
    if (!response.startsWith("354")) throw new Error("Data rejected");

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

    response = await sendCommand(conn, message);
    if (!response.startsWith("250")) throw new Error("Message send failed: " + response);

    await sendCommand(conn, "QUIT");
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

    let account = null;
    if (accountId) {
      const { data } = await adminClient.from("email_accounts").select("*").eq("id", accountId).single();
      account = data;
    } else {
      // Use raw details for testing before save
      account = rawDetails;
    }

    if (!account && action !== 'test_send') {
      throw new Error("No account details provided");
    }

    if (action === "test") {
      const result = await testSMTPLive(account);
      
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
