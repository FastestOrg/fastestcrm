import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function executeWorkflow(adminClient: any, workflow_id: string, lead_id: string, company_id: string, execution_id: string | null) {
    console.log(`[AI Workflow] Executing workflow ${workflow_id} for lead ${lead_id}`);

    // 1. Fetch Workflow and Lead Context
    const [{ data: workflow }, { data: lead }] = await Promise.all([
        adminClient.from("ai_workflows").select("*").eq("id", workflow_id).single(),
        adminClient.from("leads").select("*, companies(name, industry)").eq("id", lead_id).single()
    ]);

    if (!workflow || !lead) throw new Error("Workflow or Lead not found");

    // Update execution status to 'running'
    if (execution_id) {
        await adminClient.from("ai_workflow_executions").update({ status: "running" }).eq("id", execution_id);
    } else {
        // Create an execution record if it doesn't exist (e.g. manual run)
        const { data: newExec } = await adminClient.from("ai_workflow_executions").insert({
            workflow_id,
            lead_id,
            company_id,
            status: "running"
        }).select().single();
        execution_id = newExec?.id;
    }

    // 2. Fetch Gemini API Key
    let geminiKey = Deno.env.get("GEMINI_API_KEY");
    const { data: companyKey } = await adminClient
      .from("integration_api_keys")
      .select("api_key")
      .eq("company_id", company_id)
      .eq("service_name", "gemini")
      .eq("is_active", true)
      .maybeSingle();
    if (companyKey?.api_key) geminiKey = companyKey.api_key;

    if (!geminiKey) throw new Error("No Gemini API key available");

    // 3. Compose AI Prompt
    const prompt = `
      You are an Autonomous AI Sales Agent for "${lead.companies?.name || 'FastestCRM'}".
      Your goal is to execute a workflow step for a lead.
      
      WORKFLOW CONTEXT:
      Name: ${workflow.name}
      Goal: ${workflow.outcome_goal}
      Instructions: ${workflow.steps?.[0]?.action_config?.instructions || 'Be professional and helpful.'}
      
      LEAD CONTEXT:
      Name: ${lead.name}
      Status: ${lead.status}
      Email: ${lead.email}
      Phone: ${lead.phone}
      Industry: ${lead.companies?.industry || 'Unknown'}
      Metadata: ${JSON.stringify(lead.enrichment_data || {})}
      
      DECISION:
      Decide the best message or action to take. 
      Available Tools: ${JSON.stringify(workflow.steps?.[0]?.action_config?.allowed_tools || [])}

      OUTPUT JSON ONLY:
      {
        "action": "send_whatsapp" | "send_email" | "update_status" | "notify_team" | "no_action",
        "reasoning": "Brief explanation of why this action was chosen",
        "message_body": "The content of the message to send (if applicable)",
        "subject": "Email subject (if applicable)",
        "target_status": "The new status (if update_status is chosen)",
        "team_notification": "Message for the team (if notify_team is chosen)"
      }
    `;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    if (!geminiRes.ok) throw new Error(`Gemini API error: ${await geminiRes.text()}`);
    const geminiData = await geminiRes.json();
    const aiResponse = JSON.parse(geminiData.candidates[0].content.parts[0].text);

    // 4. Handle Execution (Guided vs Full Pilot)
    if (workflow.autonomy_mode === "guided") {
        // Log to AI Ops Decisions for human approval
        const { data: decision } = await adminClient.from("ai_ops_decisions").insert({
            execution_id: execution_id,
            lead_id: lead_id,
            company_id: company_id,
            decision_type: aiResponse.action === 'send_whatsapp' || aiResponse.action === 'send_email' ? 'RE_ENGAGE' : 'STATUS_UPDATE',
            reasoning: aiResponse.reasoning,
            action_details: { 
                action: aiResponse.action,
                draft: aiResponse.message_body,
                subject: aiResponse.subject,
                target_status: aiResponse.target_status,
                team_notification: aiResponse.team_notification
            },
            status: "pending_approval"
        }).select().single();

        if (execution_id) {
            await adminClient.from("ai_workflow_executions").update({ 
                status: "pending_approval",
                message_draft: aiResponse.message_body,
                steps_log: [{ action: aiResponse.action, reasoning: aiResponse.reasoning, status: "pending_approval" }]
            }).eq("id", execution_id);
        }

        return new Response(JSON.stringify({ success: true, mode: "guided", decision_id: decision?.id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    // 5. Full Pilot Execution
    if (aiResponse.action === "update_status") {
        await adminClient.from("leads").update({ status: aiResponse.target_status }).eq("id", lead_id);
    } else if (aiResponse.action === "notify_team") {
        await adminClient.from("notifications").insert({
            user_id: lead.sales_owner_id || lead.created_by_id,
            lead_id: lead_id,
            title: "Workflow Update",
            message: aiResponse.team_notification,
            type: "info"
        });
    }

    if (execution_id) {
        await adminClient.from("ai_workflow_executions").update({ 
            status: "completed",
            message_draft: aiResponse.message_body,
            outcome: aiResponse.reasoning,
            steps_log: [{ action: aiResponse.action, reasoning: aiResponse.reasoning, status: "completed" }]
        }).eq("id", execution_id);
    }

    // Increment run count
    await adminClient.rpc("increment_workflow_run_count", { wf_id: workflow_id });

    return new Response(JSON.stringify({ success: true, mode: "full_pilot", action: aiResponse.action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    
    const workflow_id = body.workflow_id || body.record?.workflow_id;
    const execution_id = body.execution_id || body.record?.id;
    const lead_id = body.lead_id || body.record?.lead_id;
    const company_id = body.company_id || body.record?.company_id;
    const decision_id = body.decision_id;
    const is_manual = body.manual_trigger === true;

    if (decision_id) {
        console.log(`[AI Workflow] Executing approved decision ${decision_id}`);
        const { data: decision } = await adminClient.from("ai_ops_decisions").select("*").eq("id", decision_id).single();
        if (!decision) throw new Error("Decision not found");

        const action = decision.action_details.action;
        const leadId = decision.lead_id;
        
        console.log(`[AI Workflow] Executing ${action} for lead ${leadId}`);
        
        await adminClient.from("ai_ops_decisions").update({ status: "executed" }).eq("id", decision_id);
        if (decision.execution_id) {
            await adminClient.from("ai_workflow_executions").update({ status: "completed" }).eq("id", decision.execution_id);
        }

        return new Response(JSON.stringify({ success: true, action }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    if (is_manual && !lead_id) {
        const { data: recentLeads } = await adminClient
            .from("leads")
            .select("id")
            .eq("company_id", company_id)
            .order("created_at", { ascending: false })
            .limit(1);
        
        if (!recentLeads || recentLeads.length === 0) {
            return new Response(JSON.stringify({ success: true, message: "No leads found to run on" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
        return await executeWorkflow(adminClient, workflow_id, recentLeads[0].id, company_id, null);
    }

    if (!workflow_id || !lead_id) {
        throw new Error("Missing workflow_id or lead_id");
    }

    return await executeWorkflow(adminClient, workflow_id, lead_id, company_id, execution_id);

  } catch (err: any) {
    console.error(`[AI Workflow Error] ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
