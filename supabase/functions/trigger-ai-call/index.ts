import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ───────────────────────────────────────────────────────────────────────────────
// QUEUE ARCHITECTURE
// - Calls are stored as rows in integration_api_keys with service_name='ai_call_queue'
// - Each row: { api_key: JSON(QueueItem), is_active: true=pending, false=done }
// - Gemini API key is fetched from company's own integration (service_name='gemini')
// ───────────────────────────────────────────────────────────────────────────────

interface QueueItem {
    lead_id: string;
    lead_phone: string;
    lead_name: string;
    agent_id: string;
    automation_id?: string;
    company_id: string;
    enqueued_at: string;
    status: "pending" | "calling" | "completed" | "failed";
    call_id?: string;
    error?: string;
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Auth check
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

        const body = await req.json();
        const { lead_id, lead_phone, lead_name, agent_id, automation_id, company_id } = body;

        if (!lead_phone || !agent_id || !company_id) {
            return new Response(JSON.stringify({ error: "Missing required fields: lead_phone, agent_id, company_id" }), {
                status: 400, headers: corsHeaders
            });
        }

        // 1. Fetch agent config
        const { data: agentRow, error: agentError } = await supabase
            .from("integration_api_keys")
            .select("api_key, is_active")
            .eq("id", agent_id)
            .eq("service_name", "ai_caller_agent")
            .eq("is_active", true)
            .maybeSingle();

        if (agentError || !agentRow) {
            return new Response(JSON.stringify({ error: "Agent not found or inactive" }), { status: 404, headers: corsHeaders });
        }

        const agentConfig = typeof agentRow.api_key === "string" ? JSON.parse(agentRow.api_key) : agentRow.api_key;

        // 2. Fetch Vobiz credentials for this company
        const { data: vobizRow, error: vobizError } = await supabase
            .from("integration_api_keys")
            .select("api_key")
            .eq("company_id", company_id)
            .eq("service_name", "vobiz")
            .eq("is_active", true)
            .maybeSingle();

        if (vobizError || !vobizRow) {
            return new Response(JSON.stringify({ error: "Vobiz integration not connected. Please connect it in Integrations page." }), { status: 400, headers: corsHeaders });
        }

        const vobizConfig = typeof vobizRow.api_key === "string" ? JSON.parse(vobizRow.api_key) : vobizRow.api_key;

        // 3. Fetch company's Gemini API key (same pattern as generate-ai-insights)
        let { data: geminiRow } = await supabase
            .from("integration_api_keys")
            .select("api_key")
            .eq("company_id", company_id)
            .eq("service_name", "gemini")
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

        // Fallback: legacy keys stored by user_id instead of company_id
        if (!geminiRow?.api_key) {
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id")
                .eq("company_id", company_id);

            if (profiles && profiles.length > 0) {
                const userIds = profiles.map((p: any) => p.id);
                const { data: legacyKey } = await supabase
                    .from("integration_api_keys")
                    .select("api_key")
                    .in("user_id", userIds)
                    .eq("service_name", "gemini")
                    .eq("is_active", true)
                    .limit(1)
                    .maybeSingle();

                if (legacyKey) geminiRow = legacyKey;
            }
        }

        if (!geminiRow?.api_key) {
            return new Response(JSON.stringify({
                error: "No Gemini API key found. Please connect Google Gemini in the Integrations page first."
            }), { status: 400, headers: corsHeaders });
        }

        const pendingCount = 0; // Set to 0 to bypass queue logic and initiate call immediately

        // 5. Enqueue the call item
        const queueItem: QueueItem = {
            lead_id: lead_id || "",
            lead_phone,
            lead_name: lead_name || "Unknown",
            agent_id,
            automation_id,
            company_id,
            enqueued_at: new Date().toISOString(),
            status: pendingCount > 0 ? "pending" : "calling",
        };

        const { data: queueRow, error: insertError } = await supabase
            .from("integration_api_keys")
            .insert({
                user_id: user.id,
                company_id,
                service_name: "ai_call_queue",
                api_key: JSON.stringify(queueItem),
                is_active: true,
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // 6. If no active call, fire immediately via Vobiz
        if (pendingCount === 0) {
            const callResult = await initiateVobizCall({
                authId: vobizConfig.auth_id,
                authToken: vobizConfig.auth_token,
                fromNumber: agentConfig.phone_number || vobizConfig.phone_number,
                toNumber: lead_phone,
                queueItemId: queueRow.id,
                agentConfig,
                supabaseUrl,
            });

            const updatedItem: QueueItem = {
                ...queueItem,
                status: callResult.success ? "calling" : "failed",
                call_id: callResult.callId,
                error: callResult.error,
            };

            await supabase
                .from("integration_api_keys")
                .update({ api_key: JSON.stringify(updatedItem) })
                .eq("id", queueRow.id);

            return new Response(JSON.stringify({
                success: callResult.success,
                queued: false,
                queue_item_id: queueRow.id,
                call_id: callResult.callId,
                message: callResult.success ? "Call initiated" : `Call failed: ${callResult.error}`,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({
            success: true,
            queued: true,
            queue_item_id: queueRow.id,
            position: pendingCount + 1,
            message: `Call queued at position ${pendingCount + 1}`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err: any) {
        console.error("trigger-ai-call error:", err);
        return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

// ─── Initiate Vobiz outbound call ──────────────────────────────────────────────
// answer_url → Vobiz calls the consolidated ai-caller function when the call connects
// ai-caller returns <Stream> XML pointing to its own WebSocket upgrade endpoint
// ai-caller upgrades the socket and bridges audio bidirectionally with Gemini Live
// ──────────────────────────────────────────────────────────────────────────────
async function initiateVobizCall(params: {
    authId: string;
    authToken: string;
    fromNumber: string;
    toNumber: string;
    queueItemId: string;
    agentConfig: any;
    supabaseUrl: string;
}) {
    const { authId, authToken, fromNumber, toNumber, queueItemId, agentConfig, supabaseUrl } = params;

    // answer_url — Vobiz POSTs here when the callee picks up
    const answerUrl = `${supabaseUrl}/functions/v1/ai-caller?` +
        `queue_item_id=${encodeURIComponent(queueItemId)}`;

    // hangup_url — Vobiz POSTs here when the call ends
    const hangupUrl = `${supabaseUrl}/functions/v1/ai-caller?` +
        `action=hangup&queue_item_id=${encodeURIComponent(queueItemId)}`;

    try {
        const response = await fetch(
            `https://api.vobiz.ai/api/v1/Account/${authId}/Call/`,
            {
                method: "POST",
                headers: {
                    "X-Auth-ID": authId,
                    "X-Auth-Token": authToken,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: fromNumber,
                    to: toNumber,
                    answer_url: answerUrl,
                    hangup_url: hangupUrl,
                }),
            }
        );

        const result = await response.json();

        if (!response.ok) {
            console.error("Vobiz call initiation failed:", result);
            return { success: false, error: result?.error || result?.message || `HTTP ${response.status}` };
        }

        return { success: true, callId: result?.request_uuid || result?.call_uuid || result?.id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
