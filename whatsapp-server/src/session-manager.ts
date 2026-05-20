/**
 * session-manager.ts
 *
 * Manages Baileys WhatsApp sessions:
 * - Creates new sessions and generates QR codes
 * - Saves/restores auth credentials to/from Supabase
 * - Reconnects sessions on server restart
 * - Tracks session status
 */

import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    WASocket,
    ConnectionState,
    AuthenticationCreds,
    SignalDataTypeMap,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    proto,
    Browsers,
    BufferJSON
} from '@whiskeysockets/baileys';
import { supabase } from './supabase';
import * as QRCode from 'qrcode';
import { GoogleGenAI } from '@google/genai';
import { EventEmitter } from 'events';
import { Boom } from '@hapi/boom';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionInfo {
    socket: WASocket;
    sessionId: string;
    companyId: string;
    status: 'connecting' | 'connected' | 'disconnected';
    qrCode: string | null;
    retryCount: number;
}

// ─── Session Manager ─────────────────────────────────────────────────────────

class SessionManager extends EventEmitter {
    private sessions: Map<string, SessionInfo> = new Map();
    private aiDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private companyApiKeysCache: Map<string, { apiKey: string | null; expiresAt: number }> = new Map();
    private readonly MAX_RETRIES = 3;
    private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    /**
     * Get all active sessions.
     */
    getSessions(): Map<string, SessionInfo> {
        return this.sessions;
    }

    /**
     * Get a specific session by ID.
     */
    getSession(sessionId: string): SessionInfo | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Create a Baileys auth state that persists to Supabase.
     */
    private async createSupabaseAuthState(sessionId: string) {
        // Load existing creds from Supabase
        const { data: account } = await supabase
            .from('whatsapp_accounts')
            .select('auth_creds')
            .eq('session_id', sessionId)
            .maybeSingle();

        let creds: AuthenticationCreds | undefined;
        let keys: Record<string, any> = {};

        if (account?.auth_creds) {
            // Re-hydrate Buffer objects correctly
            const stored = JSON.parse(JSON.stringify(account.auth_creds), BufferJSON.reviver);
            creds = stored.creds;
            keys = stored.keys || {};
        }

        // If no stored creds, generate fresh ones via Baileys helper
        if (!creds) {
            const { state } = await useMultiFileAuthState(`/tmp/wa-temp-${sessionId}`);
            creds = state.creds;
        }

        const saveCreds = async () => {
            const currentSession = this.sessions.get(sessionId);
            if (!currentSession) return;

            // Serialize carefully with BufferJSON so binary keys are safely stored in JSONB
            const serializedCreds = JSON.parse(JSON.stringify({ creds, keys }, BufferJSON.replacer));

            await supabase
                .from('whatsapp_accounts')
                .update({
                    auth_creds: serializedCreds,
                })
                .eq('session_id', sessionId);
        };

        const state = {
            creds,
            keys: {
                get: async (type: string, ids: string[]) => {
                    const result: Record<string, any> = {};
                    for (const id of ids) {
                        const key = `${type}-${id}`;
                        if (keys[key]) {
                            result[id] = keys[key];
                        }
                    }
                    return result;
                },
                set: async (data: Record<string, Record<string, any>>) => {
                    for (const [type, typeData] of Object.entries(data)) {
                        for (const [id, value] of Object.entries(typeData)) {
                            const key = `${type}-${id}`;
                            keys[key] = value;
                        }
                    }
                    await saveCreds();
                },
            },
        };

        return { state, saveCreds };
    }

