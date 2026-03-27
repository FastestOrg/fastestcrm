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
        const { sessionId, companyId, userId } = req.body;
        if (!sessionId || !companyId) {
            return res.status(400).json({ error: 'sessionId and companyId are required' });
        }

        const payload: any = {
            session_id: sessionId,
            company_id: companyId,
            status: 'connecting',
        };
        
        if (userId) {
            payload.user_id = userId;
        }

        // Upsert the account record in Supabase
        await supabase.from('whatsapp_accounts').upsert(
            payload,
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
app.post('/api/campaigns/:campaignId/pause', async (req, res) => {
    const result = await pauseCampaign(req.params.campaignId);
    res.json({ ok: result });
});

/**
 * POST /api/campaigns/:campaignId/resume
 */
app.post('/api/campaigns/:campaignId/resume', async (req, res) => {
    const result = await resumeCampaign(req.params.campaignId);
    res.json({ ok: result });
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

    // Poll for scheduled campaigns every 60 seconds
    setInterval(async () => {
        try {
            const now = new Date().toISOString();
            const { data: scheduledCampaigns, error } = await supabase
                .from('whatsapp_campaigns')
                .select('id')
                .eq('status', 'scheduled')
                .lte('scheduled_at', now);
                
            if (error) {
                console.error('Error polling scheduled campaigns:', error);
                return;
            }
            
            for (const camp of scheduledCampaigns || []) {
                console.log(`Auto-starting scheduled campaign ${camp.id}`);
                await startCampaign(camp.id);
            }
        } catch (err) {
            console.error('Polling scheduled campaigns exception:', err);
        }
    }, 60000);
});
