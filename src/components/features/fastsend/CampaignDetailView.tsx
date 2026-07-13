import React, { useMemo, useState } from 'react';
import { ArrowLeft, Pause, Play, Zap, Users, Send, Eye, Reply, MousePointerClick, XCircle, BarChart, AlignLeft, Activity, Brain, Bot, Sparkles, Search, Filter, CheckCircle2, Clock, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { useEmailCampaigns, EmailCampaign } from '@/hooks/useEmailCampaigns';

export function CampaignDetailView({ campaign, onBack, onEdit }: { campaign: EmailCampaign; onBack: () => void; onEdit: (campaign: EmailCampaign) => void }) {
    const { useCampaignAnalytics, useCampaignRecipients, useCampaignLogs, startCampaign, pauseCampaign, resumeCampaign } = useEmailCampaigns();
    const { data: stats } = useCampaignAnalytics(campaign.id);
    const { data: recipients } = useCampaignRecipients(campaign.id);
    const { data: logs } = useCampaignLogs({ campaignId: campaign.id });
    
    const [recipientFilter, setRecipientFilter] = useState('all');
    const [recipientSearch, setRecipientSearch] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    const filteredRecipients = useMemo(() => {
        if (!recipients) return [];
        let filtered = recipients as any[];
        if (recipientFilter !== 'all') filtered = filtered.filter(r => r.status === recipientFilter);
        if (recipientSearch) {
            const q = recipientSearch.toLowerCase();
            filtered = filtered.filter(r => (r.lead_name || '').toLowerCase().includes(q) || (r.lead_email || '').toLowerCase().includes(q));
        }
        return filtered;
    }, [recipients, recipientFilter, recipientSearch]);

    const statusColors: Record<string, string> = {
        pending: 'bg-gray-500/20 text-gray-400',
        in_progress: 'bg-blue-500/20 text-blue-400',
        completed: 'bg-emerald-500/20 text-emerald-400',
        replied: 'bg-green-500/20 text-green-400',
        bounced: 'bg-orange-500/20 text-orange-400',
        failed: 'bg-red-500/20 text-red-400',
        unsubscribed: 'bg-yellow-500/20 text-yellow-400',
    };

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold tracking-tight">{campaign.name}</h2>
                            <Badge variant={campaign.status === 'active' ? 'default' : 'outline'} className={campaign.status === 'active' ? 'bg-green-500' : ''}>
                                {campaign.status.toUpperCase()}
                            </Badge>
                            {(campaign as any).ai_auto_reply_enabled && (
                                <Badge variant="outline" className="border-purple-400/50 text-purple-400 gap-1">
                                    <Bot className="h-3 w-3 animate-pulse" /> AI Autopilot Active
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Created {format(new Date(campaign.created_at), 'MMM d, yyyy')} • Goal: {campaign.campaign_goal.replace('_', ' ')} • {campaign.campaign_mode} AI
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {campaign.status === 'active' && (
                        <Button variant="outline" size="sm" onClick={() => pauseCampaign.mutate(campaign.id)}><Pause className="mr-2 h-4 w-4" /> Pause</Button>
                    )}
                    {campaign.status === 'paused' && (
                        <Button size="sm" onClick={() => resumeCampaign.mutate(campaign.id)}><Play className="mr-2 h-4 w-4" /> Resume</Button>
                    )}
                    {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                        <Button size="sm" onClick={() => startCampaign.mutate(campaign.id)}><Zap className="mr-2 h-4 w-4" /> Launch Campaign</Button>
                    )}
                    {(campaign.status === 'draft' || campaign.status === 'scheduled' || campaign.status === 'paused') && (
                        <Button variant="outline" size="sm" onClick={() => onEdit(campaign)}><Edit2 className="mr-2 h-4 w-4" /> Edit</Button>
                    )}
                </div>
            </div>

            {/* Hero Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                        { label: 'Recipients', value: stats.total, icon: Users, color: 'text-foreground' },
                        { label: 'Emails Sent', value: stats.sent, icon: Send, color: 'text-primary' },
                        { label: 'Opened', value: stats.opened, icon: Eye, color: 'text-blue-500', sub: `${stats.openRate}%` },
                        { label: 'Replied', value: stats.replied, icon: Reply, color: 'text-green-500', sub: `${stats.replyRate}%` },
                        { label: 'Clicked', value: stats.clicked, icon: MousePointerClick, color: 'text-purple-500', sub: `${stats.clickRate}%` },
                        { label: 'Failed', value: stats.bounced + stats.failed, icon: XCircle, color: 'text-red-500' },
                    ].map((stat) => (
                        <Card key={stat.label} className="border-border/50 bg-card/50 backdrop-blur">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <stat.icon className={`h-4 w-4 ${stat.color} opacity-70`} />
                                    {stat.sub && <span className={`text-xs font-semibold ${stat.color}`}>{stat.sub}</span>}
                                </div>
                                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                                <p className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wider">{stat.label}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Sending Progress */}
            {stats && stats.total > 0 && (
                <Card className="border-border/50">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Campaign Progress</span>
                            <span className="text-xs text-muted-foreground">{stats.sent} of {stats.total} emails sent ({Math.round((stats.sent / Math.max(stats.total, 1)) * 100)}%)</span>
                        </div>
                        <Progress value={(stats.sent / Math.max(stats.total, 1)) * 100} className="h-2" />
                    </CardContent>
                </Card>
            )}

            {/* Tabs: Overview / Recipients / Activity */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-muted/50">
                    <TabsTrigger value="overview" className="gap-2"><BarChart className="h-3.5 w-3.5" /> Overview</TabsTrigger>
                    <TabsTrigger value="recipients" className="gap-2"><Users className="h-3.5 w-3.5" /> Recipients ({stats?.total || 0})</TabsTrigger>
                    <TabsTrigger value="activity" className="gap-2"><Activity className="h-3.5 w-3.5" /> Activity Log</TabsTrigger>
                </TabsList>

                {/* OVERVIEW Tab */}
                <TabsContent value="overview" className="mt-4 space-y-6">
                    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
                        {/* Sequence Steps */}
                        <Card>
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base flex items-center gap-2"><AlignLeft className="h-4 w-4" /> Sequence Performance</CardTitle>
                                <CardDescription>{stats?.totalSteps || 0} email steps in this campaign</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {stats?.stepStats?.map((step: any, idx: number) => (
                                    <div key={idx} className="relative border rounded-lg p-4 bg-muted/20">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">{step.stepNumber}</div>
                                                <div>
                                                    <p className="font-medium text-sm line-clamp-1">{step.subject}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase">{step.condition.replace('_', ' ')}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-4 gap-3 text-center text-xs">
                                            <div><span className="font-bold text-lg text-primary block">{step.sent}</span><span className="text-muted-foreground">Sent</span></div>
                                            <div><span className="font-bold text-lg text-blue-500 block">{step.opened}</span><span className="text-muted-foreground">Opened</span></div>
                                            <div><span className="font-bold text-lg text-green-500 block">{step.replied}</span><span className="text-muted-foreground">Replied</span></div>
                                            <div><span className="font-bold text-lg text-purple-500 block">{step.clicked}</span><span className="text-muted-foreground">Clicked</span></div>
                                        </div>
                                        {step.sent > 0 && (
                                            <div className="mt-3 flex gap-1">
                                                <div className="h-1.5 rounded-full bg-blue-500/80" style={{ width: `${(step.opened / step.sent) * 100}%` }} />
                                                <div className="h-1.5 rounded-full bg-green-500/80" style={{ width: `${(step.replied / step.sent) * 100}%` }} />
                                                <div className="h-1.5 rounded-full bg-muted flex-1" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(!stats?.stepStats || stats.stepStats.length === 0) && (
                                    <p className="text-center text-muted-foreground py-8">No sequence data yet</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* AI Agent Panel */}
                        <div className="space-y-4">
                            <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Brain className="h-4 w-4 text-purple-400" /> AI Agent Intelligence
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${(campaign as any).ai_auto_reply_enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                                            <span className="text-sm font-medium">Autopilot Mode</span>
                                        </div>
                                        <Badge variant={(campaign as any).ai_auto_reply_enabled ? 'default' : 'secondary'}>
                                            {(campaign as any).ai_auto_reply_enabled ? 'ACTIVE' : 'OFF'}
                                        </Badge>
                                    </div>
                                    <div className="space-y-3 text-sm">
                                        <div>
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Campaign Goal</span>
                                            <p className="font-medium capitalize mt-1">{campaign.campaign_goal.replace('_', ' ')}</p>
                                        </div>
                                        {(campaign as any).ai_perspective && (
                                            <div>
                                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Perspective</span>
                                                <p className="text-muted-foreground mt-1 line-clamp-3">{(campaign as any).ai_perspective}</p>
                                            </div>
                                        )}
                                    </div>
                                    {(campaign as any).ai_auto_reply_enabled && (
                                        <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                                                <span className="text-xs font-semibold text-purple-400">AI STATUS</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                AI is autonomously engaging with leads who reply. FastAI analyzes conversation context and responds to move toward your campaign goal.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Status Breakdown */}
                            {stats && (
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">Recipient Status</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {[
                                            { label: 'Pending', count: (stats as any).pending, color: 'bg-gray-500' },
                                            { label: 'In Progress', count: (stats as any).in_progress, color: 'bg-blue-500' },
                                            { label: 'Completed', count: (stats as any).completed, color: 'bg-emerald-500' },
                                            { label: 'Replied', count: (stats as any).replied, color: 'bg-green-500' },
                                            { label: 'Bounced', count: (stats as any).bounced, color: 'bg-orange-500' },
                                            { label: 'Failed', count: (stats as any).failed, color: 'bg-red-500' },
                                        ].filter(s => s.count > 0).map(s => (
                                            <div key={s.label} className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                                                    <span>{s.label}</span>
                                                </div>
                                                <span className="font-semibold">{s.count}</span>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* RECIPIENTS Tab */}
                <TabsContent value="recipients" className="mt-4">
                    <Card>
                        <CardHeader className="pb-4">
                            <div className="flex flex-col sm:flex-row justify-between gap-3">
                                <CardTitle className="text-base">Recipients</CardTitle>
                                <div className="flex gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Search name or email..." className="pl-9 h-9 w-[250px]" value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} />
                                    </div>
                                    <Select value={recipientFilter} onValueChange={setRecipientFilter}>
                                        <SelectTrigger className="w-[150px] h-9"><Filter className="h-3.5 w-3.5 mr-2" /><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Status</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="in_progress">In Progress</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                            <SelectItem value="replied">Replied</SelectItem>
                                            <SelectItem value="failed">Failed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-center">Step</TableHead>
                                            <TableHead className="text-center">Opened</TableHead>
                                            <TableHead className="text-center">Replied</TableHead>
                                            <TableHead>Last Sent</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRecipients.slice(0, 100).map((r: any) => (
                                            <TableRow key={r.id} className="text-sm">
                                                <TableCell className="font-medium">{r.lead_name || '—'}</TableCell>
                                                <TableCell className="text-muted-foreground">{r.lead_email}</TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <Badge variant="outline" className={statusColors[r.status] || ''}>{r.status}</Badge>
                                                        {r.status === 'failed' && r.error_message && (
                                                            <p className="text-[10px] text-destructive max-w-[180px] break-words leading-tight" title={r.error_message}>{r.error_message}</p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">{r.current_step}/{stats?.totalSteps || '?'}</TableCell>
                                                <TableCell className="text-center">{r.opened_at ? <Eye className="h-4 w-4 text-blue-500 mx-auto" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                                                <TableCell className="text-center">{r.replied_at ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                                                <TableCell className="text-muted-foreground text-xs">{r.last_sent_at ? format(new Date(r.last_sent_at), 'MMM d, h:mm a') : '—'}</TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredRecipients.length === 0 && (
                                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No recipients match your filters</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {filteredRecipients.length > 100 && (
                                <p className="text-center py-3 text-xs text-muted-foreground border-t">Showing 100 of {filteredRecipients.length} recipients</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ACTIVITY LOG Tab */}
                <TabsContent value="activity" className="mt-4">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Email Activity Log</CardTitle>
                            <CardDescription>Recent email sends and tracking events</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y max-h-[600px] overflow-y-auto">
                                {(logs || []).slice(0, 50).map((log: any) => (
                                    <div key={log.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                            log.status === 'opened' ? 'bg-blue-500/20 text-blue-400' :
                                            log.status === 'replied' ? 'bg-green-500/20 text-green-400' :
                                            log.status === 'clicked' ? 'bg-purple-500/20 text-purple-400' :
                                            log.status === 'bounced' || log.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                            'bg-primary/20 text-primary'
                                        }`}>
                                            {log.status === 'opened' ? <Eye className="h-4 w-4" /> :
                                             log.status === 'replied' ? <Reply className="h-4 w-4" /> :
                                             log.status === 'clicked' ? <MousePointerClick className="h-4 w-4" /> :
                                             log.status === 'failed' || log.status === 'bounced' ? <XCircle className="h-4 w-4" /> :
                                             <Send className="h-4 w-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{log.recipient_email}</p>
                                            <p className="text-xs text-muted-foreground truncate">{log.subject || 'No subject'}</p>
                                            {log.error_message && (
                                                <p className="text-xs text-destructive mt-0.5 font-medium">{log.error_message}</p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <Badge variant="outline" className="text-[10px]">{log.status}</Badge>
                                            <p className="text-[10px] text-muted-foreground mt-1">{log.sent_at ? format(new Date(log.sent_at), 'MMM d, h:mm a') : ''}</p>
                                        </div>
                                    </div>
                                ))}
                                {(!logs || logs.length === 0) && (
                                    <p className="text-center py-12 text-muted-foreground">No activity yet. Start the campaign to see email sends here.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
