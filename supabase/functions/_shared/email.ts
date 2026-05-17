import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
}

export async function sendSystemEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  const host = Deno.env.get("SYSTEM_SMTP_HOST");
  const port = parseInt(Deno.env.get("SYSTEM_SMTP_PORT") || "587");
  const user = Deno.env.get("SYSTEM_SMTP_USER");
  const pass = Deno.env.get("SYSTEM_SMTP_PASS");
  const defaultFromEmail = Deno.env.get("SYSTEM_SMTP_FROM_EMAIL");
  const defaultFromName = Deno.env.get("SYSTEM_SMTP_FROM_NAME") || "FastestCRM";

  if (!host || !user || !pass) {
    console.error("Missing SMTP configuration. Please set SYSTEM_SMTP_HOST, SYSTEM_SMTP_USER, and SYSTEM_SMTP_PASS.");
    return { success: false, error: "SMTP configuration missing" };
  }

  const fromEmail = options.fromEmail || defaultFromEmail;
  const fromName = options.fromName || defaultFromName;

  if (!fromEmail) {
    return { success: false, error: "Sender email (fromEmail) is required." };
  }

  let conn: Deno.Conn | null = null;

  try {
    // Helper to read SMTP responses
    const readResponse = async (c: Deno.Conn) => {
      const buf = new Uint8Array(4096);
      const n = await c.read(buf);
      return n ? new TextDecoder().decode(buf.subarray(0, n)) : "";
    };

    // Helper to send SMTP commands
    const sendCommand = async (c: Deno.Conn, cmd: string) => {
      await c.write(new TextEncoder().encode(cmd + "\r\n"));
      return await readResponse(c);
    };

    // 1. Connect
    if (port === 465) {
      conn = await Deno.connectTls({ hostname: host, port });
    } else {
      conn = await Deno.connect({ hostname: host, port });
    }

    let response = await readResponse(conn);
    if (!response.startsWith("220")) throw new Error("SMTP Greeting Failed: " + response);

    // 2. EHLO
    response = await sendCommand(conn, "EHLO fastestcrm.com");

    // 3. STARTTLS if 587
    if (port === 587) {
      response = await sendCommand(conn, "STARTTLS");
      if (response.startsWith("220")) {
        conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: host });
        response = await sendCommand(conn, "EHLO fastestcrm.com");
      }
    }

    // 4. Authenticate (AUTH LOGIN)
    response = await sendCommand(conn, "AUTH LOGIN");
    await sendCommand(conn, base64Encode(new TextEncoder().encode(user)));
    response = await sendCommand(conn, base64Encode(new TextEncoder().encode(pass)));
    if (!response.startsWith("235")) throw new Error("SMTP Authentication Failed: " + response);

    // 5. MAIL FROM
    response = await sendCommand(conn, `MAIL FROM:<${fromEmail}>`);

    // 6. RCPT TO
    response = await sendCommand(conn, `RCPT TO:<${options.to}>`);

    // 7. DATA
    response = await sendCommand(conn, "DATA");
    if (!response.startsWith("354")) throw new Error("SMTP DATA Rejected: " + response);

    // 8. Build Message
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const subjectEncoded = `=?UTF-8?B?${base64Encode(new TextEncoder().encode(options.subject))}?=`;
    
    // Simple text version
    const textBody = options.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    const message = [
      `From: "${fromName.replace(/"/g, "")}" <${fromEmail}>`,
      `To: <${options.to}>`,
      `Subject: ${subjectEncoded}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      base64Encode(new TextEncoder().encode(textBody)),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      base64Encode(new TextEncoder().encode(options.html)),
      ``,
      `--${boundary}--`,
      `.`,
    ].join("\r\n");

    response = await sendCommand(conn, message);
    if (!response.startsWith("250")) throw new Error("SMTP Send Failed: " + response);

    // 9. QUIT
    await sendCommand(conn, "QUIT");
    conn.close();

    return { success: true };
  } catch (err: any) {
    console.error("SMTP Error:", err);
    try { conn?.close(); } catch {}
    return { success: false, error: err.message };
  }
}

export function getEmailTemplate(title: string, body: string, ctaText?: string, ctaUrl?: string, type: 'info' | 'warning' | 'success' | 'danger' = 'info'): string {
  const colors = {
    info: "#8B5CF6",    // FastCRM Primary (Purple)
    warning: "#F59E0B", // Amber
    success: "#10B981", // Emerald
    danger: "#EF4444"   // Red
  };
  
  const primaryColor = colors[type];
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f9fafb; padding: 40px 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; }
        .header { background-color: ${primaryColor}; padding: 32px 20px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em; }
        .content { padding: 40px 32px; }
        .footer { padding: 24px; text-align: center; font-size: 13px; color: #6b7280; background-color: #f9fafb; border-top: 1px solid #e5e7eb; }
        .button { display: inline-block; padding: 14px 28px; background-color: ${primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 24px 0; text-align: center; }
        .info-box { background-color: #f3f4f6; padding: 20px; border-radius: 10px; margin: 24px 0; border: 1px solid #e5e7eb; }
        .info-item { margin-bottom: 12px; display: block; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
        .info-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .info-label { font-weight: 600; color: #4b5563; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; display: block; }
        .info-value { color: #111827; font-size: 15px; font-weight: 500; }
        .text-center { text-align: center; }
        p { margin: 0 0 16px 0; font-size: 16px; color: #374151; }
        strong { color: #111827; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
          </div>
          <div class="content">
            ${body}
            ${ctaText && ctaUrl ? `<div class="text-center"><a href="${ctaUrl}" class="button">${ctaText}</a></div>` : ''}
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} FastestCRM. All rights reserved.<br>
            <span style="margin-top: 8px; display: block;">Transforming Sales through Agentic Operations.</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
