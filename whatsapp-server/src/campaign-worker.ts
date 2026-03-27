/**
 * campaign-worker.ts
 *
 * Executes WhatsApp campaigns:
 * - Round-robin account rotation
 * - Random delays between messages
 * - Daily limit enforcement
 * - Spintax + CRM variable substitution
 * - Pause/Resume support
 */

import { sessionManager } from './session-manager';
import { resolveMessage } from './spintax';
import { supabase } from './supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CampaignJob {
    campaignId: string;
    companyId: string;
    accountIds: string[];
    delayMin: number;
    delayMax: number;
    isPaused: boolean;
    isCancelled: boolean;
}

// ─── Active Campaigns ────────────────────────────────────────────────────────

const activeCampaigns: Map<string, CampaignJob> = new Map();

/**
 * Sleep for a random duration between min and max seconds.
 */
function randomDelay(minSeconds: number, maxSeconds: number): Promise<void> {
    const ms = (Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds) * 1000;
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Pick the next account to send from (round-robin with daily limit check).
 */
async function pickAccount(
    accountIds: string[],
    currentIndex: number
): Promise<{ accountId: string; sessionId: string; nextIndex: number } | null> {
    for (let i = 0; i < accountIds.length; i++) {
        const idx = (currentIndex + i) % accountIds.length;
        const accountId = accountIds[idx];

        // Check daily limit
        const { data: account } = await supabase
            .from('whatsapp_accounts')
            .select('session_id, daily_limit, messages_sent_today, status')
            .eq('id', accountId)
            .maybeSingle();

        if (
            account &&
            account.status === 'connected' &&
            account.messages_sent_today < account.daily_limit
        ) {
            // Verify the session is actually connected in memory
            const session = sessionManager.getSession(account.session_id);
            if (session && session.status === 'connected') {
                return {
                    accountId,
                    sessionId: account.session_id,
                    nextIndex: (idx + 1) % accountIds.length,
                };
            }
        }
    }
    return null; // All accounts exhausted or disconnected
}

/**
 * Start executing a campaign.
 */
export async function startCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
    // Load campaign
    const { data: campaign, error } = await supabase
        .from('whatsapp_campaigns')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle();

    if (error || !campaign) {
        return { success: false, error: error?.message || 'Campaign not found' };
    }

    if (campaign.status === 'running') {
        return { success: false, error: 'Campaign is already running' };
    }

    const accountIds = campaign.account_ids as string[];
    if (!accountIds || accountIds.length === 0) {
        return { success: false, error: 'No WhatsApp accounts assigned to campaign' };
    }

    // Update campaign status
    await supabase
        .from('whatsapp_campaigns')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', campaignId);

    const job: CampaignJob = {
        campaignId,
        companyId: campaign.company_id,
        accountIds,
        delayMin: campaign.delay_min_seconds || 60,
        delayMax: campaign.delay_max_seconds || 180,
        isPaused: false,
        isCancelled: false,
    };

    activeCampaigns.set(campaignId, job);

    // Run in background
    executeCampaign(job).catch(err => {
        console.error(`[Campaign ${campaignId}] Fatal error:`, err);
    });

    return { success: true };
}

/**
 * Execute campaign messages sequentially with round-robin rotation.
 */
