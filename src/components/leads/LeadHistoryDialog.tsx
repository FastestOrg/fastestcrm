import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tables } from '@/integrations/supabase/types';
import { format } from 'date-fns';
import { History } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTeam } from '@/hooks/useTeam';
import { formatLeadHistoryEntry, LeadHistoryEntry } from '@/lib/leadHistory';

type Lead = Tables<'leads'> & {
    lead_history?: LeadHistoryEntry[] | null;
};

interface LeadHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lead: Lead | null;
}

export function LeadHistoryDialog({ open, onOpenChange, lead }: LeadHistoryDialogProps) {
    const { members } = useTeam();

    if (!lead) return null;

    // Sort history by timestamp descending (newest first)
    const history = lead.lead_history
        ? [...lead.lead_history].reverse()
        : [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Lead History
                    </DialogTitle>
                    <DialogDescription>
                        History of changes for {lead.name}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4 -mr-4">
                    <div className="space-y-6 p-1">
                        {history.length > 0 ? (
                            <div className="relative border-l border-muted ml-3 space-y-6">
                                {history.map((entry, index) => {
                                    const details = formatLeadHistoryEntry(entry, members);
                                    const timestampStr = entry.date_time || entry.timestamp || '';
                                    let formattedDate = 'Unknown Time';
                                    try {
                                        const d = timestampStr ? new Date(timestampStr) : new Date();
                                        if (!isNaN(d.getTime())) {
                                            formattedDate = format(d, 'PPP p');
                                        }
                                    } catch (e) {
                                        console.error(e);
                                    }

                                    return (
                                        <div key={index} className="relative pl-6">
                                            <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border border-primary bg-background ring-4 ring-background" />
                                            <div className="space-y-1">
                                                <p className="text-sm text-foreground/80">{details}</p>
                                                <p className="text-xs text-muted-foreground">{formattedDate}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                <p>No history available for this lead.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

