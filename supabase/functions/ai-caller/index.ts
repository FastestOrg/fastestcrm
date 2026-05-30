import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ───────────────────────────────────────────────────────────────────────────────
// G.711 mu-law Lookup Tables & Codecs
// ───────────────────────────────────────────────────────────────────────────────
const ulawToLinearTable = new Int16Array(256);
for (let i = 0; i < 256; i++) {
    const ulaw = ~i;
    const sign = (ulaw & 0x80) ? -1 : 1;
    const exponent = (ulaw & 0x70) >> 4;
    const mantissa = ulaw & 0x0F;
    let sample = (mantissa << 3) + 132;
    sample <<= exponent;
    sample -= 132;
    ulawToLinearTable[i] = sign * sample;
}

const BIAS = 0x84;
const CLIP = 32635;
function linear2ulaw(sample: number): number {
    const sign = (sample < 0) ? 0x80 : 0x00;
    if (sample < 0) sample = -sample;
    if (sample > CLIP) sample = CLIP;
    sample += BIAS;
    let exponent = 7;
    for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) {
        exponent--;
    }
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    return ~(sign | (exponent << 4) | mantissa);
}

// Helper to convert base64 to Uint8Array (Deno compatible)
function base64ToBytes(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Helper to convert Uint8Array to base64
function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ───────────────────────────────────────────────────────────────────────────────
// Main handler: HTTP and WebSocket
// ───────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const queueItemId = url.searchParams.get("queue_item_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // DB logging helper for remote debugging
    const logToDb = async (message: string, details?: any) => {
        try {
            await supabase
                .from("debug_logs")
                .insert({
                    message: `[AI-Caller] ${message}`,
                    details: details ? (typeof details === "string" ? details : JSON.stringify(details)) : null
                });
        } catch (dbErr) {
            console.error("Failed to write to debug_logs table:", dbErr);
        }
    };

    // ── CASE 1: WebSocket Request (Bidirectional Audio Stream) ──────────────────
    if (req.headers.get("upgrade") === "websocket") {
        const { socket: vobizSocket, response } = Deno.upgradeWebSocket(req);
        vobizSocket.binaryType = "arraybuffer";

        // Run the DB querying and Gemini setup asynchronously to respond immediately to HTTP handshake
        (async () => {
            if (!queueItemId) {
                console.error("WebSocket connection missing queue_item_id");
                await logToDb("WebSocket connection failed: missing queue_item_id");
                vobizSocket.close(1008, "Missing queue_item_id");
                return;
            }

            let streamId = "";
            let geminiSocket: WebSocket | null = null;
            let geminiSetupComplete = false;
            let keepaliveInterval: number | null = null;
            const pendingAudioChunks: string[] = [];

            await logToDb("WebSocket connection received", { queueItemId, url: req.url });

            // Helper to update DB queue item status
            const updateQueueStatus = async (status: string, error?: string) => {
                try {
                    const { data: queueRow } = await supabase
                        .from("integration_api_keys")
                        .select("api_key")
                        .eq("id", queueItemId)
                        .maybeSingle();

                    if (queueRow) {
                        const item = typeof queueRow.api_key === "string" ? JSON.parse(queueRow.api_key) : queueRow.api_key;
                        const updatedItem = {
                            ...item,
                            status,
                            ended_at: new Date().toISOString(),
                        };
                        if (error) {
                            updatedItem.error = error;
                        }
                        await supabase
                            .from("integration_api_keys")
                            .update({ 
                                api_key: JSON.stringify(updatedItem),
                                is_active: status === "calling" || status === "pending"
                            })
                            .eq("id", queueItemId);
                        console.log(`[AI-Caller] Updated queue item ${queueItemId} to status: ${status}, error: ${error || 'none'}`);
                        await logToDb(`Queue item status updated: ${status}`, { error });
                    }
                } catch (dbErr: any) {
                    console.error("[AI-Caller] Failed to update queue status in DB:", dbErr);
                    await logToDb("Failed to update queue status in DB", dbErr.message);
                }
            };

            // Helper: send audio from Gemini to Vobiz
            const sendAudioToVobiz = (base64Ulaw: string) => {
                if (vobizSocket.readyState === WebSocket.OPEN) {
                    const msg: any = {
                        event: "playAudio",
                        media: {
                            contentType: "audio/x-mulaw",
                            sampleRate: 8000,
                            payload: base64Ulaw
                        }
                    };
                    if (streamId) {
                        msg.streamId = streamId;
                    }
                    vobizSocket.send(JSON.stringify(msg));
                }
            };

            // Helper: convert 8kHz mu-law to 16kHz PCM and send to Gemini
            const sendAudioToGemini = (base64MulawPayload: string) => {
                if (!geminiSocket || geminiSocket.readyState !== WebSocket.OPEN || !geminiSetupComplete) {
                    return;
                }

                const ulawBytes = base64ToBytes(base64MulawPayload);
                const N = ulawBytes.length;

                // Upsample 8kHz mu-law -> 16kHz 16-bit PCM little-endian
                const pcm16k = new Int16Array(N * 2);
                for (let i = 0; i < N; i++) {
                    const s0 = ulawToLinearTable[ulawBytes[i]];
                    const s1 = (i < N - 1) ? ulawToLinearTable[ulawBytes[i + 1]] : s0;
                    pcm16k[i * 2] = s0;
                    pcm16k[i * 2 + 1] = Math.round((s0 + s1) / 2);
                }

                const pcm16kBytes = new Uint8Array(pcm16k.length * 2);
                const outView = new DataView(pcm16kBytes.buffer);
                for (let i = 0; i < pcm16k.length; i++) {
                    outView.setInt16(i * 2, pcm16k[i], true);
                }

                const base64Pcm16k = bytesToBase64(pcm16kBytes);

                geminiSocket.send(JSON.stringify({
                    realtimeInput: {
                        audio: {
                            mimeType: "audio/pcm;rate=16000",
                            data: base64Pcm16k
                        }
                    }
                }));
            };

            const cleanup = () => {
                if (keepaliveInterval) {
                    clearInterval(keepaliveInterval);
                    keepaliveInterval = null;
                }
            };

            try {
                // 1. Fetch queue item details
                const { data: queueRow, error: queueErr } = await supabase
                    .from("integration_api_keys")
                    .select("api_key, company_id")
                    .eq("id", queueItemId)
                    .maybeSingle();

                if (queueErr || !queueRow) {
                    throw new Error(`Queue item not found or error: ${queueErr?.message || "Not found"}`);
                }

                const queueItem = typeof queueRow.api_key === "string" ? JSON.parse(queueRow.api_key) : queueRow.api_key;
                const companyId = queueRow.company_id || queueItem.company_id;
                const agentId = queueItem.agent_id;

                // 2. Fetch agent config
                let agentConfig: any = {};
                if (agentId) {
                    const { data: agentRow } = await supabase
                        .from("integration_api_keys")
                        .select("api_key")
                        .eq("id", agentId)
                        .maybeSingle();

                    if (agentRow) {
                        agentConfig = typeof agentRow.api_key === "string" ? JSON.parse(agentRow.api_key) : agentRow.api_key;
                    }
                }

                // 3. Fetch company's Gemini API key
                let geminiKey: string | null = null;
                let { data: geminiRow } = await supabase
                    .from("integration_api_keys")
                    .select("api_key")
                    .eq("company_id", companyId)
                    .eq("service_name", "gemini")
                    .eq("is_active", true)
                    .limit(1)
                    .maybeSingle();

                if (!geminiRow?.api_key) {
                    // Fallback for legacy keys stored by user_id
                    const { data: profiles } = await supabase
                        .from("profiles")
                        .select("id")
                        .eq("company_id", companyId);

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
                    throw new Error("Gemini API key not configured for this company. Please connect Google Gemini in the Integrations page.");
                }
                geminiKey = geminiRow.api_key;

                const voice = agentConfig.voice || "Aoede";
                const systemPrompt = agentConfig.system_prompt || agentConfig.prompt || "You are a helpful customer service assistant. Speak clearly and concisely.";
                const greetingPrompt = agentConfig.greeting_prompt || "Greet the customer warmly. Introduce yourself and ask how you can help them today.";

                // 4. Connect to Gemini Live WebSocket
                const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(geminiKey)}`;
                
                await logToDb("Connecting to Gemini Live API");
                geminiSocket = new WebSocket(geminiWsUrl);
                geminiSocket.binaryType = "arraybuffer";

                geminiSocket.onopen = () => {
                    console.log("[AI-Caller] Connected to Gemini Live. Sending setup...");
                    const setupMessage = {
                        setup: {
                            model: "models/gemini-3.1-flash-live-preview",
                            generationConfig: {
                                responseModalities: ["AUDIO"],
                                speechConfig: {
                                    voiceConfig: {
                                        prebuiltVoiceConfig: {
                                            voiceName: voice,
                                        }
                                    }
                                }
                            },
                            systemInstruction: {
                                parts: [{ text: systemPrompt }]
                            }
                        }
                    };
                    geminiSocket?.send(JSON.stringify(setupMessage));

                    // Keepalive pings
                    keepaliveInterval = setInterval(() => {
                        if (geminiSocket && geminiSocket.readyState === WebSocket.OPEN) {
                            try {
                                geminiSocket.send(JSON.stringify({
                                    realtimeInput: {
                                        audio: {
                                            mimeType: "audio/pcm;rate=16000",
                                            data: ""
                                        }
                                    }
                                }));
                            } catch (_) {}
                        }
                    }, 15000) as unknown as number;
                };

                geminiSocket.onmessage = async (event) => {
                    try {
                        const rawData = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data);
                        const msg = JSON.parse(rawData);

                        if (msg.setupComplete) {
                            console.log("[AI-Caller] Gemini setup complete.");
                            await logToDb("Gemini setup complete");
                            geminiSetupComplete = true;

                            // Send greeting prompt so Gemini starts speaking immediately
                            geminiSocket?.send(JSON.stringify({
                                realtimeInput: { text: greetingPrompt }
                            }));

                            // Flush any buffered audio from Vobiz
                            while (pendingAudioChunks.length > 0) {
                                const chunk = pendingAudioChunks.shift()!;
                                sendAudioToGemini(chunk);
                            }
                            return;
                        }

                        if (msg.interrupted || (msg.serverContent && msg.serverContent.interrupted)) {
                            console.log("[AI-Caller] Gemini interrupted (barge-in).");
                            if (vobizSocket.readyState === WebSocket.OPEN) {
                                const clearMsg: any = { event: "clearAudio" };
                                if (streamId) clearMsg.streamId = streamId;
                                vobizSocket.send(JSON.stringify(clearMsg));
                            }
                            return;
                        }

                        const inlineData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData;
                        if (inlineData && inlineData.mimeType?.startsWith("audio/")) {
                            const base64Data = inlineData.data;
                            const pcm24kBytes = base64ToBytes(base64Data);

                            // Downsample 24kHz PCM -> 8kHz mu-law mono
                            const samplesCount24k = pcm24kBytes.byteLength / 2;
                            const count8k = Math.floor(samplesCount24k / 3);
                            const ulawBytes = new Uint8Array(count8k);
                            const dataView = new DataView(pcm24kBytes.buffer, pcm24kBytes.byteOffset, pcm24kBytes.byteLength);

                            for (let i = 0; i < count8k; i++) {
                                const sample24k = dataView.getInt16(i * 3 * 2, true);
                                ulawBytes[i] = linear2ulaw(sample24k);
                            }

                            const base64Ulaw = bytesToBase64(ulawBytes);
                            sendAudioToVobiz(base64Ulaw);
                        }

                    } catch (err: any) {
                        console.error("[AI-Caller] Gemini msg err:", err);
                        await logToDb("Error processing Gemini message", err.message);
                    }
                };

                geminiSocket.onerror = async (e: any) => {
                    console.error("[AI-Caller] Gemini WS error:", e);
                    await logToDb("Gemini WS error", e.message || "WS Error");
                    updateQueueStatus("failed", "Gemini WebSocket error. Verify API key and configuration.");
                    cleanup();
                };

                geminiSocket.onclose = async (e) => {
                    console.log(`[AI-Caller] Gemini WS closed. Code: ${e.code}, Reason: ${e.reason}`);
                    await logToDb("Gemini WS closed", { code: e.code, reason: e.reason });
                    cleanup();
                    if (e.code !== 1000) {
                        updateQueueStatus("failed", `Gemini connection closed with code ${e.code}: ${e.reason || 'Unknown error'}`);
                    }
                    if (vobizSocket.readyState === WebSocket.OPEN) {
                        vobizSocket.close();
                    }
                };

            } catch (setupErr: any) {
                console.error("[AI-Caller] Setup failed:", setupErr);
                await logToDb("Setup failed", setupErr.message);
                updateQueueStatus("failed", setupErr.message);
                vobizSocket.close(1011, setupErr.message);
                return;
            }

            vobizSocket.onopen = async () => {
                console.log("[AI-Caller] Vobiz connected.");
                await logToDb("Vobiz connected");
                updateQueueStatus("calling");
            };

            vobizSocket.onmessage = async (event) => {
                try {
                    const rawData = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data);
                    const data = JSON.parse(rawData);

                    if (data.event === "start") {
                        streamId = data.streamId || data.callSid || "";
                        console.log(`[AI-Caller] Call started. Stream ID: ${streamId}`);
                        await logToDb("Vobiz start event", data);
                        return;
                    }

                    if (data.event === "media") {
                        const payload = data.media?.payload;
                        if (!payload) return;

                        if (geminiSetupComplete) {
                            sendAudioToGemini(payload);
                        } else {
                            // Buffer audio (max 150 chunks ~ 3 seconds)
                            if (pendingAudioChunks.length < 150) {
                                pendingAudioChunks.push(payload);
                            }
                        }
                    }

                    if (data.event === "stop") {
                        console.log("[AI-Caller] Vobiz stream stop event.");
                        await logToDb("Vobiz stop event", data);
                    }
                } catch (err: any) {
                    console.error("[AI-Caller] Vobiz msg err:", err);
                    await logToDb("Error handling Vobiz message", err.message);
                }
            };

            vobizSocket.onerror = async (e: any) => {
                console.error("[AI-Caller] Vobiz socket error:", e);
                await logToDb("Vobiz socket error", e.message || "WS Error");
                cleanup();
            };

            vobizSocket.onclose = async () => {
                console.log("[AI-Caller] Vobiz socket closed. Closing Gemini...");
                await logToDb("Vobiz socket closed");
                cleanup();
                if (geminiSocket && geminiSocket.readyState === WebSocket.OPEN) {
                    geminiSocket.close();
                }
            };

        })();

        return response;
    }

    // ── CASE 2: HTTP Webhook Callback (answer_url or hangup_url) ────────────────
    try {
        // ── HANGUP EVENT ───────────────────────────────────────────────────────
        if (action === "hangup") {
            const body = await req.text();
            const params = new URLSearchParams(body);
            const duration = params.get("Duration") || params.get("duration") || "0";

            if (queueItemId) {
                const { data: queueRow } = await supabase
                    .from("integration_api_keys")
                    .select("api_key")
                    .eq("id", queueItemId)
                    .single();

                if (queueRow) {
                    const item = typeof queueRow.api_key === "string" ? JSON.parse(queueRow.api_key) : queueRow.api_key;
                    const finalStatus = item.status === "failed" ? "failed" : "completed";

                    await supabase
                        .from("integration_api_keys")
                        .update({
                            api_key: JSON.stringify({
                                ...item,
                                status: finalStatus,
                                duration_seconds: parseInt(duration),
                                ended_at: new Date().toISOString(),
                            }),
                            is_active: false, // Mark as processed
                        })
                        .eq("id", queueItemId);

                    await logToDb(`Call hangup processed. Queue item: ${queueItemId}, Duration: ${duration}s, Status: ${finalStatus}`);

                    // Process next item in queue for this company
                    await processNextQueueItem(supabase, item.company_id, supabaseUrl);
                }
            }

            return new Response("ok", { headers: corsHeaders });
        }

        // ── ANSWER EVENT (call connects) ───────────────────────────────────────
        if (!queueItemId) {
            return new Response(xmlError("Missing queue_item_id parameter"), {
                headers: { "Content-Type": "text/xml" },
            });
        }

        // Fetch queue item
        const { data: queueRow } = await supabase
            .from("integration_api_keys")
            .select("api_key, company_id")
            .eq("id", queueItemId)
            .single();

        if (!queueRow) {
            return new Response(xmlError("Queue item not found"), {
                headers: { "Content-Type": "text/xml" },
            });
        }

        const queueItem = typeof queueRow.api_key === "string" ? JSON.parse(queueRow.api_key) : queueRow.api_key;
        const companyId = queueRow.company_id || queueItem.company_id;
        const agentId = queueItem.agent_id;

        // Fetch agent configuration for timeouts
        let agentConfig: any = {};
        if (agentId) {
            const { data: agentRow } = await supabase
                .from("integration_api_keys")
                .select("api_key")
                .eq("id", agentId)
                .maybeSingle();

            if (agentRow) {
                agentConfig = typeof agentRow.api_key === "string" ? JSON.parse(agentRow.api_key) : agentRow.api_key;
            }
        }

        const maxDurationMins = parseInt(agentConfig.max_duration_minutes || "10");
        const maxDurationSecs = maxDurationMins * 60;

        // WebSocket URL to the exact same function (ai-caller) with ONLY queue_item_id
        // This avoids any ampersands in the XML which prevents XML parsing issues
        const bridgeWsUrl = `${supabaseUrl.replace("https://", "wss://")}/functions/v1/ai-caller?queue_item_id=${encodeURIComponent(queueItemId)}`;

        await logToDb("Returning Stream XML to Vobiz", { bridgeWsUrl });

        const vobizXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream bidirectional="true" streamTimeout="${maxDurationSecs}" contentType="audio/x-mulaw;rate=8000" maxDuration="${maxDurationSecs}" keepCallAlive="true">
        ${bridgeWsUrl}
    </Stream>
</Response>`;

        return new Response(vobizXml, {
            headers: { "Content-Type": "text/xml", ...corsHeaders },
        });

    } catch (err: any) {
        console.error("ai-caller HTTP error:", err);
        return new Response(xmlError("AI agent temporarily unavailable. Please try again."), {
            headers: { "Content-Type": "text/xml" },
        });
    }
});

// ── XML Error Helpers ──────────────────────────────────────────────────────────
function xmlError(message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Speak>${message}</Speak>
    <Hangup/>
</Response>`;
}

// ── Process next queued call when current call ends ───────────────────────────
async function processNextQueueItem(supabase: any, companyId: string, supabaseUrl: string) {
    if (!companyId) return;

    const { data: pending } = await supabase
        .from("integration_api_keys")
        .select("id, api_key")
        .eq("company_id", companyId)
        .eq("service_name", "ai_call_queue")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1);

    if (!pending || pending.length === 0) return;

    const nextRow = pending[0];
    const item = typeof nextRow.api_key === "string" ? JSON.parse(nextRow.api_key) : nextRow.api_key;

    if (item.status !== "pending") return;

    // Fetch Vobiz config
    const { data: vobizRow } = await supabase
        .from("integration_api_keys")
        .select("api_key")
        .eq("company_id", companyId)
        .eq("service_name", "vobiz")
        .eq("is_active", true)
        .maybeSingle();

    if (!vobizRow) return;
    const vobizConfig = typeof vobizRow.api_key === "string" ? JSON.parse(vobizRow.api_key) : vobizRow.api_key;

    // Fetch agent config
    const { data: agentRow } = await supabase
        .from("integration_api_keys")
        .select("api_key")
        .eq("id", item.agent_id)
        .maybeSingle();

    if (!agentRow) return;
    const agentConfig = typeof agentRow.api_key === "string" ? JSON.parse(agentRow.api_key) : agentRow.api_key;

    const answerUrl = `${supabaseUrl}/functions/v1/ai-caller?queue_item_id=${encodeURIComponent(nextRow.id)}`;
    const hangupUrl = `${supabaseUrl}/functions/v1/ai-caller?action=hangup&queue_item_id=${encodeURIComponent(nextRow.id)}`;

    try {
        const response = await fetch(
            `https://api.vobiz.ai/api/v1/Account/${vobizConfig.auth_id}/Call/`,
            {
                method: "POST",
                headers: {
                    "X-Auth-ID": vobizConfig.auth_id,
                    "X-Auth-Token": vobizConfig.auth_token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: agentConfig.phone_number || vobizConfig.phone_number,
                    to: item.lead_phone,
                    answer_url: answerUrl,
                    hangup_url: hangupUrl,
                }),
            }
        );

        const result = await response.json();

        await supabase
            .from("integration_api_keys")
            .update({
                api_key: JSON.stringify({
                    ...item,
                    status: response.ok ? "calling" : "failed",
                    call_id: result?.request_uuid || result?.call_uuid,
                    error: response.ok ? undefined : (result?.error || `HTTP ${response.status}`),
                }),
            })
            .eq("id", nextRow.id);

    } catch (err: any) {
        await supabase
            .from("integration_api_keys")
            .update({
                api_key: JSON.stringify({ ...item, status: "failed", error: err.message }),
                is_active: false,
            })
            .eq("id", nextRow.id);
    }
}
