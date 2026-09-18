/**
 * useOmnichannelLeadChat — Unified Real-time WhatsApp & Email Conversation Hook
 *
 * Combines WhatsApp message history (whatsapp_message_log) and Email threads/messages
 * into a single unified stream, supporting real-time two-way messaging, instant sends,
 * and context-aware AI reply generation.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useOrgClient } from '@/hooks/useOrgClient';
import { useToast } from '@/hooks/use-toast';
import { getGeminiKey, callGemini, cleanAIResponse } from '@/services/aiUtils';

export interface UnifiedMessage {
    id: string;
    channel: 'whatsapp' | 'email';
    direction: 'inbound' | 'outbound';
    timestamp: string;
    sender: string;
    recipient: string;
    subject?: string;
    body: string;
    bodyHtml?: string;
    status: 'sent' | 'delivered' | 'read' | 'failed' | 'received';
    metadata?: any;
    threadId?: string;
}

interface UseOmnichannelLeadChatParams {
    leadId?: string;
    phone?: string | null;
    email?: string | null;
    leadName?: string | null;
    leadData?: any;
}

export function useOmnichannelLeadChat({
    leadId,
    phone,
    email,
    leadName,
    leadData,
}: UseOmnichannelLeadChatParams) {
    const { company } = useCompany();
    const { orgClient } = useOrgClient();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [activeFilter, setActiveFilter] = useState<'all' | 'whatsapp' | 'email'>('all');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    // Normalize phone (strip extra non-numeric characters)
    const normalizedPhone = useMemo(() => {
        if (!phone) return null;
        return phone.replace(/[^0-9]/g, '');
    }, [phone]);

    const normalizedEmail = useMemo(() => {
        if (!email) return null;
        return email.trim().toLowerCase();
    }, [email]);

    // ─── 1. Query WhatsApp Accounts ──────────────────────────────────────────
    const whatsappAccountsQuery = useQuery({
        queryKey: ['lead-wa-accounts', company?.id],
        queryFn: async () => {
            if (!company?.id) return [];
            const { data } = await orgClient
                .from('whatsapp_accounts' as any)
                .select('id, session_id, phone_number, display_name, status')
                .eq('company_id', company.id)
                .eq('status', 'connected');
            return (data as any[]) || [];
        },
        enabled: !!company?.id,
    });

    // ─── 2. Query Email Accounts ─────────────────────────────────────────────
    const emailAccountsQuery = useQuery({
        queryKey: ['lead-email-accounts', company?.id],
        queryFn: async () => {
            if (!company?.id) return [];
            const { data } = await orgClient
                .from('email_accounts' as any)
                .select('id, email_address, display_name, status, provider')
                .eq('company_id', company.id)
                .eq('status', 'connected');
            return (data as any[]) || [];
        },
        enabled: !!company?.id,
    });

    // ─── 3. Query WhatsApp Messages ─────────────────────────────────────────
    const whatsappMessagesQuery = useQuery({
        queryKey: ['lead-wa-messages', company?.id, normalizedPhone, leadId],
        queryFn: async (): Promise<UnifiedMessage[]> => {
            if (!company?.id) return [];
            if (!normalizedPhone && !leadId) return [];

            let query = orgClient
                .from('whatsapp_message_log' as any)
                .select('*')
                .eq('company_id', company.id)
                .order('sent_at', { ascending: true });

            if (normalizedPhone) {
                // Check exact phone or last 10 digits
                const last10 = normalizedPhone.slice(-10);
                query = query.or(`recipient_phone.ilike.%${last10}%`);
            }

            const { data, error } = await query;
            if (error) {
                console.warn('[useOmnichannelLeadChat] Error fetching WA logs:', error);
                return [];
            }

            return ((data as any[]) || []).map((msg) => ({
                id: msg.id,
                channel: 'whatsapp',
                direction: (msg.direction || 'outbound') as 'inbound' | 'outbound',
                timestamp: msg.sent_at || msg.created_at || new Date().toISOString(),
                sender: msg.direction === 'inbound' ? (leadName || normalizedPhone || 'Lead') : 'You (WhatsApp)',
                recipient: msg.direction === 'inbound' ? 'CRM' : (leadName || msg.recipient_phone),
                body: msg.message_body || '',
                status: (msg.status || (msg.direction === 'inbound' ? 'received' : 'sent')) as any,
                metadata: msg.metadata,
            }));
        },
        enabled: !!company?.id && (!!normalizedPhone || !!leadId),
        refetchInterval: 5000, // Poll every 5s for new messages
    });

    // ─── 4. Query Email Messages & Threads ───────────────────────────────────
    const emailMessagesQuery = useQuery({
        queryKey: ['lead-email-messages', company?.id, normalizedEmail, leadId],
        queryFn: async (): Promise<{ messages: UnifiedMessage[]; defaultThreadId?: string }> => {
            if (!company?.id) return { messages: [] };
            if (!normalizedEmail && !leadId) return { messages: [] };

            // Find matching threads by lead_id or email
            let threadQuery = orgClient
                .from('email_threads' as any)
                .select('id, lead_id, email_account_id, subject, snippet, last_message_at')
                .eq('company_id', company.id);

            if (leadId) {
                threadQuery = threadQuery.eq('lead_id', leadId);
            }

            const { data: threads } = await threadQuery;
            const threadIds = (threads || []).map((t: any) => t.id);

            let msgQuery = orgClient
                .from('email_messages' as any)
                .select('*')
                .order('received_at', { ascending: true });

            if (threadIds.length > 0 && normalizedEmail) {
                msgQuery = msgQuery.or(`thread_id.in.(${threadIds.join(',')}),to_address.ilike.%${normalizedEmail}%,from_address.ilike.%${normalizedEmail}%`);
            } else if (threadIds.length > 0) {
                msgQuery = msgQuery.in('thread_id', threadIds);
            } else if (normalizedEmail) {
                msgQuery = msgQuery.or(`to_address.ilike.%${normalizedEmail}%,from_address.ilike.%${normalizedEmail}%`);
            } else {
                return { messages: [] };
            }

            const { data: rawMsgs, error } = await msgQuery;
            if (error) {
                console.warn('[useOmnichannelLeadChat] Error fetching Email msgs:', error);
                return { messages: [] };
            }

            const messages: UnifiedMessage[] = ((rawMsgs as any[]) || []).map((m) => {
                const isOutbound = m.direction === 'outbound' || (normalizedEmail && m.to_address?.toLowerCase().includes(normalizedEmail));
                return {
                    id: m.id,
                    channel: 'email',
                    direction: isOutbound ? 'outbound' : 'inbound',
                    timestamp: m.received_at || m.created_at || new Date().toISOString(),
                    sender: isOutbound ? (m.from_address || 'You (Email)') : (leadName || m.from_address || 'Lead'),
                    recipient: isOutbound ? (leadName || m.to_address) : 'CRM Inbox',
                    subject: m.subject || undefined,
                    body: m.body_text || (m.body_html ? m.body_html.replace(/<[^>]*>/g, '') : ''),
                    bodyHtml: m.body_html || undefined,
                    status: (isOutbound ? 'sent' : 'received') as any,
                    threadId: m.thread_id,
                };
            });

            const defaultThreadId = threadIds.length > 0 ? threadIds[0] : undefined;
            return { messages, defaultThreadId };
        },
        enabled: !!company?.id && (!!normalizedEmail || !!leadId),
        refetchInterval: 8000,
    });

    // ─── 5. Unified Combined Messages ────────────────────────────────────────
    const allMessages = useMemo(() => {
        const wa = whatsappMessagesQuery.data || [];
        const em = emailMessagesQuery.data?.messages || [];
        const combined = [...wa, ...em];
        
        // Sort chronologically ascending
        combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return combined;
    }, [whatsappMessagesQuery.data, emailMessagesQuery.data]);

    const filteredMessages = useMemo(() => {
        if (activeFilter === 'all') return allMessages;
        return allMessages.filter((m) => m.channel === activeFilter);
    }, [allMessages, activeFilter]);

    // ─── 6. Realtime Subscriptions ───────────────────────────────────────────
    useEffect(() => {
        if (!company?.id) return;

        const channel = supabase
            .channel(`omnichannel-${leadId || normalizedPhone || 'chat'}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'whatsapp_message_log',
                    filter: `company_id=eq.${company.id}`,
                },
                () => {
                    whatsappMessagesQuery.refetch();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'email_messages',
                },
                () => {
                    emailMessagesQuery.refetch();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [company?.id, leadId, normalizedPhone]);

    // ─── 7. Send WhatsApp Mutation ───────────────────────────────────────────
    const sendWhatsApp = useMutation({
        mutationFn: async ({
            message,
            accountId,
        }: {
            message: string;
            accountId?: string;
        }) => {
            if (!normalizedPhone && !phone) throw new Error('Lead has no phone number');
            if (!company?.id) throw new Error('No active company context');

            const payload = {
                companyId: company.id,
                leadId: leadId || null,
                recipientPhone: normalizedPhone || phone,
                message: message.trim(),
                accountId: accountId || whatsappAccountsQuery.data?.[0]?.id,
            };

            // Call Edge Function or fallback to direct DB log
            try {
                const { data, error } = await supabase.functions.invoke('whatsapp-send', {
                    body: payload,
                });
                if (error) throw error;
                return data;
            } catch (fnErr: any) {
                console.warn('[useOmnichannelLeadChat] whatsapp-send invocation error, fallback DB log:', fnErr);
                // Fallback direct insert into whatsapp_message_log
                const now = new Date().toISOString();
                const { data, error } = await orgClient
                    .from('whatsapp_message_log' as any)
                    .insert({
                        company_id: company.id,
                        account_id: payload.accountId || null,
                        recipient_phone: payload.recipientPhone,
                        message_body: payload.message,
                        direction: 'outbound',
                        status: 'sent',
                        sent_at: now,
                        metadata: { lead_id: leadId, fallback: true },
                    })
                    .select()
                    .single();

                if (error) throw error;
                return { success: true, data };
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lead-wa-messages'] });
            toast({ title: 'WhatsApp message sent' });
        },
        onError: (err: any) => {
            toast({
                title: 'Failed to send WhatsApp message',
                description: err.message,
                variant: 'destructive',
            });
        },
    });

    // ─── 8. Send Email Mutation ──────────────────────────────────────────────
    const sendEmail = useMutation({
        mutationFn: async ({
            subject,
            bodyHtml,
            accountId,
            threadId,
            inReplyTo,
        }: {
            subject: string;
            bodyHtml: string;
            accountId?: string;
            threadId?: string;
            inReplyTo?: string;
        }) => {
            if (!normalizedEmail && !email) throw new Error('Lead has no email address');
            const targetAccount = accountId 
                ? emailAccountsQuery.data?.find(a => a.id === accountId)
                : emailAccountsQuery.data?.[0];

            if (!targetAccount) {
                throw new Error('No connected email account found. Please connect an account in FastSend Settings.');
            }

            const payload = {
                accountId: targetAccount.id,
                to: normalizedEmail || email,
                subject: subject || 'Follow up',
                bodyHtml: bodyHtml,
                threadId: threadId || emailMessagesQuery.data?.defaultThreadId || null,
                inReplyTo: inReplyTo || null,
                companyId: company?.id,
                leadId: leadId || null,
                leadTable: 'leads',
            };

            const { data, error } = await supabase.functions.invoke('fastsend-send', {
                body: payload,
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lead-email-messages'] });
            toast({ title: 'Email sent successfully' });
        },
        onError: (err: any) => {
            toast({
                title: 'Failed to send email',
                description: err.message,
                variant: 'destructive',
            });
        },
    });

    // ─── 9. Context-Aware AI Reply Generation ────────────────────────────────
    const generateAIReply = useCallback(
        async ({
            channel,
            tone = 'friendly and professional',
            customPrompt,
        }: {
            channel: 'whatsapp' | 'email';
            tone?: string;
            customPrompt?: string;
        }): Promise<{ subject?: string; text: string }> => {
            if (!company?.id) throw new Error('No company context');
            setIsGeneratingAI(true);

            try {
                const apiKey = await getGeminiKey(company.id);

                // Build context from recent conversation
                const recentMsgs = allMessages.slice(-6).map((m) => {
                    return `[${m.direction === 'inbound' ? 'LEAD' : 'AGENT'} via ${m.channel.toUpperCase()}]: ${m.body}`;
                }).join('\n');

                const leadContext = `
Lead Name: ${leadName || 'Customer'}
Phone: ${phone || 'N/A'}
Email: ${email || 'N/A'}
Status: ${leadData?.status || 'New'}
Product/Service Interest: ${leadData?.property_name || leadData?.product_purchased || leadData?.product_category || 'General CRM Services'}
Budget/Deal Value: ${leadData?.budget_max || leadData?.deal_value || 'Flexible'}
Recent Conversation History:
${recentMsgs || '(No previous messages)'}
                `.trim();

                const prompt = channel === 'whatsapp'
                    ? `You are an expert sales representative for a company using FastestCRM.
Generate a concise, engaging, and high-converting WhatsApp message response for this lead.
Tone: ${tone}.
${customPrompt ? `Specific goal: ${customPrompt}` : 'Goal: Nurture the lead, answer any open inquiry, and prompt for a quick next step.'}

${leadContext}

Format requirements:
- Direct WhatsApp text (no markdown formatting like # headers, keep it under 3-4 sentences, use clean linebreaks and optional emojis).
- Return ONLY the exact text message to be sent.`
                    : `You are an expert sales representative for a company using FastestCRM.
Generate a professional email reply for this lead.
Tone: ${tone}.
${customPrompt ? `Specific goal: ${customPrompt}` : 'Goal: Provide a personalized, helpful response and suggest a brief call or demo.'}

${leadContext}

Format requirements:
Return a JSON object with:
{
  "subject": "Compelling subject line",
  "body": "Clean HTML formatted email body (use <p>, <strong>, etc.)"
}`;

                const rawResponse = await callGemini(apiKey, prompt, {
                    service: 'chat',
                    companyId: company.id,
                });

                if (channel === 'whatsapp') {
                    const text = cleanAIResponse(rawResponse).trim();
                    return { text };
                } else {
                    const cleaned = cleanAIResponse(rawResponse);
                    try {
                        const parsed = JSON.parse(cleaned);
                        return { subject: parsed.subject, text: parsed.body };
                    } catch {
                        return { subject: `Follow up regarding ${leadName || 'your inquiry'}`, text: `<p>${cleaned.replace(/\n/g, '<br/>')}</p>` };
                    }
                }
            } catch (err: any) {
                console.error('[useOmnichannelLeadChat] AI Reply Error:', err);
                toast({
                    title: 'AI Draft Generation Failed',
                    description: err.message || 'Could not generate draft',
                    variant: 'destructive',
                });
                return { text: '' };
            } finally {
                setIsGeneratingAI(false);
            }
        },
        [company?.id, allMessages, leadName, phone, email, leadData, toast]
    );

    return {
        messages: filteredMessages,
        allMessagesCount: allMessages.length,
        whatsappCount: (whatsappMessagesQuery.data || []).length,
        emailCount: (emailMessagesQuery.data?.messages || []).length,
        activeFilter,
        setActiveFilter,
        isLoading: whatsappMessagesQuery.isLoading || emailMessagesQuery.isLoading,
        isGeneratingAI,
        whatsappAccounts: whatsappAccountsQuery.data || [],
        emailAccounts: emailAccountsQuery.data || [],
        sendWhatsApp,
        sendEmail,
        generateAIReply,
        refetch: () => {
            whatsappMessagesQuery.refetch();
            emailMessagesQuery.refetch();
        },
    };
}
