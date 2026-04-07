/**
 * useEmailCampaigns — React Query hooks for FastSend campaign management
 *
 * Mirrors the pattern from useWhatsAppCampaigns.ts
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useLeadsTable } from '@/hooks/useLeadsTable';
import { useToast } from '@/hooks/use-toast';

export interface EmailCampaign {
    id: string;
    company_id: string;
    created_by: string | null;
    name: string;
    campaign_goal: string;
    campaign_mode: string;
    status: string;
    recipient_filter: any;
    recipient_count: number;
    account_ids: string[];
    delay_between_emails_ms: number;
    daily_limit: number;
    warmup_enabled: boolean;
    warmup_ramp_per_day: number;
    ai_generated: boolean;
    ai_perspective: string | null;
    scheduled_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CampaignSequenceStep {
    id: string;
    campaign_id: string;
    step_number: number;
    subject: string;
    body_html: string;
    body_text: string | null;
    delay_after_ms: number;
    send_condition: string;
    ai_generated: boolean;
    created_at: string;
}

export interface CampaignRecipient {
    id: string;
    campaign_id: string;
    lead_id: string | null;
    lead_table: string | null;
    lead_email: string;
    lead_name: string | null;
    lead_data: Record<string, any>;
    current_step: number;
    status: string;
    last_sent_at: string | null;
    opened_at: string | null;
    replied_at: string | null;
    clicked_at: string | null;
    created_at: string;
}

export function useEmailCampaigns() {
    const { company } = useCompany();
    const { tableName } = useLeadsTable();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

    // ── List campaigns ────────────────────────────────────────────────────

    const campaignsQuery = useQuery({
        queryKey: ['email-campaigns', company?.id],
        queryFn: async (): Promise<EmailCampaign[]> => {
            if (!company?.id) return [];
            const { data, error } = await supabase
                .from('email_campaigns' as any)
                .select('*')
                .eq('company_id', company.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data as any) || [];
        },
        enabled: !!company?.id,
    });

    // ── Get campaign sequences ────────────────────────────────────────────

    const useCampaignSequences = (campaignId: string | null) => {
        return useQuery({
            queryKey: ['email-campaign-sequences', campaignId],
            queryFn: async (): Promise<CampaignSequenceStep[]> => {
                if (!campaignId) return [];
                const { data, error } = await supabase
                    .from('email_campaign_sequences' as any)
                    .select('*')
                    .eq('campaign_id', campaignId)
                    .order('step_number', { ascending: true });
                if (error) throw error;
                return (data as any) || [];
            },
            enabled: !!campaignId,
        });
    };

    // ── Get campaign recipients ───────────────────────────────────────────

    const useCampaignRecipients = (campaignId: string | null) => {
        return useQuery({
            queryKey: ['email-campaign-recipients', campaignId],
            queryFn: async (): Promise<CampaignRecipient[]> => {
                if (!campaignId) return [];
                const { data, error } = await supabase
                    .from('email_campaign_recipients' as any)
                    .select('*')
                    .eq('campaign_id', campaignId)
                    .order('created_at', { ascending: true })
                    .limit(500);
                if (error) throw error;
                return (data as any) || [];
            },
            enabled: !!campaignId,
        });
    };

    // ── Fetch leads (for recipient selection) ─────────────────────────────

    const fetchLeads = async (statusFilter?: string) => {
        if (!company?.id) return [];
        let query = supabase
            .from(tableName as any)
            .select('*')
            .eq('company_id', company.id)
            .order('created_at', { ascending: false });

        if (statusFilter && statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data as any[]) || [];
    };

    // ── Get lead table columns ────────────────────────────────────────────

    const leadColumnsQuery = useQuery({
        queryKey: ['lead-columns-email', tableName, company?.id],
        queryFn: async (): Promise<string[]> => {
            if (!company?.id) return [];
            const { data, error } = await supabase
                .from(tableName as any)
                .select('*')
                .eq('company_id', company.id)
                .limit(1);
            if (error || !data || data.length === 0) return [];
            const skipCols = ['id', 'company_id', 'created_at', 'updated_at'];
            return Object.keys(data[0]).filter(k => !skipCols.includes(k));
        },
        enabled: !!company?.id && !!tableName,
        staleTime: 60000,
    });

    // ── Create campaign ───────────────────────────────────────────────────

    const createCampaign = useMutation({
        mutationFn: async (params: {
            name: string;
            campaignGoal: string;
            campaignMode: string;
            accountIds: string[];
            delayBetweenEmailsMs?: number;
            dailyLimit?: number;
            warmupEnabled?: boolean;
            warmupRampPerDay?: number;
            aiGenerated?: boolean;
            aiPerspective?: string;
            aiAutoReplyEnabled?: boolean;
            aiAutoReplyGoal?: string;
            aiAutoReplyPerspective?: string;
            scheduledAt?: string | null;
            sequences: Array<{
                step_number: number;
                subject: string;
                body_html: string;
                body_text?: string;
                delay_after_ms: number;
                send_condition: string;
                ai_generated?: boolean;
            }>;
            leads: any[];
            emailField: string;
        }) => {
            if (!company?.id) throw new Error('No company context');
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) throw new Error('Not authenticated');

            // 1. Create campaign
            const { data: campaign, error: campError } = await supabase
                .from('email_campaigns' as any)
                .insert({
                    company_id: company.id,
                    created_by: userData.user.id,
                    name: params.name,
                    campaign_goal: params.campaignGoal,
                    campaign_mode: params.campaignMode,
                    account_ids: params.accountIds,
                    recipient_count: params.leads.length,
                    delay_between_emails_ms: params.delayBetweenEmailsMs || 60000,
                    daily_limit: params.dailyLimit || 50,
                    warmup_enabled: params.warmupEnabled || false,
                    warmup_ramp_per_day: params.warmupRampPerDay || 2,
                    ai_generated: params.aiGenerated || false,
                    ai_perspective: params.aiPerspective || null,
                    ai_auto_reply_enabled: params.aiAutoReplyEnabled || false,
                    ai_auto_reply_goal: params.aiAutoReplyGoal || null,
                    ai_auto_reply_perspective: params.aiAutoReplyPerspective || null,
                    scheduled_at: params.scheduledAt || null,
                    status: params.scheduledAt ? 'scheduled' : 'draft',
                })
                .select()
                .single();

            if (campError) throw campError;
            const campaignId = (campaign as any).id;

            // 2. Create sequence steps
            const seqRows = params.sequences.map(s => ({
                campaign_id: campaignId,
                step_number: s.step_number,
                subject: s.subject,
                body_html: s.body_html,
                body_text: s.body_text || '',
                delay_after_ms: s.delay_after_ms,
                send_condition: s.send_condition,
                ai_generated: s.ai_generated || false,
            }));

            if (seqRows.length > 0) {
                const { error: seqError } = await supabase
                    .from('email_campaign_sequences' as any)
                    .insert(seqRows);
                if (seqError) throw seqError;
            }

            // 3. Create recipients
            const recipients = params.leads.map(lead => ({
                campaign_id: campaignId,
                lead_id: lead.id || null,
                lead_table: tableName,
                lead_email: lead[params.emailField] || lead.email || '',
                lead_name: lead.name || '',
                lead_data: lead,
                status: 'pending',
                current_step: 0,
            }));

            for (let i = 0; i < recipients.length; i += 500) {
                const batch = recipients.slice(i, i + 500);
                const { error: recError } = await supabase
                    .from('email_campaign_recipients' as any)
                    .insert(batch);
                if (recError) throw recError;
            }

            return campaign;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
            toast({ title: 'Email campaign created!' });
        },
        onError: (err: any) => {
            toast({ title: 'Failed to create campaign', description: err.message, variant: 'destructive' });
        },
    });

    // ── Campaign actions ──────────────────────────────────────────────────

    const startCampaign = useMutation({
        mutationFn: async (campaignId: string) => {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            const res = await fetch(`https://${projectId}.supabase.co/functions/v1/fastsend-campaign`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', campaignId }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
            toast({ title: 'Campaign started!' });
        },
    });

    const pauseCampaign = useMutation({
        mutationFn: async (campaignId: string) => {
            const { error } = await supabase
                .from('email_campaigns' as any)
                .update({ status: 'paused', updated_at: new Date().toISOString() })
                .eq('id', campaignId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
            toast({ title: 'Campaign paused' });
        },
    });

    const resumeCampaign = useMutation({
        mutationFn: async (campaignId: string) => {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            const res = await fetch(`https://${projectId}.supabase.co/functions/v1/fastsend-campaign`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resume', campaignId }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
            toast({ title: 'Campaign resumed' });
        },
    });

    const deleteCampaign = useMutation({
        mutationFn: async (campaignId: string) => {
            await supabase.from('email_campaign_logs' as any).delete().eq('campaign_id', campaignId);
            await supabase.from('email_campaign_recipients' as any).delete().eq('campaign_id', campaignId);
            await supabase.from('email_campaign_sequences' as any).delete().eq('campaign_id', campaignId);
            await supabase.from('email_campaigns' as any).delete().eq('id', campaignId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
            toast({ title: 'Campaign deleted' });
        },
    });

    // ── Campaign analytics ────────────────────────────────────────────────

    const useCampaignAnalytics = (campaignId: string | null) => {
        return useQuery({
            queryKey: ['email-campaign-analytics', campaignId],
            queryFn: async () => {
                if (!campaignId) return null;

                // Fetch recipients
                const { data: recipients } = await supabase
                    .from('email_campaign_recipients' as any)
                    .select('status, opened_at, replied_at, clicked_at, current_step, last_sent_at')
                    .eq('campaign_id', campaignId);

                // Fetch logs for sent count (more accurate)
                const { data: logs } = await supabase
                    .from('email_campaign_logs' as any)
                    .select('id, status, sent_at, opened_at, replied_at, clicked_at, sequence_step_id')
                    .eq('campaign_id', campaignId);

                // Fetch sequences for per-step stats
                const { data: sequences } = await supabase
                    .from('email_campaign_sequences' as any)
                    .select('id, step_number, subject, send_condition')
                    .eq('campaign_id', campaignId)
                    .order('step_number', { ascending: true });

                const recs = (recipients as any[]) || [];
                const logEntries = (logs as any[]) || [];
                const steps = (sequences as any[]) || [];

                // Per-step breakdown
                const stepStats = steps.map(step => {
                    const stepLogs = logEntries.filter(l => l.sequence_step_id === step.id);
                    return {
                        stepNumber: step.step_number,
                        subject: step.subject,
                        condition: step.send_condition,
                        sent: stepLogs.length,
                        opened: stepLogs.filter(l => l.opened_at).length,
                        replied: stepLogs.filter(l => l.replied_at).length,
                        clicked: stepLogs.filter(l => l.clicked_at).length,
                    };
                });

                const totalSent = logEntries.length;
                const totalOpened = recs.filter(r => r.opened_at).length;
                const totalReplied = recs.filter(r => r.replied_at).length;
                const totalClicked = recs.filter(r => r.clicked_at).length;

                return {
                    total: recs.length,
                    sent: totalSent,
                    pending: recs.filter(r => r.status === 'pending').length,
                    in_progress: recs.filter(r => r.status === 'in_progress').length,
                    completed: recs.filter(r => r.status === 'completed').length,
                    replied: recs.filter(r => r.status === 'replied').length,
                    bounced: recs.filter(r => r.status === 'bounced').length,
                    failed: recs.filter(r => r.status === 'failed').length,
                    opened: totalOpened,
                    clicked: totalClicked,
                    openRate: recs.length > 0 ? Math.round((totalOpened / recs.length) * 100) : 0,
                    replyRate: recs.length > 0 ? Math.round((totalReplied / recs.length) * 100) : 0,
                    clickRate: recs.length > 0 ? Math.round((totalClicked / recs.length) * 100) : 0,
                    stepStats,
                    totalSteps: steps.length,
                };
            },
            enabled: !!campaignId,
            refetchInterval: 30000, // Auto-refresh every 30s for live campaigns
        });
    };

    // ── Campaign logs ─────────────────────────────────────────────────────

    const useCampaignLogs = (filters?: { campaignId?: string }) => {
        return useQuery({
            queryKey: ['email-campaign-logs', company?.id, filters],
            queryFn: async () => {
                if (!company?.id) return [];
                let query = supabase
                    .from('email_campaign_logs' as any)
                    .select('*')
                    .eq('company_id', company.id)
                    .order('sent_at', { ascending: false })
                    .limit(200);

                if (filters?.campaignId) {
                    query = query.eq('campaign_id', filters.campaignId);
                }

                const { data, error } = await query;
                if (error) throw error;
                return (data as any[]) || [];
            },
            enabled: !!company?.id,
        });
    };

    return {
        campaigns: campaignsQuery.data || [],
        isLoading: campaignsQuery.isLoading,
        leadColumns: leadColumnsQuery.data || [],
        fetchLeads,
        createCampaign,
        startCampaign,
        pauseCampaign,
        resumeCampaign,
        deleteCampaign,
        useCampaignSequences,
        useCampaignRecipients,
        useCampaignAnalytics,
        useCampaignLogs,
        refetch: campaignsQuery.refetch,
    };
}
