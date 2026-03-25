/**
 * index.ts — WhatsApp Campaign Server
 *
 * Express server that manages Baileys sessions and executes campaigns.
 * This must run as a separate long-running process (VPS/Railway/Render).
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sessionManager } from './session-manager';
import { startCampaign, pauseCampaign, resumeCampaign, getCampaignProgress } from './campaign-worker';
import { supabase } from './supabase';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const API_KEY = process.env.WHATSAPP_SERVER_API_KEY || '';

app.use(cors());
app.use(express.json());

// ─── Auth Middleware ──────────────────────────────────────────────────────────

function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
    const key = req.headers['x-api-key'] as string;
    if (!API_KEY || key !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

app.use('/api', authenticate);

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
    res.json({ ok: true, sessions: sessionManager.getSessions().size });
});

// ─── Session Routes ──────────────────────────────────────────────────────────

/**
 * POST /api/sessions/create
 * Body: { sessionId, companyId }
 * Creates a new Baileys session, returns QR as base64 data URL.
 */
app.post('/api/sessions/create', async (req, res) => {
    try {
        const { sessionId, companyId } = req.body;
        if (!sessionId || !companyId) {
            return res.status(400).json({ error: 'sessionId and companyId are required' });
        }

        // Upsert the account record in Supabase
        await supabase.from('whatsapp_accounts').upsert(
            {
                session_id: sessionId,
                company_id: companyId,
                status: 'connecting',
            },
            { onConflict: 'session_id' }
        );

        const qr = await sessionManager.createSession(sessionId, companyId);

        // Wait a bit for QR generation if not immediately available
        if (!qr) {
            const session = sessionManager.getSession(sessionId);
            if (session?.status === 'connected') {
                return res.json({ status: 'connected', qr: null });
            }
            // Wait up to 10 seconds for QR
            for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 500));
                const s = sessionManager.getSession(sessionId);
                if (s?.qrCode) {
                    return res.json({ status: 'connecting', qr: s.qrCode });
                }
                if (s?.status === 'connected') {
                    return res.json({ status: 'connected', qr: null });
                }
            }
        }

        return res.json({ status: 'connecting', qr });
    } catch (err: any) {
        console.error('Session create error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/sessions/:sessionId/qr
 * Returns current QR code or connection status.
 */
app.get('/api/sessions/:sessionId/qr', (req, res) => {
    const session = sessionManager.getSession(req.params.sessionId);
    if (!session) {
        return res.json({ status: 'not_found', qr: null });
    }
    res.json({ status: session.status, qr: session.qrCode });
});

/**
 * GET /api/sessions/:sessionId/status
 */
app.get('/api/sessions/:sessionId/status', (req, res) => {
    const session = sessionManager.getSession(req.params.sessionId);
    if (!session) {
        return res.json({ status: 'not_found' });
    }
    res.json({ status: session.status });
});

/**
 * POST /api/sessions/:sessionId/disconnect
 */
app.post('/api/sessions/:sessionId/disconnect', async (req, res) => {
    await sessionManager.disconnectSession(req.params.sessionId);
    res.json({ ok: true });
});

// ─── Campaign Routes ─────────────────────────────────────────────────────────

/**
 * POST /api/campaigns/send
 * Body: { campaignId }
 * Starts sending a campaign.
 */
app.post('/api/campaigns/send', async (req, res) => {
    try {
        const { campaignId } = req.body;
        if (!campaignId) {
            return res.status(400).json({ error: 'campaignId is required' });
        }

        const result = await startCampaign(campaignId);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({ ok: true, message: 'Campaign started' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/campaigns/:campaignId/status
 * Returns campaign progress stats.
 */
app.get('/api/campaigns/:campaignId/status', async (req, res) => {
    const progress = await getCampaignProgress(req.params.campaignId);
    res.json(progress);
});

/**
 * POST /api/campaigns/:campaignId/pause
 */
app.post('/api/campaigns/:campaignId/pause', (req, res) => {
    const result = pauseCampaign(req.params.campaignId);
    res.json({ ok: result });
});

/**
 * POST /api/campaigns/:campaignId/resume
 */
app.post('/api/campaigns/:campaignId/resume', (req, res) => {
    const result = resumeCampaign(req.params.campaignId);
    res.json({ ok: result });
});

// ─── AI Routes ───────────────────────────────────────────────────────────────

/**
 * POST /api/ai/improvise-prompt
 * Body: { companyId, currentPrompt, goal }
 */
app.post('/api/ai/improvise-prompt', async (req, res) => {
    try {
        const { companyId, currentPrompt, goal } = req.body;
        if (!companyId || !currentPrompt) {
            return res.status(400).json({ error: 'companyId and currentPrompt are required' });
        }

        // Find the Gemini API key for this company
        const { data: profiles } = await supabase.from('profiles').select('id').eq('company_id', companyId);
        const userIds = profiles?.map(p => p.id) || [];
        
        if (userIds.length === 0) return res.status(404).json({ error: 'Company profiles not found' });

        const { data: integration } = await supabase
            .from('integration_api_keys')
            .select('api_key')
            .in('user_id', userIds)
            .eq('service_name', 'gemini')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        if (!integration?.api_key) {
            return res.status(400).json({ error: 'Gemini integration not found or inactive.' });
        }

        const ai = new GoogleGenAI({ apiKey: integration.api_key });
        const systemPrompt = `You are an expert AI sales director. Your job is to improve the following basic instructions into a detailed, professional AI agent prompt.
Goal: ${goal || 'Assist the customer'}
Current Basic Instructions: ${currentPrompt}

Rewrite the instructions to be extremely clear, conversion-focused, and suitable to act as the exact system prompt for a WhatsApp auto-responder AI. Define tone, guardrails, and structure. Return ONLY the final rewritten prompt text, without any markdown formatting wrappers or conversational filler.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: systemPrompt,
        });

        res.json({ improvedPrompt: response.text });
    } catch (err: any) {
        console.error('AI Improvise error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── Start Server ────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
    console.log(`WhatsApp Server running on port ${PORT}`);

    // Restore existing sessions on startup
    try {
        await sessionManager.restoreAllSessions();
        console.log('Session restore complete.');
    } catch (err) {
        console.error('Session restore failed:', err);
    }
});