    /**
     * Create a new session — generates QR code for scanning.
     */
    async createSession(sessionId: string, companyId: string): Promise<string | null> {
        // If session already exists, return its QR or status
        if (this.sessions.has(sessionId)) {
            const existing = this.sessions.get(sessionId)!;
            if (existing.status === 'connected') {
                return null; // Already connected
            }
            return existing.qrCode;
        }

        const { state, saveCreds } = await this.createSupabaseAuthState(sessionId);
        const { version } = await fetchLatestBaileysVersion();

        // Mock logger to satisfy ILogger interface expectations of Baileys
        const logger = {
            level: 'silent',
            child: () => logger,
            info: () => {},
            error: console.error,
            warn: console.warn,
            debug: () => {},
            trace: () => {},
            fatal: console.error
        } as any;

        const socket = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys as any, logger),
            },
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            markOnlineOnConnect: false,
            syncFullHistory: false,
            printQRInTerminal: false,
            generateHighQualityLinkPreview: false,
            defaultQueryTimeoutMs: undefined,
        });

        const sessionInfo: SessionInfo = {
            socket,
            sessionId,
            companyId,
            status: 'connecting',
            qrCode: null,
            retryCount: 0,
        };

        this.sessions.set(sessionId, sessionInfo);

        // ─── AI Responder / Incoming Message Handler ─────────────────────────
        socket.ev.on('messages.upsert', async (m) => {
            if (m.type !== 'notify') return;
            const msg = m.messages[0];
            if (!msg || msg.key.fromMe || !msg.message) return; // Ignore own messages or system events

            const remoteJid = msg.key.remoteJid;
            if (!remoteJid || remoteJid.includes('@g.us')) return; // Ignore groups for now
            const phone = remoteJid.split('@')[0];

            const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;
            if (!messageText) return; // Only process text

            try {
                // 1. Fetch account config
                const { data: account } = await supabase
                    .from('whatsapp_accounts')
                    .select('id, company_id, ai_enabled, ai_prompt, ai_knowledge_base, ai_goal, ai_response_delay_seconds, ai_max_replies_per_day')
                    .eq('session_id', sessionId)
                    .maybeSingle();

                if (!account) return;

                // 2. Log incoming message to CRM (always log immediately)
                await supabase.from('whatsapp_message_log').insert({
                    company_id: account.company_id,
                    account_id: account.id,
                    recipient_phone: phone,
                    message_body: messageText,
                    direction: 'inbound',
                    status: 'delivered'
                });

                if (!account.ai_enabled || !account.ai_prompt) return;

                console.log(`[AI Responder] Incoming message for session ${sessionId} from ${phone}. Queuing evaluation...`);

                // 3. Debounce / Batch Messages
                const debounceKey = `${sessionId}-${phone}`;
                if (this.aiDebounceTimers.has(debounceKey)) {
                    clearTimeout(this.aiDebounceTimers.get(debounceKey)!);
                }

                const delaySeconds = account.ai_response_delay_seconds ?? 90;
                const delayMs = delaySeconds * 1000;

                const timer = setTimeout(async () => {
                    this.aiDebounceTimers.delete(debounceKey);
                    
                    try {
                        // 4. Enforce Daily Cap
                        const todayStart = new Date();
                        todayStart.setHours(0,0,0,0);

                        const { count } = await supabase
                            .from('whatsapp_message_log')
                            .select('*', { count: 'exact', head: true })
                            .eq('account_id', account.id)
                            .eq('recipient_phone', phone)
                            .eq('direction', 'outbound')
                            .gte('sent_at', todayStart.toISOString());
                        
                        const maxReplies = account.ai_max_replies_per_day ?? 20;
                        if (count !== null && count >= maxReplies) {
                            console.log(`[AI Responder] Daily cap reached (${count}/${maxReplies}) for ${phone}`);
                            return; // Stop AI processing
                        }

                        // 5. Find Company API Key (with caching)
                        let apiKey: string | null = null;
                        const now = Date.now();
                        const cached = this.companyApiKeysCache.get(account.company_id);

                        if (cached && cached.expiresAt > now) {
                            apiKey = cached.apiKey;
                        } else {
                            const { data: profiles } = await supabase.from('profiles').select('id').eq('company_id', account.company_id);
                            const userIds = profiles?.map(p => p.id) || [];

                            if (userIds.length > 0) {
                                const { data: integration } = await supabase
                                    .from('integration_api_keys')
                                    .select('api_key')
                                    .in('user_id', userIds)
                                    .eq('service_name', 'gemini')
                                    .eq('is_active', true)
                                    .limit(1)
                                    .maybeSingle();

                                apiKey = integration?.api_key || null;
                            }

                            this.companyApiKeysCache.set(account.company_id, {
                                apiKey,
                                expiresAt: now + this.CACHE_TTL_MS
                            });
                        }

                        if (!apiKey) {
                            console.log(`[AI Responder] Skipping: No Gemini key for company ${account.company_id}`);
                            return;
                        }

                        // 6. Fetch recent chat history
                        const { data: historyLog } = await supabase
                            .from('whatsapp_message_log')
                            .select('message_body, direction')
                            .eq('company_id', account.company_id)
                            .eq('recipient_phone', phone)
                            .order('sent_at', { ascending: false })
                            .limit(8);

                        let historyContext = '';
                        if (historyLog && historyLog.length > 0) {
                            historyContext = historyLog
                                .reverse()
                                .map(log => `${log.direction === 'inbound' ? 'Customer' : 'Assistant'}: ${log.message_body}`)
                                .join('\n');
                        }

                        // 7. Generate AI Response
                        const ai = new GoogleGenAI({ apiKey });
                        const fullPrompt = `You are the official AI representative for this business on WhatsApp.
Goal: ${account.ai_goal}
Instructions: ${account.ai_prompt}

Knowledge Base (use this to answer questions):
${account.ai_knowledge_base || '(No knowledge base provided)'}

--- Chat History ---
${historyContext}

Reply naturally, conversationally, and concisely as you would in a WhatsApp chat. Do not include markdown or wrappers. Just write your response text.`;

                        const aiResponse = await ai.models.generateContent({
                            model: 'gemini-2.5-flash',
                            contents: fullPrompt,
                        });

                        const replyText = aiResponse.text;
                        if (!replyText) return;

                        // 8. Send message via Baileys and log it
                        await socket.sendMessage(remoteJid, { text: replyText });

                        await supabase.from('whatsapp_message_log').insert({
                            company_id: account.company_id,
                            account_id: account.id,
                            recipient_phone: phone,
                            message_body: replyText,
                            direction: 'outbound',
                            status: 'sent'
                        });

                    } catch (innerErr) {
                        console.error('[AI Responder Async] Error executing AI response:', innerErr);
                    }
                }, delayMs);

                this.aiDebounceTimers.set(debounceKey, timer);

            } catch (err) {
                console.error('[AI Responder Sync] Error processing incoming message loop:', err);
            }
        });

        // ── Connection updates ────────────────────────────────────────────

        socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                // Convert QR string to base64 data URL
                const qrDataUrl = await QRCode.toDataURL(qr);
                sessionInfo.qrCode = qrDataUrl;
                sessionInfo.status = 'connecting';

                await supabase
                    .from('whatsapp_accounts')
                    .update({ status: 'connecting' })
                    .eq('session_id', sessionId);

                this.emit('qr', { sessionId, qrCode: qrDataUrl });
            }

            if (connection === 'open') {
                sessionInfo.status = 'connected';
                sessionInfo.qrCode = null;
                sessionInfo.retryCount = 0;

                // Extract phone number and name from socket
                const phoneNumber = socket.user?.id?.split(':')[0] || '';
                const displayName = socket.user?.name || '';

                await supabase
                    .from('whatsapp_accounts')
                    .update({
                        status: 'connected',
                        phone_number: phoneNumber,
                        display_name: displayName,
                        last_connected_at: new Date().toISOString(),
                    })
                    .eq('session_id', sessionId);

                this.emit('connected', { sessionId, phoneNumber, displayName });
                console.log(`[Session ${sessionId}] Connected as ${phoneNumber}`);
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                sessionInfo.status = 'disconnected';

                if (shouldReconnect && sessionInfo.retryCount < this.MAX_RETRIES) {
                    sessionInfo.retryCount++;
                    console.log(`[Session ${sessionId}] Reconnecting (attempt ${sessionInfo.retryCount})...`);
                    setTimeout(() => {
                        this.sessions.delete(sessionId);
                        this.createSession(sessionId, companyId);
                    }, 3000 * sessionInfo.retryCount);
                } else {
                    console.log(`[Session ${sessionId}] Disconnected permanently.`);
                    await supabase
                        .from('whatsapp_accounts')
                        .update({ status: 'disconnected' })
                        .eq('session_id', sessionId);

                    this.sessions.delete(sessionId);
                    this.emit('disconnected', { sessionId });
                }
            }
        });

        // ── Save creds on update ──────────────────────────────────────────

        socket.ev.on('creds.update', saveCreds);

        return sessionInfo.qrCode;
    }

    /**
     * Send a single WhatsApp message via a specific session.
     */
    async sendMessage(
        sessionId: string,
        recipientPhone: string,
        message: string
    ): Promise<{ success: boolean; error?: string }> {
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'connected') {
            return { success: false, error: 'Session not connected' };
        }

        try {
            // Format phone number for WhatsApp (add @s.whatsapp.net)
            const jid = recipientPhone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

            await session.socket.sendMessage(jid, { text: message });
            return { success: true };
        } catch (error: any) {
            console.error(`[Session ${sessionId}] Send error:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Disconnect and remove a specific session.
     */
    async disconnectSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (session) {
            try {
                session.socket.end(undefined);
            } catch (e) {
                // Ignore disconnect errors
            }
            this.sessions.delete(sessionId);
        }

        await supabase
            .from('whatsapp_accounts')
            .update({ status: 'disconnected' })
            .eq('session_id', sessionId);
    }

    /**
     * Restore all sessions from Supabase on server start.
     */
    async restoreAllSessions(): Promise<void> {
        const { data: accounts, error } = await supabase
            .from('whatsapp_accounts')
            .select('session_id, company_id, auth_creds')
            .in('status', ['connected', 'connecting']);

        if (error) {
            console.error('Failed to load sessions:', error.message);
            return;
        }

        if (!accounts || accounts.length === 0) {
            console.log('No sessions to restore.');
            return;
        }

        console.log(`Restoring ${accounts.length} session(s)...`);

        for (const account of accounts) {
            if (account.auth_creds) {
                try {
                    await this.createSession(account.session_id, account.company_id);
                } catch (e: any) {
                    console.error(`Failed to restore session ${account.session_id}:`, e.message);
                }
            }
        }
    }
}

export const sessionManager = new SessionManager();
