/**
 * OmnichannelLeadChat.tsx — Unified Real-time WhatsApp & Email Conversation Component
 *
 * Provides two-way WhatsApp & Email messaging, instant sends, delivery receipts,
 * and AI-assisted reply generation directly embedded in lead views.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useOmnichannelLeadChat, UnifiedMessage } from '@/hooks/useOmnichannelLeadChat';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Send,
    Sparkles,
    MessageSquare,
    Mail,
    Phone,
    Check,
    CheckCheck,
    Clock,
    AlertCircle,
    RefreshCw,
    Bot,
    User,
    ArrowDown,
    Maximize2,
    CornerDownLeft,
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OmnichannelLeadChatProps {
    lead: any;
    defaultChannel?: 'whatsapp' | 'email';
    className?: string;
    compact?: boolean;
}

export function OmnichannelLeadChat({
    lead,
    defaultChannel = 'whatsapp',
    className,
    compact = false,
}: OmnichannelLeadChatProps) {
    const {
        messages,
        activeFilter,
        setActiveFilter,
        allMessagesCount,
        whatsappCount,
        emailCount,
        isLoading,
        isGeneratingAI,
        whatsappAccounts,
        emailAccounts,
        sendWhatsApp,
        sendEmail,
        generateAIReply,
        refetch,
    } = useOmnichannelLeadChat({
        leadId: lead?.id,
        phone: lead?.phone || lead?.mobile_number,
        email: lead?.email,
        leadName: lead?.name,
        leadData: lead,
    });

    const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'email'>(
        lead?.phone ? 'whatsapp' : (lead?.email ? 'email' : defaultChannel)
    );
    const [selectedWaAccount, setSelectedWaAccount] = useState<string>('');
    const [selectedEmailAccount, setSelectedEmailAccount] = useState<string>('');
    const [emailSubject, setEmailSubject] = useState('');
    const [inputMessage, setInputMessage] = useState('');
    const [aiGoal, setAiGoal] = useState<string>('Follow up and ask for a quick meeting');

    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Initialize selected accounts
    useEffect(() => {
        if (whatsappAccounts.length > 0 && !selectedWaAccount) {
            setSelectedWaAccount(whatsappAccounts[0].id);
        }
        if (emailAccounts.length > 0 && !selectedEmailAccount) {
            setSelectedEmailAccount(emailAccounts[0].id);
        }
    }, [whatsappAccounts, emailAccounts, selectedWaAccount, selectedEmailAccount]);

    // Handle Send
    const handleSendMessage = async () => {
        if (!inputMessage.trim()) return;

        if (selectedChannel === 'whatsapp') {
            if (!lead?.phone) {
                toast.error('Lead does not have a phone number');
                return;
            }
            try {
                await sendWhatsApp.mutateAsync({
                    message: inputMessage,
                    accountId: selectedWaAccount || undefined,
                });
                setInputMessage('');
            } catch (err: any) {
                console.error(err);
            }
        } else {
            if (!lead?.email) {
                toast.error('Lead does not have an email address');
                return;
            }
            try {
                const subject = emailSubject.trim() || `Follow up with ${lead.name || 'you'}`;
                const bodyHtml = `<p>${inputMessage.replace(/\n/g, '<br/>')}</p>`;
                await sendEmail.mutateAsync({
                    subject,
                    bodyHtml,
                    accountId: selectedEmailAccount || undefined,
                });
                setInputMessage('');
                setEmailSubject('');
            } catch (err: any) {
                console.error(err);
            }
        }
    };

    // Handle AI Draft
    const handleGenerateAI = async () => {
        try {
            const result = await generateAIReply({
                channel: selectedChannel,
                customPrompt: aiGoal,
            });
            if (result.text) {
                setInputMessage(result.text.replace(/<[^>]*>/g, ''));
                if (result.subject && selectedChannel === 'email') {
                    setEmailSubject(result.subject);
                }
                toast.success('AI Draft generated!');
            }
        } catch (err: any) {
            console.error(err);
        }
    };

    // Render message status icon for outbound messages
    const renderStatusIcon = (status?: string) => {
        switch (status) {
            case 'read':
                return <CheckCheck className="h-3 w-3 text-emerald-400" />;
            case 'delivered':
                return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
            case 'sent':
                return <Check className="h-3 w-3 text-muted-foreground" />;
            case 'failed':
                return <AlertCircle className="h-3 w-3 text-destructive" />;
            default:
                return <Clock className="h-3 w-3 text-muted-foreground opacity-60" />;
        }
    };

    return (
        <div className={cn("flex flex-col h-[560px] max-h-[75vh] bg-background rounded-xl border border-border overflow-hidden", className)}>
            {/* ─── Header & Channel Filters ─── */}
            <div className="flex items-center justify-between p-3 border-b bg-muted/40 backdrop-blur-sm gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <Button
                        variant={activeFilter === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs font-semibold px-2.5"
                        onClick={() => setActiveFilter('all')}
                    >
                        All ({allMessagesCount})
                    </Button>
                    <Button
                        variant={activeFilter === 'whatsapp' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs font-semibold px-2.5 gap-1 text-emerald-600 dark:text-emerald-400"
                        onClick={() => setActiveFilter('whatsapp')}
                    >
                        <MessageSquare className="h-3 w-3" /> WhatsApp ({whatsappCount})
                    </Button>
                    <Button
                        variant={activeFilter === 'email' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs font-semibold px-2.5 gap-1 text-blue-600 dark:text-blue-400"
                        onClick={() => setActiveFilter('email')}
                    >
                        <Mail className="h-3 w-3" /> Email ({emailCount})
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => refetch()}
                        title="Refresh messages"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* ─── Messages Stream ─── */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-dot-grid">
                {isLoading && messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-xs">Loading conversation history...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-6 space-y-2">
                        <div className="p-3 bg-primary/10 rounded-full text-primary">
                            <MessageSquare className="h-6 w-6" />
                        </div>
                        <h4 className="font-semibold text-sm text-foreground">No messages yet</h4>
                        <p className="text-xs max-w-sm">
                            Start a two-way WhatsApp or Email conversation with {lead?.name || 'this lead'}. All replies will stream directly into this thread.
                        </p>
                    </div>
                ) : (
                    messages.map((msg: UnifiedMessage) => {
                        const isInbound = msg.direction === 'inbound';
                        const isWhatsApp = msg.channel === 'whatsapp';

                        return (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex flex-col max-w-[82%] transition-all",
                                    isInbound ? "mr-auto items-start" : "ml-auto items-end"
                                )}
                            >
                                {/* Sender Info Tag */}
                                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-muted-foreground font-medium">
                                    {isWhatsApp ? (
                                        <Badge variant="outline" className="h-3.5 px-1 text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                            WhatsApp
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="h-3.5 px-1 text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                                            Email
                                        </Badge>
                                    )}
                                    <span>{msg.sender}</span>
                                    <span>•</span>
                                    <span>{format(new Date(msg.timestamp), 'MMM d, h:mm a')}</span>
                                </div>

                                {/* Message Bubble */}
                                <div
                                    className={cn(
                                        "p-3 rounded-2xl shadow-sm text-xs relative group break-words space-y-1",
                                        isInbound
                                            ? "bg-card border border-border text-foreground rounded-tl-sm"
                                            : isWhatsApp
                                                ? "bg-emerald-600 text-white rounded-tr-sm"
                                                : "bg-primary text-primary-foreground rounded-tr-sm"
                                    )}
                                >
                                    {msg.subject && (
                                        <p className="font-semibold text-xs border-b border-white/20 pb-1 mb-1">
                                            {msg.subject}
                                        </p>
                                    )}
                                    
                                    <div className="whitespace-pre-wrap leading-relaxed">
                                        {msg.body}
                                    </div>

                                    {/* Outbound delivery status */}
                                    {!isInbound && (
                                        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-80 pt-0.5">
                                            <span>{msg.status}</span>
                                            {renderStatusIcon(msg.status)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ─── AI Draft Helper Toolbar ─── */}
            <div className="p-2 border-t bg-muted/20 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                    <Select value={aiGoal} onValueChange={setAiGoal}>
                        <SelectTrigger className="h-7 text-xs bg-background">
                            <SelectValue placeholder="AI Goal" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Follow up and ask for a quick meeting">Ask for Quick Meeting</SelectItem>
                            <SelectItem value="Introduce our best offerings and pricing">Send Price & Offerings</SelectItem>
                            <SelectItem value="Answer questions and address hesitations">Handle Objections</SelectItem>
                            <SelectItem value="Friendly check-in to see if they are still interested">Gentle Check-in</SelectItem>
                            <SelectItem value="Send a special discount with urgency">Urgent Discount Offer</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 bg-gradient-to-r from-amber-500/10 to-primary/10 hover:from-amber-500/20 hover:to-primary/20 border-primary/30 text-foreground"
                    onClick={handleGenerateAI}
                    disabled={isGeneratingAI}
                >
                    {isGeneratingAI ? (
                        <>
                            <RefreshCw className="h-3 w-3 animate-spin" /> Drafting...
                        </>
                    ) : (
                        <>
                            <Bot className="h-3.5 w-3.5 text-primary" /> AI Draft Reply
                        </>
                    )}
                </Button>
            </div>

            {/* ─── Composition & Send Box ─── */}
            <div className="p-3 bg-card border-t space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Channel Selection */}
                    <div className="flex items-center gap-2">
                        <Select
                            value={selectedChannel}
                            onValueChange={(val: any) => setSelectedChannel(val)}
                        >
                            <SelectTrigger className="h-8 w-[140px] text-xs font-semibold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="whatsapp">
                                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                                        <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                                    </div>
                                </SelectItem>
                                <SelectItem value="email">
                                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                                        <Mail className="h-3.5 w-3.5" /> Email
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Account Selector */}
                        {selectedChannel === 'whatsapp' && whatsappAccounts.length > 0 && (
                            <Select value={selectedWaAccount} onValueChange={setSelectedWaAccount}>
                                <SelectTrigger className="h-8 text-xs max-w-[180px]">
                                    <SelectValue placeholder="Select Number" />
                                </SelectTrigger>
                                <SelectContent>
                                    {whatsappAccounts.map((acc: any) => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            {acc.display_name || acc.phone_number || acc.session_id}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        {selectedChannel === 'email' && emailAccounts.length > 0 && (
                            <Select value={selectedEmailAccount} onValueChange={setSelectedEmailAccount}>
                                <SelectTrigger className="h-8 text-xs max-w-[200px]">
                                    <SelectValue placeholder="From Account" />
                                </SelectTrigger>
                                <SelectContent>
                                    {emailAccounts.map((acc: any) => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            {acc.email_address}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        {selectedChannel === 'whatsapp' ? (
                            <span>To: {lead?.phone || 'No Phone'}</span>
                        ) : (
                            <span>To: {lead?.email || 'No Email'}</span>
                        )}
                    </div>
                </div>

                {/* Email Subject line (if Email is active) */}
                {selectedChannel === 'email' && (
                    <Input
                        placeholder="Subject..."
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="h-8 text-xs bg-muted/30"
                    />
                )}

                {/* Main Textarea */}
                <div className="relative">
                    <Textarea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder={
                            selectedChannel === 'whatsapp'
                                ? `Type a WhatsApp reply to ${lead?.name || 'lead'}... (Ctrl+Enter to send)`
                                : `Compose email body... (Ctrl+Enter to send)`
                        }
                        className="min-h-[70px] max-h-[140px] text-xs resize-none pr-12 pb-3"
                    />

                    <Button
                        size="icon"
                        className={cn(
                            "absolute right-2.5 bottom-2.5 h-7 w-7 rounded-lg shadow-sm transition-all",
                            selectedChannel === 'whatsapp'
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-primary hover:bg-primary/90 text-primary-foreground"
                        )}
                        onClick={handleSendMessage}
                        disabled={
                            !inputMessage.trim() ||
                            sendWhatsApp.isPending ||
                            sendEmail.isPending
                        }
                    >
                        {sendWhatsApp.isPending || sendEmail.isPending ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Send className="h-3.5 w-3.5" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
