import React, { useState } from 'react';
import { Inbox, RefreshCcw, ArrowLeft, Users, Reply, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useEmailInbox } from '@/hooks/useEmailInbox';

export function InboxTab() {
    const { threads, isLoadingThreads, useMessages, syncEmails, markAsRead } = useEmailInbox();
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const { data: messages, isLoading: isLoadingMessages } = useMessages(selectedThreadId);
    const [replyText, setReplyText] = useState('');
    const { company } = useCompany();
    const { accounts } = useEmailAccounts();
    const queryClient = useQueryClient();
    
    const sendReply = useMutation({
        mutationFn: async () => {
            const thread = threads.find(t => t.id === selectedThreadId);
            if (!thread || !replyText.trim()) return;

            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

            // Get the last inbound message to get message_id for threading
            const lastInbound = [...(messages || [])].reverse().find(m => m.direction === 'inbound');

            const res = await fetch(`https://${projectId}.supabase.co/functions/v1/fastsend-send`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountId: thread.email_account_id,
                    to: lastInbound?.from_address || thread.subject.match(/<(.+?)>/)?.[1] || '',
                    subject: thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`,
                    bodyHtml: `<p>${replyText.replace(/\n/g, '<br/>')}</p>`,
                    companyId: company?.id,
                    threadId: thread.id,
                    inReplyTo: lastInbound?.message_id || null,
                    references: lastInbound?.message_id || null
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to send reply');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Reply sent!');
            setReplyText('');
            queryClient.invalidateQueries({ queryKey: ['email-messages', selectedThreadId] });
            queryClient.invalidateQueries({ queryKey: ['email-threads'] });
        },
        onError: (err: any) => {
            toast.error(err.message);
        }
    });

    // Auto-mark as read when thread is selected
    React.useEffect(() => {
        if (selectedThreadId) {
            const thread = threads.find(t => t.id === selectedThreadId);
            if (thread && !thread.is_read) {
                markAsRead.mutate(selectedThreadId);
            }
        }
    }, [selectedThreadId, threads, markAsRead]);

    if (isLoadingThreads) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="grid lg:grid-cols-[350px_1fr] gap-0 border rounded-xl bg-card overflow-hidden h-[calc(100vh-280px)] min-h-[500px]">
            {/* Sidebar: Thread List */}
            <div className="border-r flex flex-col bg-muted/10">
                <div className="p-4 border-b flex justify-between items-center bg-card">
                    <h3 className="font-semibold flex items-center gap-2"><Inbox className="h-4 w-4" /> Inbox</h3>
                    <Button variant="ghost" size="icon" onClick={() => syncEmails.mutate()} disabled={syncEmails.isPending}>
                        <RefreshCcw className={`h-4 w-4 ${syncEmails.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                    {threads.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            No messages found. Click refresh to sync.
                        </div>
                    ) : (
                        threads.map(thread => (
                            <div 
                                key={thread.id} 
                                onClick={() => { setSelectedThreadId(thread.id); setReplyText(''); }}
                                className={`p-4 border-b cursor-pointer transition-colors hover:bg-muted/50 ${selectedThreadId === thread.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''} ${!thread.is_read ? 'bg-blue-50/30' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-sm truncate pr-2 ${!thread.is_read ? 'font-bold' : 'font-medium'}`}>
                                        {thread.subject}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                                        {format(new Date(thread.last_message_at), 'MMM d')}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                    {thread.snippet || 'No preview available'}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main: Message View */}
            <div className="flex flex-col bg-card overflow-hidden">
                {selectedThreadId ? (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-muted/5">
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSelectedThreadId(null)}>
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <div>
                                    <h4 className="font-bold text-base leading-none">
                                        {threads.find(t => t.id === selectedThreadId)?.subject}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Thread ID: {selectedThreadId}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Users className="h-3.5 w-3.5" /> View Lead
                                </Button>
                                <Button size="sm" className="gap-2">
                                    <Reply className="h-3.5 w-3.5" /> Reply
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/5">
                            {isLoadingMessages ? (
                                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
                            ) : (
                                messages?.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm border ${msg.direction === 'outbound' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'}`}>
                                            <div className="flex justify-between items-center mb-2 gap-4">
                                                <span className="text-xs font-bold opacity-80">
                                                    {msg.direction === 'outbound' ? 'You' : msg.from_address}
                                                </span>
                                                <span className="text-[10px] opacity-60">
                                                    {format(new Date(msg.received_at), 'MMM d, h:mm a')}
                                                </span>
                                            </div>
                                            <div 
                                                className={`text-sm leading-relaxed prose prose-sm max-w-none ${msg.direction === 'outbound' ? 'text-white prose-invert' : 'text-foreground'}`}
                                                dangerouslySetInnerHTML={{ __html: msg.body_html || `<p>${msg.body_text}</p>` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t bg-muted/5">
                            <div className="relative group">
                                <Textarea 
                                    placeholder="Type your reply here..." 
                                    className="min-h-[100px] pr-12 focus-visible:ring-primary shadow-inner"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    disabled={sendReply.isPending}
                                />
                                <Button 
                                    size="icon" 
                                    className="absolute bottom-3 right-3 h-8 w-8 shadow-md"
                                    onClick={() => sendReply.mutate()}
                                    disabled={!replyText.trim() || sendReply.isPending}
                                >
                                    {sendReply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Reply className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12">
                        <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                            <Mail className="h-10 w-10 opacity-20" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">Select a thread</h3>
                        <p className="max-w-[300px] text-center text-sm">
                            Choose a conversation from the left to view the full message history and reply.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
