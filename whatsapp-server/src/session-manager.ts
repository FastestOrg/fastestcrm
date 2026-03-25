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
} from '@whiskeysockets/baileys';
import { supabase } from './supabase';
import * as QRCode from 'qrcode';
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
    private readonly MAX_RETRIES = 3;

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
            const stored = account.auth_creds as any;
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

            await supabase
                .from('whatsapp_accounts')
                .update({
                    auth_creds: { creds, keys },
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
