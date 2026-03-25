/**
 * useWhatsAppCampaigns — React Query hooks for WhatsApp campaign management
 *
 * Uses `useLeadsTable` to resolve the org's correct lead table for recipients.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useLeadsTable } from '@/hooks/useLeadsTable';
import { useToast } from '@/hooks/use-toast';

const WA_SERVER_URL = import.meta.env.VITE_WHATSAPP_SERVER_URL || 'http://localhost:3001';
const WA_API_KEY = import.meta.env.VITE_WHATSAPP_API_KEY || '';

async function waFetch(path: string, options: RequestInit = {}) {
    const res = await fetch(`${WA_SERVER_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': WA_API_KEY,
            ...options.headers,
        },
    });
    return res.json();
}

export interface WhatsAppCampaign {
    id: string;
    company_id: string;
    created_by: string | null;
    name: string;
    message_template: string;
    status: string;
    account_ids: string[];
    recipient_filter: any;
    recipient_count: number;
    delay_min_seconds: number;
    delay_max_seconds: number;
    scheduled_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
}

export interface CampaignRecipient {
    id: string;
    campaign_id: string;
    lead_id: string | null;
    phone_number: string;
    lead_table: string | null;
    lead_data: Record<string, any> | null;
    status: string;
    sent_by_account_id: string | null;
    resolved_message: string | null;
    sent_at: string | null;
    error_message: string | null;
    created_at: string;
}

export function useWhatsAppCampaigns() {
    const { company } = useCompany();
    const { tableName } = useLeadsTable();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // ── List campaigns ────────────────────────────────────────────────────

    const campaignsQuery = useQuery({
        queryKey: ['whatsapp-campaigns', company?.id],
        queryFn: async (): Promise<WhatsAppCampaign[]> => {
            if (!company?.id) return [];
            const { data, error } = await supabase
                .from('whatsapp_campaigns' as any)
                .select('*')
                .eq('company_id', company.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data as any) || [];
        },
        enabled: !!company?.id,
    });

    // ── Fetch leads for recipient selection ────────────────────────────────

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

    // ── Get lead table columns (for variable picker) ──────────────────────

    const leadColumnsQuery = useQuery({
        queryKey: ['lead-columns', tableName, company?.id],
        queryFn: async (): Promise<string[]> => {
            if (!company?.id) return [];
            // Fetch one row to get column names
            const { data, error } = await supabase
                .from(tableName as any)
                .select('*')
                .eq('company_id', company.id)
                .limit(1);

            if (error || !data || data.length === 0) return [];
            // Return column names, filtering out internal ones
            const skipCols = ['id', 'company_id', 'created_at', 'updated_at'];
            return Object.keys(data[0]).filter(k => !skipCols.includes(k));
        },
        enabled: !!company?.id && !!tableName,
        staleTime: 60000,
    });

    // ── Create a campaign with recipients ─────────────────────────────────

    const createCampaign = useMutation({
        mutationFn: async (params: {
            name: string;
            messageTemplate: string;
            accountIds: string[];
            delayMinSeconds?: number;
            delayMaxSeconds?: number;
            scheduledAt?: string | null;
            leads: any[];
            phoneField: string;
        }) => {
            if (!company?.id) throw new Error('No company context');

            const { data: campaign, error } = await supabase
                .from('whatsapp_campaigns' as any)
                .insert({
                    company_id: company.id,
                    name: params.name,
                    message_template: params.messageTemplate,
                    account_ids: params.accountIds,
                    recipient_count: params.leads.length,
                    delay_min_seconds: params.delayMinSeconds || 60,
                    delay_max_seconds: params.delayMaxSeconds || 180,
                    scheduled_at: params.scheduledAt || null,
                    status: params.scheduledAt ? 'scheduled' : 'draft',
                })
                .select()
                .single();

            if (error) throw error;
            const campaignId = (campaign as any).id;

            // Create recipients with lead data snapshots
            const recipients = params.leads.map(lead => ({
                campaign_id: campaignId,
                lead_id: lead.id || null,
                phone_number: lead[params.phoneField] || lead.phone || '',
                lead_table: tableName,
                lead_data: lead,
                status: 'pending',
            }));

            // Insert in batches of 500
            for (let i = 0; i < recipients.length; i += 500) {
                const batch = recipients.slice(i, i + 500);
                const { error: insertError } = await supabase
                    .from('whatsapp_campaign_recipients' as any)
                    .insert(batch);
                if (insertError) throw insertError;
            }

            return campaign;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-campaigns'] });
            toast({ title: 'Campaign created!' });
        },
        onError: (error: any) => {
            toast({
                title: 'Failed to create campaign',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const updateCampaign = useMutation({
        mutationFn: async (params: {
            campaignId: string;
            name: string;
            messageTemplate: string;
            accountIds: string[];
            delayMinSeconds: number;
            delayMaxSeconds: number;
            scheduledAt: string | null;
        }) => {
            // Fetch current status
            const { data } = await supabase.from('whatsapp_campaigns' as any).select('status').eq('id', params.campaignId).single();
            const curr = data as any;
            
            const updates: any = {
                name: params.name,
                message_template: params.messageTemplate,
                account_ids: params.accountIds,
                delay_min_seconds: params.delayMinSeconds,
                delay_max_seconds: params.delayMaxSeconds,
                scheduled_at: params.scheduledAt,
            };

            // Switch between draft and scheduled if appropriate
            if (curr && (curr.status === 'draft' || curr.status === 'scheduled')) {
                updates.status = params.scheduledAt ? 'scheduled' : 'draft';
            }

            const { error } = await supabase
                .from('whatsapp_campaigns' as any)
                .update(updates)
                .eq('id', params.campaignId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-campaigns'] });
            toast({ title: 'Campaign updated!' });
        },
    });

    // ── Campaign actions (start, pause, resume) ───────────────────────────

    const startCampaign = useMutation({
        mutationFn: async (campaignId: string) => {
            return waFetch('/api/campaigns/send', {
                method: 'POST',
                body: JSON.stringify({ campaignId }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-campaigns'] });
            toast({ title: 'Campaign started!' });
        },
    });

    const pauseCampaign = useMutation({
        mutationFn: async (campaignId: string) => {
            return waFetch(`/api/campaigns/${campaignId}/pause`, { method: 'POST' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-campaigns'] });
            toast({ title: 'Campaign paused' });
        },
    });

    const resumeCampaign = useMutation({
        mutationFn: async (campaignId: string) => {
            return waFetch(`/api/campaigns/${campaignId}/resume`, { method: 'POST' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-campaigns'] });
            toast({ title: 'Campaign resumed' });
        },
    });

    const deleteCampaign = useMutation({
        mutationFn: async (campaignId: string) => {
            await supabase.from('whatsapp_campaign_recipients' as any).delete().eq('campaign_id', campaignId);
            await supabase.from('whatsapp_campaigns' as any).delete().eq('id', campaignId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-campaigns'] });
            toast({ title: 'Campaign deleted' });
        },
    });

    // ── Campaign progress ─────────────────────────────────────────────────

    const getCampaignProgress = async (campaignId: string) => {
        return waFetch(`/api/campaigns/${campaignId}/status`);
    };

    // ── Message logs ──────────────────────────────────────────────────────

    const useMessageLogs = (filters?: { campaignId?: string; status?: string }) => {
        return useQuery({
            queryKey: ['whatsapp-logs', company?.id, filters],
            queryFn: async () => {
                if (!company?.id) return [];
                let query = supabase
                    .from('whatsapp_message_log' as any)
                    .select('*')
                    .eq('company_id', company.id)
                    .order('sent_at', { ascending: false })
                    .limit(200);

                if (filters?.campaignId) {
                    query = query.eq('campaign_id', filters.campaignId);
                }
                if (filters?.status) {
                    query = query.eq('status', filters.status);
                }

                const { data, error } = await query;
                if (error) throw error;
                return (data as any[]) || [];
            },
            enabled: !!company?.id,
        });
    };

    // ── Campaign recipients ───────────────────────────────────────────────

    const useCampaignRecipients = (campaignId: string | null) => {
        return useQuery({
            queryKey: ['whatsapp-recipients', campaignId],
            queryFn: async (): Promise<CampaignRecipient[]> => {
                if (!campaignId) return [];
                const { data, error } = await supabase
                    .from('whatsapp_campaign_recipients' as any)
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

    return {
        campaigns: campaignsQuery.data || [],
        isLoading: campaignsQuery.isLoading,
        leadColumns: leadColumnsQuery.data || [],
        fetchLeads,
        createCampaign,
        updateCampaign,
        startCampaign,
        pauseCampaign,
        resumeCampaign,
        deleteCampaign,
        getCampaignProgress,
        useMessageLogs,
        useCampaignRecipients,
        refetch: campaignsQuery.refetch,
    };
}
