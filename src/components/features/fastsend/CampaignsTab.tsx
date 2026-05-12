import React from 'react';
import { Mail, Users, Target, CalendarClock, Play, Pause, Trash2, Loader2, Bot, ChevronRight, Edit2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useEmailCampaigns } from '@/hooks/useEmailCampaigns';

export function CampaignsTab(props: { 
    onEdit: (campaign: any) => void; 
    onDuplicate: (campaign: any) => void;
    onOpenDetail: (campaign: any) => void 
}) {
    const { campaigns, isLoading, startCampaign, pauseCampaign, resumeCampaign, deleteCampaign } = useEmailCampaigns();

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>;

    return (
        <div className="space-y-4">
            <div className="grid gap-4">
                {campaigns.map(camp => (
                    <Card key={camp.id} className="group hover:border-primary/40 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-primary/5" onClick={() => props.onOpenDetail(camp)}>
                        <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-4">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-semibold text-lg">{camp.name}</h4>
                                    <Badge variant={camp.status === 'active' ? 'default' : camp.status === 'completed' ? 'secondary' : 'outline'} className={camp.status === 'active' ? 'bg-green-500' : ''}>
                                        {camp.status.toUpperCase()}
                                    </Badge>
                                    <Badge variant="outline" className="capitalize">{camp.campaign_mode} AI</Badge>
                                    {(camp as any).ai_auto_reply_enabled && (
                                        <Badge variant="outline" className="border-purple-400/50 text-purple-400 gap-1 animate-pulse">
                                            <Bot className="h-3 w-3" /> AI Autopilot
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground flex gap-4 flex-wrap">
                                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Recipients: {camp.recipient_count}</span>
                                    <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Goal: {camp.campaign_goal.replace('_', ' ')}</span>
                                    <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {format(new Date(camp.created_at), 'MMM d, yyyy')}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 w-full md:w-auto" onClick={e => e.stopPropagation()}>
                                <CampaignAnalyticsBadge campaignId={camp.id} recipientCount={camp.recipient_count} />

                                {(camp.status === 'draft' || camp.status === 'scheduled') && (
                                    <Button size="sm" onClick={() => startCampaign.mutate(camp.id)} disabled={startCampaign.isPending}>
                                        {startCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                        Start
                                    </Button>
                                )}
                                {camp.status === 'active' && (
                                    <Button variant="outline" size="sm" onClick={() => pauseCampaign.mutate(camp.id)} disabled={pauseCampaign.isPending}>
                                        {pauseCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pause className="mr-2 h-4 w-4" />}
                                        Pause
                                    </Button>
                                )}
                                {camp.status === 'paused' && (
                                    <Button variant="outline" size="sm" onClick={() => resumeCampaign.mutate(camp.id)} disabled={resumeCampaign.isPending}>
                                        {resumeCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                        Resume
                                    </Button>
                                )}
                                {(camp.status === 'draft' || camp.status === 'scheduled' || camp.status === 'paused') && (
                                    <Button variant="outline" size="sm" onClick={() => props.onEdit(camp)}>
                                        <Edit2 className="mr-2 h-4 w-4" /> Edit
                                    </Button>
                                )}
                                <Button variant="outline" size="sm" onClick={() => props.onDuplicate(camp)}>
                                    <Copy className="mr-2 h-4 w-4" /> Duplicate
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => {
                                    if(confirm('Delete this campaign? This cannot be undone.')) deleteCampaign.mutate(camp.id);
                                }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
                
                {campaigns.length === 0 && (
                    <div className="text-center py-12 border rounded-lg bg-card">
                        <Mail className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
                        <h3 className="font-medium text-lg">No campaigns yet</h3>
                        <p className="text-muted-foreground">Click "New Campaign" to create your first AI-powered drip sequence.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Mini component to fetch and show analytics on the campaign card
export function CampaignAnalyticsBadge({ campaignId, recipientCount }: { campaignId: string; recipientCount: number }) {
    const { useCampaignAnalytics } = useEmailCampaigns();
    const { data: stats } = useCampaignAnalytics(campaignId);

    if (!stats) return null;

    return (
        <div className="flex gap-3 px-4 py-2 bg-muted/30 rounded-lg mr-2 text-sm border items-center">
            <div className="text-center">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Sent</span>
                <p className="font-bold text-primary">{stats.sent}<span className="text-muted-foreground font-normal">/{recipientCount}</span></p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Open</span>
                <p className="font-semibold text-blue-500">{stats.openRate}%</p>
            </div>
            <div className="text-center">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Reply</span>
                <p className="font-semibold text-green-500">{stats.replyRate}%</p>
            </div>
        </div>
    );
}
