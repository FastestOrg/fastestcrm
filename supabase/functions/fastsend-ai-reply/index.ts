import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { threadId } = await req.json();

    if (!threadId) {
      throw new Error("Missing threadId");
    }

    // 1. Fetch thread and messages
    const { data: thread } = await adminClient
      .from("email_threads")
      .select("*, leads(first_name, last_name, company_name), email_accounts(email_address)")
      .eq("id", threadId)
      .single();

    if (!thread || !thread.lead_id) {
      return new Response(JSON.stringify({ message: "Thread not found or not linked to a lead." }), { headers: corsHeaders });
    }

    // 2. Find active campaign for this lead with auto-reply enabled
    const { data: recipient } = await adminClient
      .from("email_campaign_recipients")
      .select("campaign_id")
      .eq("lead_id", thread.lead_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!recipient) {
      return new Response(JSON.stringify({ message: "No campaign found for lead." }), { headers: corsHeaders });
    }

    const { data: campaign } = await adminClient
      .from("email_campaigns")
      .select("*")
      .eq("id", recipient.campaign_id)
      .single();

    if (!campaign || !campaign.ai_auto_reply_enabled) {
      return new Response(JSON.stringify({ message: "Campaign does not have AI auto-reply enabled." }), { headers: corsHeaders });
    }

    // 3. Fetch thread messages
    const { data: messages } = await adminClient
      .from("email_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("received_at", { ascending: true });

    if (!messages || messages.length === 0) {
       return new Response(JSON.stringify({ message: "No messages in thread." }), { headers: corsHeaders });
    }

    // Don't auto-reply if the last message is outbound
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.direction === "outbound") {
      return new Response(JSON.stringify({ message: "Last message is outbound, waiting for lead reply." }), { headers: corsHeaders });
    }

    // 4. Fetch Gemini API Key
    const { data: integration } = await adminClient
      .from("integration_api_keys")
      .select("api_key")
      .eq("company_id", thread.company_id)
      .eq("provider", "gemini")
      .single();

    if (!integration || !integration.api_key) {
      throw new Error("Gemini API key not configured for company.");
    }

    // 5. Construct Prompt
    const leadName = `${thread.leads.first_name || ''} ${thread.leads.last_name || ''}`.trim() || 'there';
    const leadCompany = thread.leads.company_name || 'your company';
    
    // Process messages into a clean conversation text
    const conversationHistory = messages.map((m: any) => {
        const sender = m.direction === 'inbound' ? leadName : 'Me';
        const body = (m.body_text || m.body_html || '').replace(/<[^>]*>?/gm, ''); // strip HTML
        return `${sender}: ${body.substring(0, 500)}`; // limit size
    }).join("\n\n");

    const goal = campaign.ai_auto_reply_goal || campaign.goal || "Move the conversation towards a sale or meeting.";
    const perspective = campaign.ai_auto_reply_perspective || campaign.ai_perspective || "I am a helpful sales representative.";

    const prompt = `You are an AI sales assistant. 
Perspective: ${perspective}
Your Goal: ${goal}

You are talking to ${leadName} from ${leadCompany}.
Here is the email conversation history:
---
${conversationHistory}
---

Write a short, professional, and convincing email reply to ${leadName}. Do NOT include subject lines or "Subject:". Just write the plain text body of the email. Keep it concise, natural, and directly address the latest message while pivoting towards the Goal. Do not use placeholders, try to end with a question or clear call to action.`;

    // 6. Call Gemini
    const model = "gemini-3.1-flash-lite-preview";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${integration.api_key}`;
    
    console.log(`[AI Autopilot] Generating reply for thread ${threadId} using ${model}...`);

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
        }
      })
    });

    if (!geminiRes.ok) {
       const errBody = await geminiRes.text();
       console.error(`[AI Autopilot] Gemini API error:`, errBody);
       throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    let generatedReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedReply) {
       console.error(`[AI Autopilot] No content generated. Response:`, JSON.stringify(geminiData));
       throw new Error("Failed to generate content from Gemini.");
    }
    
    console.log(`[AI Autopilot] Successfully generated reply. Length: ${generatedReply.length}`);

    // Replace newlines with <br/> for HTML
    const htmlReply = `<p>${generatedReply.trim().replace(/\n/g, '<br/>')}</p>`;

    // 7. Send the reply via fastsend-send
    const authHeader = req.headers.get("Authorization") || `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    const projectId = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");
    const sendUrl = `https://${projectId}.supabase.co/functions/v1/fastsend-send`;

    console.log(`[AI Autopilot] Triggering send for thread ${threadId}...`);

    const sendRes = await fetch(sendUrl, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "Authorization": authHeader
       },
       body: JSON.stringify({
          accountId: thread.email_account_id,
          to: lastMessage.from_address || thread.subject.match(/<(.+?)>/)?.[1] || '',
          subject: thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`,
          bodyHtml: htmlReply,
          companyId: thread.company_id,
          threadId: thread.id,
          inReplyTo: lastMessage.message_id,
          references: lastMessage.message_id,
          campaignId: campaign.id
       })
    });

    if (!sendRes.ok) {
       const errResp = await sendRes.text();
       console.error(`[AI Autopilot] Send failed:`, errResp);
       throw new Error(`Failed to send AI reply: ${errResp}`);
    }

    console.log(`[AI Autopilot] Autonomous reply sent successfully for thread ${threadId}`);

    return new Response(JSON.stringify({ success: true, message: "AI Reply sent." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error(`[AI Autopilot] Fatal Error:`, err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
