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

    // Helper to resolve queue_item_id dynamically
    const resolveQueueItemId = async (): Promise<string | null> => {
        let qid = url.searchParams.get("queue_item_id");
        if (qid) return qid;

        let incomingCallId = url.searchParams.get("call_id") || 
                             url.searchParams.get("call_sid") || 
                             url.searchParams.get("request_uuid") ||
                             url.searchParams.get("call_uuid");

        let leadPhone = url.searchParams.get("to") || 
                        url.searchParams.get("toNumber") || 
                        url.searchParams.get("customer_number") || 
                        url.searchParams.get("destination_number");

        if (req.method === "POST") {
            try {
                const bodyText = await req.clone().text();
                if (bodyText) {
                    try {
                        const parsedBody = JSON.parse(bodyText);
                        incomingCallId = incomingCallId || 
                                         parsedBody.call_id || 
                                         parsedBody.call_sid || 
                                         parsedBody.request_uuid ||
                                         parsedBody.call_uuid;
                        leadPhone = leadPhone || 
                                    parsedBody.to || 
                                    parsedBody.toNumber || 
                                    parsedBody.customer_number || 
                                    parsedBody.destination_number;
                        qid = qid || parsedBody.queue_item_id;
                    } catch (_) {
                        const params = new URLSearchParams(bodyText);
                        incomingCallId = incomingCallId || 
                                         params.get("call_id") || 
                                         params.get("call_sid") || 
                                         params.get("request_uuid") ||
                                         params.get("call_uuid");
                        leadPhone = leadPhone || 
                                    params.get("to") || 
                                    params.get("toNumber") || 
                                    params.get("customer_number") || 
                                    params.get("destination_number");
                        qid = qid || params.get("queue_item_id");
                    }
                }
            } catch (err) {
                console.error("resolveQueueItemId body parse error:", err);
            }
        }

        if (qid) return qid;

        if (incomingCallId) {
            const { data: logByCallId } = await supabase
                .from("ai_caller_logs")
                .select("id")
                .eq("call_id", incomingCallId)
                .maybeSingle();
            if (logByCallId) {
                await logToDb(`Resolved queue_item_id ${logByCallId.id} via incomingCallId: ${incomingCallId}`);
                return logByCallId.id;
            }
        }

        if (leadPhone) {
            const cleanPhone = leadPhone.replace(/\D/g, "");
            if (cleanPhone) {
                const { data: activeLogs } = await supabase
                    .from("ai_caller_logs")
                    .select("id, lead_phone")
                    .or("status.eq.calling,status.eq.pending")
                    .order("created_at", { ascending: false });

                if (activeLogs && activeLogs.length > 0) {
                    const matchedLog = activeLogs.find((log: any) => {
                        const logPhoneClean = (log.lead_phone || "").replace(/\D/g, "");
                        return logPhoneClean === cleanPhone || 
                               logPhoneClean.endsWith(cleanPhone) || 
                               cleanPhone.endsWith(logPhoneClean);
                    });
                    if (matchedLog) {
                        await logToDb(`Resolved queue_item_id ${matchedLog.id} via phone match: ${leadPhone}`);
                        return matchedLog.id;
                    }
                    await logToDb(`No exact phone match. Using latest active call log: ${activeLogs[0].id}`);
                    return activeLogs[0].id;
                }
            }
        }

        // Ultimate fallback
        const { data: lastCallingLog } = await supabase
            .from("ai_caller_logs")
            .select("id")
            .eq("status", "calling")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastCallingLog) {
            await logToDb(`Resolved queue_item_id ${lastCallingLog.id} via latest 'calling' status fallback`);
            return lastCallingLog.id;
        }

        return null;
    };

    const queueItemId = await resolveQueueItemId();

    // ── CASE 0: GET RECORDING (Proxy to Vobiz with credentials) ───────────────
    if (action === "get_recording") {
        const logId = url.searchParams.get("log_id");
        const token = url.searchParams.get("token");

        if (!logId || !token) {
            return new Response(JSON.stringify({ error: "Missing log_id or token" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // Authenticate using the provided token (checks RLS)
        const clientSupabase = createClient(supabaseUrl, supabaseServiceKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        });

        // Fetch the log row
        const { data: logRow, error: logErr } = await clientSupabase
            .from("ai_caller_logs")
            .select("company_id, call_recording")
            .eq("id", logId)
            .maybeSingle();

        if (logErr || !logRow || !logRow.call_recording) {
            return new Response(JSON.stringify({ error: "Unauthorized or recording not found" }), {
                status: 403,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        const companyId = logRow.company_id;
        const recordingUrl = logRow.call_recording;

        // Fetch telephony credentials (try Vobiz first, then Smartflo)
        let authHeaders: Record<string, string> = {};
        const { data: vobizRow } = await supabase
            .from("integration_api_keys")
            .select("api_key")
            .eq("company_id", companyId)
            .eq("service_name", "vobiz")
            .eq("is_active", true)
            .maybeSingle();

        if (vobizRow) {
            const vobizConfig = typeof vobizRow.api_key === "string" ? JSON.parse(vobizRow.api_key) : vobizRow.api_key;
            authHeaders = {
                "X-Auth-ID": vobizConfig.auth_id,
                "X-Auth-Token": vobizConfig.auth_token,
            };
        } else {
            // Try Smartflo credentials
            const { data: smartfloRow } = await supabase
                .from("integration_api_keys")
                .select("api_key")
                .eq("company_id", companyId)
                .eq("service_name", "tata_smartflo")
                .eq("is_active", true)
                .maybeSingle();

            if (smartfloRow) {
                const smartfloConfig = typeof smartfloRow.api_key === "string" ? JSON.parse(smartfloRow.api_key) : smartfloRow.api_key;
                authHeaders = {
                    "Authorization": `Bearer ${smartfloConfig.auth_token}`,
                };
            }
        }

        if (Object.keys(authHeaders).length === 0) {
            return new Response(JSON.stringify({ error: "Telephony credentials not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // Fetch recording with credentials
        const providerResponse = await fetch(recordingUrl, {
            headers: authHeaders
        });

        if (!providerResponse.ok) {
            const errText = await providerResponse.text();
            return new Response(JSON.stringify({ error: `Failed to fetch recording: ${providerResponse.status}`, details: errText }), {
                status: providerResponse.status,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        const responseHeaders = new Headers(corsHeaders);
        responseHeaders.set("Content-Type", providerResponse.headers.get("Content-Type") || "audio/mpeg");
        const contentLength = providerResponse.headers.get("Content-Length");
        if (contentLength) {
            responseHeaders.set("Content-Length", contentLength);
        }

        return new Response(providerResponse.body, {
            headers: responseHeaders,
            status: 200
        });
    }

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
            let companyId = "";
            let agentId = "";
            let callId = "";

            await logToDb("WebSocket connection received", { queueItemId, url: req.url });

            // Helper to update DB queue item status
            const updateQueueStatus = async (status: string, error?: string) => {
                try {
                    const updates: any = {
                        status,
                        ended_at: new Date().toISOString(),
                    };
                    if (error) {
                        updates.error = error;
                    }
                    await supabase
                        .from("ai_caller_logs")
                        .update(updates)
                        .eq("id", queueItemId);
                    console.log(`[AI-Caller] Updated call log item ${queueItemId} to status: ${status}, error: ${error || 'none'}`);
                    await logToDb(`Call log status updated: ${status}`, { error });
                } catch (dbErr: any) {
                    console.error("[AI-Caller] Failed to update call log status in DB:", dbErr);
                    await logToDb("Failed to update call log status in DB", dbErr.message);
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
                // 1. Fetch call log details
                const { data: logRow, error: logErr } = await supabase
                    .from("ai_caller_logs")
                    .select("company_id, agent_id, call_id")
                    .eq("id", queueItemId)
                    .maybeSingle();

                if (logErr || !logRow) {
                    throw new Error(`Call log item not found or error: ${logErr?.message || "Not found"}`);
                }

                companyId = logRow.company_id;
                agentId = logRow.agent_id;
                callId = logRow.call_id || "";

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
                        
                        const targetCallUuid = callId || streamId;
                        if (targetCallUuid) {
                            startVobizRecording(supabase, companyId, targetCallUuid, queueItemId, supabaseUrl);
                        }
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
            
            // Log raw hangup payload to debug_logs table
            await logToDb(`Call hangup payload received. Body: ${body}`);

            let recordingUrl = "";
            let duration = "0";

            try {
                // Try JSON first
                const json = JSON.parse(body);
                recordingUrl = json.recording_url || json.record_url || json.RecordingUrl || json.recording || json.Recording || json.recordingUrl || json.RecordingUrlText || "";
                duration = String(json.duration || json.Duration || json.recording_duration || json.recording_duration_seconds || "0");
            } catch (_) {
                // Fallback to URLSearchParams
                const params = new URLSearchParams(body);
                recordingUrl = params.get("recording_url") || params.get("record_url") || params.get("RecordingUrl") || params.get("recording") || params.get("Recording") || params.get("recordingUrl") || params.get("RecordingUrlText") || "";
                duration = params.get("duration") || params.get("Duration") || params.get("recording_duration") || "";

                // Check for nested JSON response from Vobiz recording webhook
                const responseParam = params.get("response");
                if (responseParam) {
                    try {
                        const responseJson = JSON.parse(responseParam);
                        if (!recordingUrl) {
                            recordingUrl = responseJson.recording_url || responseJson.record_url || responseJson.RecordingUrl || responseJson.recording || responseJson.Recording || "";
                        }
                        if (!duration || duration === "0") {
                            duration = String(responseJson.duration || responseJson.Duration || responseJson.recording_duration || responseJson.recording_duration_seconds || "0");
                        }
                    } catch (_) {
                        // ignore nested parse failure
                    }
                }
            }

            if (!recordingUrl) {
                recordingUrl = url.searchParams.get("recording_url") || url.searchParams.get("record_url") || url.searchParams.get("RecordingUrl") || "";
            }

            if (queueItemId) {
                const { data: logRow } = await supabase
                    .from("ai_caller_logs")
                    .select("status, company_id, duration_seconds")
                    .eq("id", queueItemId)
                    .maybeSingle();

                if (logRow) {
                    const finalStatus = logRow.status === "failed" ? "failed" : "completed";
                    
                    const updates: any = {
                        status: finalStatus,
                        ended_at: new Date().toISOString(),
                    };

                    const parsedDuration = parseInt(duration);
                    if (parsedDuration > 0) {
                        updates.duration_seconds = parsedDuration;
                    }

                    if (recordingUrl) {
                        updates.call_recording = recordingUrl;
                    }

                    await supabase
                        .from("ai_caller_logs")
                        .update(updates)
                        .eq("id", queueItemId);

                    await logToDb(`Call hangup processed. Call ID: ${queueItemId}, Duration: ${duration}s, Status: ${finalStatus}, Recording: ${recordingUrl || 'none'}`);

                    // Process next item in queue for this company
                    await processNextQueueItem(supabase, logRow.company_id, supabaseUrl);
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

        // Fetch call log details
        const { data: logRow } = await supabase
            .from("ai_caller_logs")
            .select("company_id, agent_id, call_id")
            .eq("id", queueItemId)
            .maybeSingle();

        if (!logRow) {
            return new Response(xmlError("Call log item not found"), {
                headers: { "Content-Type": "text/xml" },
            });
        }

        const companyId = logRow.company_id;
        const agentId = logRow.agent_id;
        const callUuid = logRow.call_id;

        if (callUuid) {
            startVobizRecording(supabase, companyId, callUuid, queueItemId, supabaseUrl);
        }

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

        const isTata = agentConfig.telephony_provider === "tata_smartflo";

        if (isTata) {
            await logToDb("Returning Stream JSON to Tata Smartflo", { bridgeWsUrl });
            return new Response(JSON.stringify({
                success: true,
                wss_url: bridgeWsUrl
            }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        await logToDb("Returning Stream XML to telephony provider", { bridgeWsUrl });

        const streamXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream bidirectional="true" streamTimeout="${maxDurationSecs}" contentType="audio/x-mulaw;rate=8000" maxDuration="${maxDurationSecs}" keepCallAlive="true">
        ${bridgeWsUrl}
    </Stream>
</Response>`;

        return new Response(streamXml, {
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

// ── Process next queued call when current call ends ─────────────────────────
async function processNextQueueItem(supabase: any, companyId: string, supabaseUrl: string) {
    if (!companyId) return;

    const { data: pending } = await supabase
        .from("ai_caller_logs")
        .select("id, lead_phone, agent_id, status")
        .eq("company_id", companyId)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1);

    if (!pending || pending.length === 0) return;

    const nextRow = pending[0];

    // Fetch agent config to determine telephony provider
    const { data: agentRow } = await supabase
        .from("integration_api_keys")
        .select("api_key")
        .eq("id", nextRow.agent_id)
        .maybeSingle();

    if (!agentRow) return;
    const agentConfig = typeof agentRow.api_key === "string" ? JSON.parse(agentRow.api_key) : agentRow.api_key;
    const telephonyProvider = agentConfig.telephony_provider || "vobiz";

    // Fetch telephony config based on provider
    let telephonyConfig: any = null;
    const serviceName = telephonyProvider === "tata_smartflo" ? "tata_smartflo" : "vobiz";
    const { data: telephonyRow } = await supabase
        .from("integration_api_keys")
        .select("api_key")
        .eq("company_id", companyId)
        .eq("service_name", serviceName)
        .eq("is_active", true)
        .maybeSingle();

    if (!telephonyRow) return;
    telephonyConfig = typeof telephonyRow.api_key === "string" ? JSON.parse(telephonyRow.api_key) : telephonyRow.api_key;

    const answerUrl = `${supabaseUrl}/functions/v1/ai-caller?queue_item_id=${encodeURIComponent(nextRow.id)}`;
    const hangupUrl = `${supabaseUrl}/functions/v1/ai-caller?action=hangup&queue_item_id=${encodeURIComponent(nextRow.id)}`;

    try {
        let response: Response;

        if (telephonyProvider === "tata_smartflo") {
            // Use click_to_call_support — calls the customer first
            const cleanTo = (nextRow.lead_phone || "").replace(/[^0-9]/g, "");
            const cleanFrom = (agentConfig.phone_number || telephonyConfig.phone_number || "").replace(/[^0-9]/g, "");
            const c2cApiKey = telephonyConfig.c2c_api_key || telephonyConfig.auth_token;
            const requestBody: any = {
                api_key: c2cApiKey,
                customer_number: cleanTo,
                async: 1,
                get_call_id: 1,
            };
            if (cleanFrom) requestBody.caller_id = cleanFrom;

            response = await fetch(
                `https://api-smartflo.tatateleservices.com/v1/click_to_call_support`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${telephonyConfig.auth_token}`,
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    body: JSON.stringify(requestBody),
                }
            );
        } else {
            response = await fetch(
                `https://api.vobiz.ai/api/v1/Account/${telephonyConfig.auth_id}/Call/`,
                {
                    method: "POST",
                    headers: {
                        "X-Auth-ID": telephonyConfig.auth_id,
                        "X-Auth-Token": telephonyConfig.auth_token,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        from: agentConfig.phone_number || telephonyConfig.phone_number,
                        to: nextRow.lead_phone,
                        answer_url: answerUrl,
                        hangup_url: hangupUrl,
                    }),
                }
            );
        }

        const result = await response.json();

        await supabase
            .from("ai_caller_logs")
            .update({
                status: response.ok ? "calling" : "failed",
                call_id: result?.request_uuid || result?.call_uuid || result?.call_sid,
                error: response.ok ? null : (result?.error || `HTTP ${response.status}`),
            })
            .eq("id", nextRow.id);

    } catch (err: any) {
        await supabase
            .from("ai_caller_logs")
            .update({
                status: "failed",
                error: err.message,
            })
            .eq("id", nextRow.id);
    }
}

// ── Start call recording (provider-aware) ───────────────────────────────────
async function startVobizRecording(
    supabase: any,
    companyId: string,
    callUuid: string,
    queueItemId: string,
    supabaseUrl: string
) {
    if (!companyId || !callUuid) return;

    // Determine which provider is being used by checking the agent config for this call
    const { data: logRow } = await supabase
        .from("ai_caller_logs")
        .select("agent_id")
        .eq("id", queueItemId)
        .maybeSingle();

    let telephonyProvider = "vobiz";
    if (logRow?.agent_id) {
        const { data: agentRow } = await supabase
            .from("integration_api_keys")
            .select("api_key")
            .eq("id", logRow.agent_id)
            .maybeSingle();
        if (agentRow) {
            const agentConfig = typeof agentRow.api_key === "string" ? JSON.parse(agentRow.api_key) : agentRow.api_key;
            telephonyProvider = agentConfig.telephony_provider || "vobiz";
        }
    }

    try {
        const callbackUrl = `${supabaseUrl}/functions/v1/ai-caller?action=hangup&queue_item_id=${encodeURIComponent(queueItemId)}`;

        if (telephonyProvider === "tata_smartflo") {
            // Tata Smartflo recording
            const { data: smartfloRow } = await supabase
                .from("integration_api_keys")
                .select("api_key")
                .eq("company_id", companyId)
                .eq("service_name", "tata_smartflo")
                .eq("is_active", true)
                .maybeSingle();

            if (!smartfloRow) {
                console.error("[AI-Caller] Smartflo integration credentials not found for recording");
                return;
            }

            const smartfloConfig = typeof smartfloRow.api_key === "string" ? JSON.parse(smartfloRow.api_key) : smartfloRow.api_key;
            const smartfloToken = smartfloConfig.auth_token || smartfloConfig.api_key;

            console.log(`[AI-Caller] Requesting Smartflo call recording for call ${callUuid}...`);

            const response = await fetch(
                `https://api-smartflo.tatateleservices.com/v1/call/${callUuid}/recording`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${smartfloToken}`,
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    body: JSON.stringify({
                        time_limit: 3600,
                        file_format: "mp3",
                        callback_url: callbackUrl,
                    })
                }
            );

            const result = await response.json();
            console.log(`[AI-Caller] Smartflo recording response:`, result);
        } else {
            // Vobiz recording (original logic)
            const { data: vobizRow } = await supabase
                .from("integration_api_keys")
                .select("api_key")
                .eq("company_id", companyId)
                .eq("service_name", "vobiz")
                .eq("is_active", true)
                .maybeSingle();

            if (!vobizRow) {
                console.error("[AI-Caller] Vobiz integration credentials not found for recording");
                return;
            }

            const vobizConfig = typeof vobizRow.api_key === "string" ? JSON.parse(vobizRow.api_key) : vobizRow.api_key;

            console.log(`[AI-Caller] Requesting Vobiz call recording for call ${callUuid}...`);

            const response = await fetch(
                `https://api.vobiz.ai/api/v1/Account/${vobizConfig.auth_id}/Call/${callUuid}/Record/`,
                {
                    method: "POST",
                    headers: {
                        "X-Auth-ID": vobizConfig.auth_id,
                        "X-Auth-Token": vobizConfig.auth_token,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        time_limit: 3600,
                        file_format: "mp3",
                        callback_url: callbackUrl,
                    })
                }
            );

            const result = await response.json();
            console.log(`[AI-Caller] Vobiz recording response:`, result);
        }
    } catch (err: any) {
        console.error("[AI-Caller] Failed to trigger call recording:", err);
    }
}
