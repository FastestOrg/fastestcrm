/**
 * OmnichannelLeadDrawer.tsx — Slide-out Omnichannel Conversation Drawer
 *
 * Opens directly within AllLeads and CRM tables so sales reps can reply
 * to WhatsApp and Email conversations with zero page reloads or navigation loss.
 */

import React from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { OmnichannelLeadChat } from './OmnichannelLeadChat';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, MessageSquare, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OmnichannelLeadDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lead: any;
    onViewDetails?: (lead: any) => void;
}

export function OmnichannelLeadDrawer({
    open,
    onOpenChange,
    lead,
    onViewDetails,
}: OmnichannelLeadDrawerProps) {
    if (!lead) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background border-l shadow-2xl">
                {/* Header */}
                <SheetHeader className="p-4 border-b bg-card/60 backdrop-blur-md">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <div className="flex items-center gap-2">
                                <SheetTitle className="text-lg font-bold truncate">
                                    {lead.name || 'Lead Conversation'}
                                </SheetTitle>
                                {lead.status && (
                                    <Badge variant="outline" className="text-[10px] capitalize bg-primary/5 text-primary border-primary/20">
                                        {lead.status.replace(/_/g, ' ')}
                                    </Badge>
                                )}
                            </div>
                            <SheetDescription className="flex items-center gap-3 text-xs mt-1 text-muted-foreground">
                                {lead.phone && (
                                    <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3 text-emerald-500" />
                                        {lead.phone}
                                    </span>
                                )}
                                {lead.email && (
                                    <span className="flex items-center gap-1">
                                        <Mail className="h-3 w-3 text-blue-500" />
                                        {lead.email}
                                    </span>
                                )}
                            </SheetDescription>
                        </div>

                        {onViewDetails && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    onOpenChange(false);
                                    onViewDetails(lead);
                                }}
                            >
                                Details <ExternalLink className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </SheetHeader>

                {/* Main Unified Chat Stream */}
                <div className="flex-1 p-3 overflow-hidden">
                    <OmnichannelLeadChat
                        lead={lead}
                        className="h-full border-0 shadow-none rounded-none"
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
}
