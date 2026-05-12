/**
 * useEmailAccounts — React Query hooks for FastSend email account management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface EmailAccount {
    id: string;
    company_id: string;
    user_id: string;
    provider: 'gmail' | 'outlook' | 'zoho' | 'custom';
    email_address: string;
    display_name: string | null;
    protocol: 'imap_smtp' | 'smtp_only';
    smtp_host: string | null;
    smtp_port: number | null;
    smtp_user: string | null;
    smtp_password: string | null;
    smtp_secure: boolean;
    imap_host: string | null;
    imap_port: number | null;
    imap_user: string | null;
    imap_password: string | null;
    access_token: string | null;
    refresh_token: string | null;
    token_expires_at: string | null;
    daily_limit: number;
    emails_sent_today: number;
    warmup_enabled: boolean;
    warmup_daily_target: number;
    warmup_ramp_per_day: number;
    warmup_current_day: number;
    status: 'connected' | 'disconnected' | 'error';
    last_error: string | null;
    created_at: string;
    updated_at: string;
}

const PROVIDER_DEFAULTS: Record<string, { smtp_host: string; smtp_port: number; imap_host: string; imap_port: number }> = {
    gmail: { smtp_host: 'smtp.gmail.com', smtp_port: 587, imap_host: 'imap.gmail.com', imap_port: 993 },
    outlook: { smtp_host: 'smtp-mail.outlook.com', smtp_port: 587, imap_host: 'outlook.office365.com', imap_port: 993 },
    zoho: { smtp_host: 'smtp.zoho.com', smtp_port: 587, imap_host: 'imap.zoho.com', imap_port: 993 },
};

export function getProviderDefaults(provider: string) {
    return PROVIDER_DEFAULTS[provider] || null;
}

export function useEmailAccounts() {
    const { company } = useCompany();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

    // ── List accounts ─────────────────────────────────────────────────────

    const accountsQuery = useQuery({
        queryKey: ['email-accounts', company?.id],
        queryFn: async (): Promise<EmailAccount[]> => {
            if (!company?.id) return [];
            const { data, error } = await supabase
                .from('email_accounts' as any)
                .select('*')
                .eq('company_id', company.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data as any) || [];
        },
        enabled: !!company?.id,
    });

    // ── Create account ────────────────────────────────────────────────────

    const createAccount = useMutation({
        mutationFn: async (params: {
            provider: string;
            email_address: string;
            display_name?: string;
            protocol: string;
            smtp_host?: string;
            smtp_port?: number;
            smtp_user?: string;
            smtp_password?: string;
            smtp_secure?: boolean;
            imap_host?: string;
            imap_port?: number;
            imap_user?: string;
            imap_password?: string;
            daily_limit?: number;
            warmup_enabled?: boolean;
            warmup_daily_target?: number;
            warmup_ramp_per_day?: number;
        }) => {
            if (!company?.id || !user?.id) throw new Error('No company context');

            const defaults = getProviderDefaults(params.provider);

            const { data, error } = await supabase
                .from('email_accounts' as any)
                .insert({
                    company_id: company.id,
                    user_id: user.id,
                    provider: params.provider,
                    email_address: params.email_address,
                    display_name: params.display_name || params.email_address,
                    protocol: params.protocol,
                    smtp_host: params.smtp_host || defaults?.smtp_host || '',
                    smtp_port: params.smtp_port || defaults?.smtp_port || 587,
                    smtp_user: params.smtp_user || params.email_address,
                    smtp_password: params.smtp_password || '',
                    smtp_secure: params.smtp_secure ?? true,
                    imap_host: params.imap_host || defaults?.imap_host || null,
                    imap_port: params.imap_port || defaults?.imap_port || null,
                    imap_user: params.imap_user || params.email_address,
                    imap_password: params.imap_password || null,
                    daily_limit: params.daily_limit || 50,
                    warmup_enabled: params.warmup_enabled || false,
                    warmup_daily_target: params.warmup_daily_target || 5,
                    warmup_ramp_per_day: params.warmup_ramp_per_day || 2,
                    status: 'disconnected',
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
            toast({ title: 'Email account added!' });
        },
        onError: (err: any) => {
            toast({ title: 'Failed to add account', description: err.message, variant: 'destructive' });
        },
    });

    // ── Test connection ───────────────────────────────────────────────────

    const testConnection = useMutation({
        mutationFn: async (params: string | { 
            accountId?: string;
            provider?: string;
            email?: string;
            protocol?: string;
            smtpHost?: string;
            smtpPort?: number;
            smtpUser?: string;
            smtpPassword?: string;
            smtpSecure?: boolean;
            imapHost?: string;
            imapPort?: number;
            imapUser?: string;
            imapPassword?: string;
        }) => {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const body = typeof params === 'string' 
                ? { action: 'test', accountId: params }
                : { action: 'test', ...params };

            const res = await fetch(`https://${projectId}.supabase.co/functions/v1/fastsend-account`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return data;
        },
        onSuccess: (data, variables) => {
            // If the test succeeded and we have an accountId, also update status directly
            // from the frontend as a reliable fallback (edge function does this too)
            const accountId = typeof variables === 'string' ? variables : (variables as any)?.accountId;
            if (data.success && accountId) {
                supabase
                    .from('email_accounts' as any)
                    .update({ status: 'connected', last_error: null, updated_at: new Date().toISOString() })
                    .eq('id', accountId)
                    .then(({ error }) => {
                        if (error) console.error('[FastSend] Status update failed:', error);
                        queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
                    })
                    .catch(err => {
                        console.error('[FastSend] Status update exception:', err);
                        queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
                    });
            } else {
                queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
            }
            toast({ title: data.success ? 'Connection successful! ✅' : 'Connection test failed', description: data.success ? undefined : (data.error || 'Check credentials') });
        },
        onError: (err: any) => {
            toast({ title: 'Test failed', description: err.message, variant: 'destructive' });
        },
    });

    // ── Update account ────────────────────────────────────────────────────

    const updateAccount = useMutation({
        mutationFn: async (params: { accountId: string } & Partial<EmailAccount>) => {
            const { accountId, ...updates } = params;
            const { error } = await supabase
                .from('email_accounts' as any)
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', accountId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
            toast({ title: 'Account updated' });
        },
    });

    // ── Delete account ────────────────────────────────────────────────────

    const deleteAccount = useMutation({
        mutationFn: async (accountId: string) => {
            const { error } = await supabase
                .from('email_accounts' as any)
                .delete()
                .eq('id', accountId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
            toast({ title: 'Account removed' });
        },
    });

    // ── Send Test Email ───────────────────────────────────────────────────

    const sendTestEmail = useMutation({
        mutationFn: async (params: { 
            accountId?: string; 
            to: string; 
            smtp_host?: string;
            smtp_port?: number;
            smtp_user?: string;
            smtp_password?: string;
            smtp_secure?: boolean;
            email_address?: string;
        }) => {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const res = await fetch(`https://${projectId}.supabase.co/functions/v1/fastsend-account`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    action: 'test_send', 
                    ...params 
                }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return data;
        },
        onSuccess: (data, variables) => {
            if (variables?.accountId) {
                supabase
                    .from('email_accounts' as any)
                    .update({ status: 'connected', last_error: null, updated_at: new Date().toISOString() })
                    .eq('id', variables.accountId)
                    .then(({ error }) => {
                        if (error) console.error('[FastSend] Status update after send failed:', error);
                        queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
                    })
                    .catch(err => {
                        console.error('[FastSend] Status update after send exception:', err);
                        queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
                    });
            } else {
                queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
            }
            toast({ title: 'Test email sent! ✅', description: 'Connection verified. Account marked as connected.' });
        },
        onError: (err: any) => {
            toast({ title: 'Send failed', description: err.message, variant: 'destructive' });
        },
    });

    const sendDirectEmail = useMutation({
        mutationFn: async (params: { 
            accountId: string; 
            to: string; 
            subject: string; 
            bodyHtml: string;
            leadId?: string;
            leadTable?: string;
        }) => {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const res = await fetch(`https://${projectId}.supabase.co/functions/v1/fastsend-send`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return data;
        },
        onSuccess: () => {
            toast({ title: 'Email sent successfully! ✅' });
        },
        onError: (err: any) => {
            toast({ title: 'Failed to send email', description: err.message, variant: 'destructive' });
        },
    });

    return {
        accounts: accountsQuery.data || [],
        isLoading: accountsQuery.isLoading,
        createAccount,
        testConnection,
        updateAccount,
        deleteAccount,
        sendTestEmail,
        sendDirectEmail,
        refetch: accountsQuery.refetch,
    };
}
