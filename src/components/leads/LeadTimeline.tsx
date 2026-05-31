import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Mail, MessageSquare, History, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTeam } from '@/hooks/useTeam';
import { formatLeadHistoryEntry } from '@/lib/leadHistory';

interface LeadTimelineProps {
    leadId: string;
    email: string | null;
    phone: string | null;
    leadHistory: any[];
}

export function LeadTimeline({ leadId, email, phone, leadHistory }: LeadTimelineProps) {
    const { members } = useTeam();

    const { data: interactions, isLoading } = useQuery({
        queryKey: ['lead-interactions', leadId, leadHistory, members],
        queryFn: async () => {
            const results: any[] = [];

            // 1. Fetch WhatsApp logs
            if (phone) {
                const { data: waLogs } = await supabase
                    .from('whatsapp_message_log' as any)
                    .select('*')
                    .eq('recipient_phone', phone)
                    .order('sent_at', { ascending: false });
                
                if (waLogs) {
                    waLogs.forEach((log: any) => {
                        results.push({
                            id: log.id,
                            timestamp: new Date(log.sent_at),
                            type: 'whatsapp',
                            content: log.message_body,
                            status: log.status,
                            icon: <MessageSquare className="h-4 w-4" />,
                            color: "text-green-500",
                            bgColor: "bg-green-500/10"
                        });
                    });
                }
            }

            // 2. Fetch Email logs
            if (email) {
                const { data: emailLogs } = await supabase
                    .from('email_campaign_logs' as any)
                    .select('*')
                    .eq('recipient_email', email)
                    .order('sent_at', { ascending: false });
                
                if (emailLogs) {
                    emailLogs.forEach((log: any) => {
                        results.push({
                            id: log.id,
                            timestamp: new Date(log.sent_at),
                            type: 'email',
                            content: log.subject,
                            status: log.status,
                            icon: <Mail className="h-4 w-4" />,
                            color: "text-blue-500",
                            bgColor: "bg-blue-500/10"
                        });
                    });
                }
            }

            // 3. Add Lead History
            if (leadHistory && Array.isArray(leadHistory)) {
                leadHistory.forEach((h: any, index: number) => {
                    const timestampStr = h.date_time || h.timestamp || h.at;
                    let dateVal = new Date();
                    try {
                        if (timestampStr) {
                            const parsedDate = new Date(timestampStr);
                            if (!isNaN(parsedDate.getTime())) {
                                dateVal = parsedDate;
                            }
                        }
                    } catch (e) {
                        console.error(e);
                    }

                    results.push({
                        id: `history-${index}`,
                        timestamp: dateVal,
                        type: 'history',
                        content: formatLeadHistoryEntry(h, members),
                        status: 'completed',
                        icon: <History className="h-4 w-4" />,
                        color: "text-slate-500",
                        bgColor: "bg-slate-500/10"
                    });
                });
            }

            // Sort by timestamp descending
            return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        },
        enabled: !!leadId,
    });


    if (isLoading) {
        return <div className="flex items-center justify-center p-8 text-muted-foreground">Loading timeline...</div>;
    }

    if (!interactions || interactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl border-slate-200 dark:border-slate-800">
                <Clock className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                <p className="text-sm text-muted-foreground font-medium">No Recent Activity</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Interactions will appear here as they happen.</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-[400px] pr-4">
            <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent dark:before:via-slate-800">
                {interactions.map((item) => (
                    <div key={item.id} className="relative flex items-start group">
                        {/* Dot / Icon */}
                        <div className={cn(
                            "absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white dark:border-slate-950 shadow-sm transition-transform group-hover:scale-110",
                            item.bgColor,
                            item.color
                        )}>
                            {item.icon}
                        </div>

                        {/* Content Card */}
                        <div className="ml-14 flex-1 pt-0.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
                                    {item.type}
                                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                                    {format(item.timestamp, 'MMM d, h:mm a')}
                                </span>
                                <Badge variant="outline" className={cn(
                                    "w-fit text-[10px] h-4 px-1.5",
                                    item.status === 'failed' || item.status === 'error' ? "border-red-200 text-red-600 bg-red-50" : 
                                    item.status === 'sent' || item.status === 'delivered' || item.status === 'completed' ? "border-green-200 text-green-600 bg-green-50" :
                                    "border-slate-200 text-slate-600 bg-slate-50"
                                )}>
                                    {item.status}
                                </Badge>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-sm transition-colors hover:border-slate-300 dark:hover:border-slate-700">
                                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {item.content}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}
