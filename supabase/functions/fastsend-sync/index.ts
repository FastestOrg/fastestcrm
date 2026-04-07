import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow";
import { simpleParser } from "npm:mailparser";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch accounts enabled for IMAP
    const { data: accounts, error: accountError } = await adminClient
      .from("email_accounts")
      .select("*")
      .eq("protocol", "imap_smtp")
      .eq("status", "connected");

    if (accountError) throw accountError;

    const results = [];

    for (const account of accounts || []) {
      const accountResult = { email: account.email_address, new_messages: 0, errors: [] };
      
      let client = new ImapFlow({
        host: account.imap_host,
        port: account.imap_port || 993,
        secure: true,
        auth: {
          user: account.imap_user || account.email_address,
          pass: account.imap_password || account.smtp_password,
        },
        logger: false,
      });

      // Special handling for Gmail OAuth if provided (future improvement)
      // client = ... 

      try {
        await client.connect();
        let lock = await client.getMailboxLock("INBOX");
        const uniqueThreadsToNotify = new Set<string>();
        
        try {
          // Fetch messages from the last 24 hours to keep it light
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

          for await (let msg of client.fetch({ since: yesterday }, { source: true, envelope: true })) {
            const parsed = await simpleParser(msg.source);
            const messageId = parsed.messageId || msg.envelope.messageId;
            
            // Check if message already exists
            const { data: existing } = await adminClient
              .from("email_messages")
              .select("id")
              .eq("message_id", messageId)
              .single();

            if (!existing) {
              // 1. Find or create thread
              const subject = parsed.subject || "No Subject";
              const threadSubject = subject.replace(/^Re:\s+/i, "").replace(/^Fwd:\s+/i, "").trim();
              
              let { data: thread } = await adminClient
                .from("email_threads")
                .select("id")
                .eq("email_account_id", account.id)
                .eq("subject", threadSubject)
                .single();

              if (!thread) {
                // Find lead by email to link
                const fromEmail = parsed.from?.value[0]?.address;
                let leadId = null;
                
                if (fromEmail) {
                  const { data: lead } = await adminClient
                    .from("leads")
                    .select("id")
                    .eq("email", fromEmail)
                    .eq("company_id", account.company_id)
                    .maybeSingle();
                  leadId = lead?.id;
                }

                const { data: newThread } = await adminClient
                  .from("email_threads")
                  .insert({
                    company_id: account.company_id,
                    email_account_id: account.id,
                    subject: threadSubject,
                    snippet: parsed.textAsHtml?.substring(0, 100) || parsed.text?.substring(0, 100),
                    lead_id: leadId,
                    last_message_at: parsed.date || new Date(),
                  })
                  .select()
                  .single();
                thread = newThread;
              }

              // 2. Insert message
              await adminClient.from("email_messages").insert({
                thread_id: thread.id,
                message_id: messageId,
                in_reply_to: parsed.references?.[0] || null,
                from_address: parsed.from?.text || msg.envelope.from?.[0]?.address,
                to_address: parsed.to?.text || msg.envelope.to?.[0]?.address,
                subject: parsed.subject,
                body_html: parsed.html || parsed.textAsHtml,
                body_text: parsed.text,
                received_at: parsed.date || new Date(),
                direction: "inbound",
                is_read: false,
              });

              // Update thread snippet and last_message_at
              await adminClient.from("email_threads").update({
                snippet: parsed.text?.substring(0, 100),
                last_message_at: parsed.date || new Date(),
                is_read: false
              }).eq("id", thread.id);

              accountResult.new_messages++;
              uniqueThreadsToNotify.add(thread.id);
            }
          }

          // Trigger AI Autopilot for each unique thread that received a new message
          for (const threadId of uniqueThreadsToNotify) {
            console.log(`[Sync] Triggering AI Autopilot for thread: ${threadId}`);
            const projectId = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");
            fetch(`https://${projectId}.supabase.co/functions/v1/fastsend-ai-reply`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
              },
              body: JSON.stringify({ threadId })
            }).catch(err => console.error(`[Sync] Error triggering AI reply for ${threadId}:`, err));
          }

        } finally {
          lock.release();
        }
        await client.logout();
      } catch (err: any) {
        accountResult.errors.push(err.message);
      }
      results.push(accountResult);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
