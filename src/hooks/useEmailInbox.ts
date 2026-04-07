import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/hooks/use-toast';

export interface EmailThread {
  id: string;
  company_id: string;
  email_account_id: string;
  subject: string;
  last_message_at: string;
  snippet: string | null;
  lead_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  message_id: string;
  in_reply_to: string | null;
  from_address: string;
  to_address: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  is_read: boolean;
  received_at: string;
  direction: 'inbound' | 'outbound';
  created_at: string;
}

export function useEmailInbox() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  // ─── Fetch Threads ───────────────────────────────────────────────────────────
  const threadsQuery = useQuery({
    queryKey: ['email-threads', company?.id],
    queryFn: async (): Promise<EmailThread[]> => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from('email_threads' as any)
        .select('*')
        .eq('company_id', company.id)
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!company?.id,
  });

  // ─── Fetch Messages for a Thread ─────────────────────────────────────────────
  const useMessages = (threadId: string | null) => useQuery({
    queryKey: ['email-messages', threadId],
    queryFn: async (): Promise<EmailMessage[]> => {
      if (!threadId) return [];
      const { data, error } = await supabase
        .from('email_messages' as any)
        .select('*')
        .eq('thread_id', threadId)
        .order('received_at', { ascending: true });
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!threadId,
  });

  // ─── Sync Emails ─────────────────────────────────────────────────────────────
  const syncEmails = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/fastsend-sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Sync failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
      
      let newCount = 0;
      data.results?.forEach((r: any) => newCount += r.new_messages);
      
      toast({ 
        title: 'Sync completed!', 
        description: newCount > 0 ? `Found ${newCount} new messages.` : 'Everything is up to date.' 
      });
    },
    onError: (err: any) => {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    }
  });

  // ─── Mark Thread as Read ───────────────────────────────────────────────────
  const markAsRead = useMutation({
    mutationFn: async (threadId: string) => {
      const { error: threadError } = await supabase
        .from('email_threads' as any)
        .update({ is_read: true })
        .eq('id', threadId);
      
      if (threadError) throw threadError;

      const { error: msgError } = await supabase
        .from('email_messages' as any)
        .update({ is_read: true })
        .eq('thread_id', threadId)
        .eq('is_read', false);
      
      if (msgError) throw msgError;
    },
    onSuccess: (_, threadId) => {
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      queryClient.invalidateQueries({ queryKey: ['email-messages', threadId] });
    }
  });

  return {
    threads: threadsQuery.data || [],
    isLoadingThreads: threadsQuery.isLoading,
    useMessages,
    syncEmails,
    markAsRead,
    refetchThreads: threadsQuery.refetch
  };
}