async function executeCampaign(job: CampaignJob): Promise<void> {
    const { campaignId, companyId, accountIds, delayMin, delayMax } = job;

    // Load the campaign template
    const { data: campaign } = await supabase
        .from('whatsapp_campaigns')
        .select('message_template')
        .eq('id', campaignId)
        .maybeSingle();

    if (!campaign) {
        console.error(`[Campaign ${campaignId}] Not found`);
        return;
    }

    const messageTemplate = campaign.message_template;

    // Load pending recipients
    const { data: recipients, error } = await supabase
        .from('whatsapp_campaign_recipients')
        .select('id, phone_number, lead_data')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

    if (error || !recipients || recipients.length === 0) {
        await supabase
            .from('whatsapp_campaigns')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', campaignId);
        activeCampaigns.delete(campaignId);
        console.log(`[Campaign ${campaignId}] No pending recipients. Completed.`);
        return;
    }

    let accountIndex = 0;

    for (const recipient of recipients) {
        // Check if paused or cancelled
        if (job.isCancelled) {
            console.log(`[Campaign ${campaignId}] Cancelled.`);
            break;
        }

        // Wait while paused
        while (job.isPaused && !job.isCancelled) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (job.isCancelled) break;

        // Pick the next available account
        const picked = await pickAccount(accountIds, accountIndex);
        if (!picked) {
            console.log(`[Campaign ${campaignId}] All accounts exhausted. Pausing.`);
            await supabase
                .from('whatsapp_campaigns')
                .update({ status: 'paused' })
                .eq('id', campaignId);
            job.isPaused = true;
            // Wait for manual resume or next day
            while (job.isPaused && !job.isCancelled) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            if (job.isCancelled) break;
            continue;
        }

        accountIndex = picked.nextIndex;

        // Resolve message with spintax + variables
        const leadData = (recipient.lead_data as Record<string, any>) || {};
        const resolvedMessage = resolveMessage(messageTemplate, leadData);

        // Send the message
        const result = await sessionManager.sendMessage(
            picked.sessionId,
            recipient.phone_number,
            resolvedMessage
        );

        const now = new Date().toISOString();

        if (result.success) {
            // Update recipient status
            await supabase
                .from('whatsapp_campaign_recipients')
                .update({
                    status: 'sent',
                    sent_by_account_id: picked.accountId,
                    resolved_message: resolvedMessage,
                    sent_at: now,
                })
                .eq('id', recipient.id);

            // Increment daily counter for the account
            await supabase.rpc('increment_wa_messages_sent', { account_id: picked.accountId });

            // Log the message
            await supabase
                .from('whatsapp_message_log')
                .insert({
                    company_id: companyId,
                    account_id: picked.accountId,
                    campaign_id: campaignId,
                    recipient_phone: recipient.phone_number,
                    message_body: resolvedMessage,
                    status: 'sent',
                    sent_at: now,
                });
        } else {
            await supabase
                .from('whatsapp_campaign_recipients')
                .update({
                    status: 'failed',
                    error_message: result.error || 'Unknown error',
                    sent_by_account_id: picked.accountId,
                })
                .eq('id', recipient.id);

            // Log failure
            await supabase
                .from('whatsapp_message_log')
                .insert({
                    company_id: companyId,
                    account_id: picked.accountId,
                    campaign_id: campaignId,
                    recipient_phone: recipient.phone_number,
                    message_body: resolvedMessage,
                    status: 'failed',
                    sent_at: now,
                });
        }

        // Random delay before next message
        await randomDelay(delayMin, delayMax);
    }

    // Mark campaign as completed if not cancelled
    if (!job.isCancelled) {
        await supabase
            .from('whatsapp_campaigns')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', campaignId);
    }

    activeCampaigns.delete(campaignId);
    console.log(`[Campaign ${campaignId}] Finished.`);
}

/**
 * Pause a running campaign.
 */
export async function pauseCampaign(campaignId: string): Promise<boolean> {
    const job = activeCampaigns.get(campaignId);
    if (job) {
        job.isPaused = true;
    }
    
    await supabase
        .from('whatsapp_campaigns')
        .update({ status: 'paused' })
        .eq('id', campaignId);
        
    return true;
}

/**
 * Resume a paused campaign.
 */
export async function resumeCampaign(campaignId: string): Promise<boolean> {
    const job = activeCampaigns.get(campaignId);
    if (!job) {
        // If job not in memory, restart it
        await startCampaign(campaignId);
        return true;
    }
    job.isPaused = false;
    await supabase
        .from('whatsapp_campaigns')
        .update({ status: 'running' })
        .eq('id', campaignId);
        
    return true;
}

/**
 * Get campaign progress.
 */
export async function getCampaignProgress(campaignId: string) {
    const { data: stats } = await supabase
        .from('whatsapp_campaign_recipients')
        .select('status')
        .eq('campaign_id', campaignId);

    if (!stats) return { total: 0, sent: 0, failed: 0, pending: 0, skipped: 0 };

    return {
        total: stats.length,
        sent: stats.filter(s => s.status === 'sent').length,
        failed: stats.filter(s => s.status === 'failed').length,
        pending: stats.filter(s => s.status === 'pending').length,
        skipped: stats.filter(s => s.status === 'skipped').length,
    };
}
