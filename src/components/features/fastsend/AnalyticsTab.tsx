import React from 'react';
import { BarChart, Loader2, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useEmailCampaigns } from '@/hooks/useEmailCampaigns';

export function AnalyticsTab() {
    const { campaigns, isLoading } = useEmailCampaigns();

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>;

    const activeCampaigns = campaigns.filter(c => c.status !== 'draft');

    return (
        <div className="space-y-6">
            {activeCampaigns.length === 0 && (
                <div className="text-center py-12 border rounded-lg bg-card">
                    <BarChart className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
                    <h3 className="font-medium text-lg">No analytics yet</h3>
                    <p className="text-muted-foreground">Start a campaign to see analytics here.</p>
                </div>
            )}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {activeCampaigns.map(camp => (
                    <AnalyticsCard key={camp.id} campaign={camp} />
                ))}
            </div>
        </div>
    );
}

function AnalyticsCard({ campaign }: { campaign: any }) {
    const { useCampaignAnalytics } = useEmailCampaigns();
    const { data: stats } = useCampaignAnalytics(campaign.id);

    if (!stats) return <Card><CardContent className="p-6"><Loader2 className="animate-spin h-4 w-4" /></CardContent></Card>;

    return (
        <Card className="hover:border-primary/30 transition-colors">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base truncate" title={campaign.name}>{campaign.name}</CardTitle>
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className={campaign.status === 'active' ? 'bg-green-500' : ''}>
                        {campaign.status}
                    </Badge>
                </div>
                <CardDescription className="flex items-center gap-1"><Send className="h-3 w-3" />{stats.sent} emails sent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 pt-2">
                    <div className="space-y-1 text-center">
                        <div className="text-2xl font-bold text-blue-500">{stats.openRate}%</div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Open Rate</span>
                        <Progress value={stats.openRate} className="h-1" />
                    </div>
                    <div className="space-y-1 text-center">
                        <div className="text-2xl font-bold text-green-500">{stats.replyRate}%</div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Reply Rate</span>
                        <Progress value={stats.replyRate} className="h-1" />
                    </div>
                    <div className="space-y-1 text-center">
                        <div className="text-2xl font-bold text-purple-500">{stats.clickRate}%</div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Click Rate</span>
                        <Progress value={stats.clickRate} className="h-1" />
                    </div>
                </div>
                
                <div className="grid grid-cols-4 gap-2 pt-4 border-t text-center text-xs">
                    <div><div className="font-semibold">{stats.total}</div><div className="text-muted-foreground">Total</div></div>
                    <div><div className="font-semibold text-primary">{stats.sent}</div><div className="text-muted-foreground">Sent</div></div>
                    <div><div className="font-semibold text-blue-500">{stats.opened}</div><div className="text-muted-foreground">Opens</div></div>
                    <div><div className="font-semibold text-red-500">{stats.bounced + stats.failed}</div><div className="text-muted-foreground">Failed</div></div>
                </div>
            </CardContent>
        </Card>
    );
}
