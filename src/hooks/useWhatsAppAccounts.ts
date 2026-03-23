/**
 * useWhatsAppAccounts — React Query hooks for WhatsApp account management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
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

export interface WhatsAppAccount {
    id: string;
    company_id: string;
    session_id: string;
    phone_number: string | null;
    display_name: string | null;
    status: 'connecting' | 'connected' | 'disconnected';
    daily_limit: number;
    messages_sent_today: number;
    last_connected_at: string | null;
    created_at: string;
}

export function useWhatsAppAccounts() {
    const { company } = useCompany();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const accountsQuery = useQuery({
        queryKey: ['whatsapp-accounts', company?.id],
        queryFn: async (): Promise<WhatsAppAccount[]> => {
            if (!company?.id) return [];
            const { data, error } = await supabase
                .from('whatsapp_accounts' as any)
                .select('*')
                .eq('company_id', company.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data as any) || [];
        },
        enabled: !!company?.id,
        refetchInterval: 10000, // Poll every 10s for status updates
    });

    const createSession = useMutation({
        mutationFn: async ({ sessionId }: { sessionId: string }) => {
            if (!company?.id) throw new Error('No company context');

            // Create in Supabase first
            await supabase.from('whatsapp_accounts' as any).upsert(
                {
                    session_id: sessionId,
                    company_id: company.id,
                    status: 'connecting',
                },
                { onConflict: 'session_id' }
            );

            // Request QR from WhatsApp server
            const result = await waFetch('/api/sessions/create', {
                method: 'POST',
                body: JSON.stringify({ sessionId, companyId: company.id }),
            });

            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
        },
        onError: (error: any) => {
            toast({
                title: 'Failed to create session',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const pollQR = async (sessionId: string) => {
        return waFetch(`/api/sessions/${sessionId}/qr`);
    };

    const disconnectSession = useMutation({
        mutationFn: async (sessionId: string) => {
            await waFetch(`/api/sessions/${sessionId}/disconnect`, { method: 'POST' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
            toast({ title: 'Session disconnected' });
        },
    });

    const deleteAccount = useMutation({
        mutationFn: async (accountId: string) => {
            // Get session ID first
            const { data: account } = await supabase
                .from('whatsapp_accounts' as any)
                .select('session_id')
                .eq('id', accountId)
                .maybeSingle();

            if (account) {
                await waFetch(`/api/sessions/${(account as any).session_id}/disconnect`, {
                    method: 'POST',
                });
            }

            await supabase.from('whatsapp_accounts' as any).delete().eq('id', accountId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
            toast({ title: 'Account removed' });
        },
    });

    return {
        accounts: accountsQuery.data || [],
        isLoading: accountsQuery.isLoading,
        createSession,
        pollQR,
        disconnectSession,
        deleteAccount,
        refetch: accountsQuery.refetch,
    };
}
