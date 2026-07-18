import React, { useState, useEffect } from 'react';
import { 
  Bot, Zap, Target, Sparkles, Brain, ArrowUpRight, 
  Activity, Globe, Wand2, ShieldCheck, CheckCircle2, 
  AlertCircle, Clock, ChevronRight, LayoutDashboard,
  Cpu, Rocket, BarChart3, Fingerprint, Power, Eye
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PremiumCard, PremiumCardContent, PremiumCardDescription, PremiumCardHeader, PremiumCardTitle } from '@/components/ui/PremiumCard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useLeadsTable } from '@/hooks/useLeadsTable';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AIMissionControl() {
    const { tableName, companyId, loading: tableLoading } = useLeadsTable();
    const { company } = useCompany();
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [autopilot, setAutopilot] = useState(false);
    const [isUpdatingAutopilot, setIsUpdatingAutopilot] = useState(false);

    // 1. Fetch Real-time Activity
    const { data: activity, isLoading: isActivityLoading } = useQuery({
        queryKey: ['ai-mission-activity', company?.id],
        queryFn: async () => {
            if (!company?.id) return [];
            
            const { data: notifs } = await supabase
                .from('notifications')
                .select('id, title, message, created_at, type')
                .order('created_at', { ascending: false })
                .limit(10);

            const { data: campaignLogs } = await supabase
                .from('email_campaign_logs')
                .select('id, status, error_message, sent_at, recipient_email')
                .order('sent_at', { ascending: false })
                .limit(5);

            const merged = [
                ...(notifs?.map(n => ({
                    id: `n-${n.id}`,
                    agent: 'Ops Agent',
                    type: n.type,
                    message: n.message,
                    time: new Date(n.created_at),
                    status: 'system_log'
                })) || []),
                ...(campaignLogs?.map(cl => ({
                    id: `cl-${cl.id}`,
                    agent: 'Closing Assistant',
                    type: 'outreach',
                    message: cl.error_message ? `Failed to reach ${cl.recipient_email}` : `Sent sequence to ${cl.recipient_email}`,
                    time: new Date(cl.sent_at || Date.now()),
                    status: cl.status
                })) || [])
            ].sort((a, b) => b.time.getTime() - a.time.getTime());

            return merged.length > 0 ? merged : [{
                id: 'standby',
                agent: 'AI Core',
                type: 'status',
                message: 'System reporting 100% health. Waiting for market triggers or user commands.',
                time: new Date(),
                status: 'standby'
            }];
        },
        enabled: !!company?.id
    });

    // 2. Fetch Strategic Pulse (Next Best Actions)
    const { data: recommendations } = useQuery({
        queryKey: ['ai-strategic-pulse', company?.id],
        queryFn: async () => {
            if (!company?.id) return [];
            
            // Fetch pending decisions
            const { data: decisions } = await supabase
                .from('ai_ops_decisions' as any)
                .select('*, leads(name, status)')
                .eq('status', 'pending_approval')
                .limit(3);

            // Fetch high-confidence triggers
            const { data: triggers } = await supabase
                .from('autonomous_market_triggers')
                .select('*')
                .order('confidence_score', { ascending: false })
                .limit(2);

            return [
                ...(decisions?.map(d => ({
                    id: d.id,
                    type: 'decision',
                    title: `Lead Intervention: ${d.leads?.name}`,
                    description: d.reasoning,
                    priority: 'high',
                    actionLabel: 'Approve Action',
                    path: '/dashboard/ai-ops'
                })) || []),
                ...(triggers?.map(t => ({
                    id: t.id,
                    type: 'trigger',
                    title: `Market Trigger: ${t.event_type}`,
                    description: t.summary,
                    priority: 'medium',
                    actionLabel: 'View leads',
                    path: '/dashboard/market-scout'
                })) || [])
            ];
        },
        enabled: !!company?.id
    });

    // 3. Fetch Key Metrics
    const { data: metrics } = useQuery({
        queryKey: ['ai-mission-metrics', companyId, tableName],
        queryFn: async () => {
            if (!companyId || !tableName || tableLoading) return null;
            const { data: leads } = await supabase
                .from(tableName as any)
                .select('id, status, enrichment_status')
                .eq('company_id', companyId);
            const { count: triggers } = await supabase.from('autonomous_market_triggers').select('*', { count: 'exact', head: true });
            
            const total = leads?.length || 0;
            const enriched = leads?.filter(l => l.enrichment_status === 'enriched').length || 0;
            const deals = leads?.filter(l => ['paid', 'interested', 'replied'].includes(l.status)).length || 0;

            return {
                autonomyLevel: total > 0 ? Math.round((enriched / total) * 100) : 0,
                scoutTriggers: triggers || 0,
                dealsClosed: deals,
                leadsTotal: total,
                growthVelocity: enriched > 0 ? `+${Math.round((enriched/total)*100)}%` : '0%'
            };
        },
        enabled: !!companyId && !tableLoading
    });

    // 4. Fetch Autopilot Settings
    useEffect(() => {
        if (!company?.id) return;
        
        const fetchSettings = async () => {
            const { data } = await supabase
                .from('autonomous_growth_settings')
                .select('auto_approve_stagnant_leads')
                .eq('company_id', company.id)
                .maybeSingle();
            
            if (data) setAutopilot(data.auto_approve_stagnant_leads);
        };
        
        fetchSettings();

        // Real-time Subscriptions
        const channels = [
            supabase.channel('mission-notifications')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
                    queryClient.invalidateQueries({ queryKey: ['ai-mission-activity'] });
                }).subscribe(),
            supabase.channel('mission-decisions')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_ops_decisions' }, () => {
                    queryClient.invalidateQueries({ queryKey: ['ai-strategic-pulse'] });
                }).subscribe()
        ];

        return () => { channels.forEach(c => supabase.removeChannel(c)); };
    }, [company?.id, queryClient]);

    const toggleAutopilot = async (enabled: boolean) => {
        if (!company?.id) return;
        setIsUpdatingAutopilot(true);
        try {
            const { error } = await supabase
                .from('autonomous_growth_settings')
                .update({ auto_approve_stagnant_leads: enabled })
                .eq('company_id', company.id);

            if (error) throw error;
            setAutopilot(enabled);
            toast({
                title: enabled ? "Autopilot Engaged" : "Manual Approval Mode",
                description: enabled ? "AI will now execute re-engagements automatically." : "System will wait for your signature before key actions.",
                variant: "default"
            });
        } catch (err: any) {
            toast({ title: "Update Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsUpdatingAutopilot(false);
        }
    };

    return (
        <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 bg-slate-950/20">
            {/* ─── NEW ENHANCED HEADER ─── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.1)]">
                            <ShieldCheck className="h-7 w-7 text-primary animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white via-slate-300 to-slate-500 bg-clip-text text-transparent" style={{ fontFamily: "'Syne', sans-serif" }}>
                                Mission Control
                            </h2>
                            <div className="flex items-center gap-3 mt-1">
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Global Ops: Live</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest flex items-center gap-1.5">
                                    <Fingerprint className="h-3 w-3" /> System Auth: Encrypted • {format(new Date(), 'HH:mm:ss')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/50 backdrop-blur-xl">
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Autonomous Enlistment</span>
                        <span className={`text-xs font-black ${autopilot ? 'text-primary' : 'text-amber-400'}`}>
                            {autopilot ? 'FULL PILOT' : 'SEMI-AUTO'}
                        </span>
                    </div>
                    <Switch 
                        checked={autopilot} 
                        onCheckedChange={toggleAutopilot} 
                        disabled={isUpdatingAutopilot}
                        className="data-[state=checked]:bg-primary"
                    />
                    <div className="h-8 w-px bg-slate-800" />
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                        <LayoutDashboard className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* ─── AGENT VITALITY GRID ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { name: 'Fastest Scout', status: 'Scanning Market', efficiency: 98, icon: Globe, color: 'text-purple-400', bg: 'bg-purple-500/10', path: '/dashboard/fastest-scout', task: 'Monitoring TechCrunch triggers' },
                    { name: 'Growth Hacker', status: 'Loop Optimization', efficiency: 92, icon: Wand2, color: 'text-blue-400', bg: 'bg-blue-500/10', path: '/dashboard/ai-growth-hacker', task: 'Analyzing lead velocity' },
                    { name: 'Closing Assistant', status: 'Negotiating', efficiency: 87, icon: Sparkles, color: 'text-emerald-400', bg: 'bg-emerald-500/10', path: '/dashboard/fastsend', task: 'Managing 12 active threads' },
                    { name: 'Ops Manager', status: 'Auditing Leads', efficiency: 100, icon: ShieldCheck, color: 'text-amber-400', bg: 'bg-amber-500/10', path: '/dashboard/ai-ops', task: 'Checking stagnation flags' },
                ].map((agent) => (
                    <PremiumCard key={agent.name} className="group cursor-pointer hover:border-primary/40 transition-all border-slate-800/50 bg-slate-900/20" onClick={() => navigate(agent.path)}>
                        <PremiumCardContent className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-2.5 rounded-xl ${agent.bg} ${agent.color}`}>
                                    <agent.icon className="h-5 w-5" />
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase">Efficiency</span>
                                    <div className="text-sm font-black text-white">{agent.efficiency}%</div>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors">{agent.name}</h4>
                                <p className="text-[10px] text-slate-400 flex items-center gap-1.5 font-medium italic">
                                    <Cpu className="h-3 w-3" /> {agent.task}
                                </p>
                            </div>
                            <div className="mt-4 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase">{agent.status}</span>
                                </div>
                                <ArrowUpRight className="h-3 w-3 text-slate-600 group-hover:text-primary transition-all" />
                            </div>
                        </PremiumCardContent>
                    </PremiumCard>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
                
                {/* ─── STRATEGIC PULSE & THOUGHT STREAM ─── */}
                <div className="space-y-6">
                    {/* Next Best Actions */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: "'Syne', sans-serif" }}>
                                <Zap className="h-5 w-5 text-primary" /> Strategic Pulse
                            </h3>
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">3 CRITICAL TASKS</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {recommendations?.length === 0 ? (
                                <div className="col-span-full p-8 border border-dashed border-slate-800 rounded-2xl text-center text-slate-500">
                                    <Eye className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">Strategic horizon clear. Monitoring signals...</p>
                                </div>
                            ) : recommendations?.map((rec) => (
                                <div key={rec.id} className="p-4 rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-950 border border-slate-800 hover:border-primary/30 transition-all group">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="secondary" className={`text-[9px] uppercase ${rec.priority === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-primary/10 text-primary'}`}>
                                            {rec.priority} PRIORITY
                                        </Badge>
                                        {rec.type === 'decision' ? <Activity className="h-4 w-4 text-amber-500" /> : <Target className="h-4 w-4 text-purple-500" />}
                                    </div>
                                    <h4 className="text-sm font-bold text-white mb-1">{rec.title}</h4>
                                    <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">{rec.description}</p>
                                    <Button size="sm" onClick={() => navigate(rec.path)} className="w-full h-8 text-[11px] font-bold uppercase tracking-wider gradient-primary group-hover:glow-strong">
                                        {rec.actionLabel} <ChevronRight className="h-3 w-3 ml-1" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Intelligence Thought Stream */}
                    <PremiumCard className="overflow-hidden border-slate-800/50 bg-slate-900/10 backdrop-blur-3xl">
                        <PremiumCardHeader className="border-b border-white/5 bg-white/5 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <PremiumCardTitle className="text-sm flex items-center gap-2 tracking-widest uppercase">
                                        <Brain className="h-4 w-4 text-primary" /> Intelligence Stream
                                    </PremiumCardTitle>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[8px] font-black text-primary animate-pulse">LIVE FEED</div>
                                </div>
                            </div>
                        </PremiumCardHeader>
                        <PremiumCardContent className="p-0">
                            <ScrollArea className="h-[450px]">
                                <div className="divide-y divide-white/5">
                                    {activity?.map((item) => (
                                        <div key={item.id} className="p-5 hover:bg-primary/5 transition-all group border-l-2 border-l-transparent hover:border-l-primary">
                                            <div className="flex gap-4">
                                                <div className={`mt-1 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                                    item.agent === 'Ops Agent' ? 'bg-amber-500/5 border-amber-500/20 text-amber-500' :
                                                    item.agent === 'Closing Assistant' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' :
                                                    'bg-primary/5 border-primary/20 text-primary'
                                                }`}>
                                                    {item.agent === 'Ops Agent' ? <ShieldCheck className="h-4 w-4" /> :
                                                     item.agent === 'Closing Assistant' ? <Sparkles className="h-4 w-4" /> :
                                                     <Bot className="h-4 w-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.agent}</span>
                                                        <span className="text-[9px] font-mono text-slate-600">{format(item.time, 'HH:mm:ss')}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-200 leading-relaxed font-medium">{item.message}</p>
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[9px] py-0 border-slate-800 bg-slate-900/50 text-slate-400 capitalize">{item.status.replace('_', ' ')}</Badge>
                                                        {item.status === 'standby' && (
                                                            <button onClick={() => navigate('/dashboard/market-scout')} className="text-[9px] font-black text-primary uppercase hover:underline">Initial Scan →</button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </PremiumCardContent>
                    </PremiumCard>
                </div>

                {/* ─── RIGHT PANEL: PERFORMANCE & ROI ─── */}
                <div className="space-y-6">
                    <PremiumCard className="border-slate-800/50 bg-slate-900/20">
                        <PremiumCardHeader>
                            <PremiumCardTitle className="text-sm uppercase tracking-widest text-slate-500">Workforce Impact</PremiumCardTitle>
                        </PremiumCardHeader>
                        <PremiumCardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Human-Hours Saved</span>
                                    <div className="text-2xl font-black text-white">{Math.round((metrics?.leadsTotal || 0) * 0.4)}h</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">AI Conversion</span>
                                    <div className="text-2xl font-black text-emerald-500">{metrics?.growthVelocity}</div>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-bold uppercase">
                                    <span className="text-slate-400">Autonomy Score</span>
                                    <span className="text-primary">{metrics?.autonomyLevel}%</span>
                                </div>
                                <Progress value={metrics?.autonomyLevel} className="h-1.5 bg-slate-800" />
                                <p className="text-[10px] text-slate-500 leading-relaxed italic">
                                    Target: 95% autonomy for full hands-off growth.
                                </p>
                            </div>
                        </PremiumCardContent>
                    </PremiumCard>

                    <div className="p-6 rounded-3xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/20 relative overflow-hidden group">
                        <Rocket className="absolute -bottom-4 -right-4 h-24 w-24 text-primary/5 group-hover:text-primary/10 transition-all rotate-12" />
                        <h4 className="text-lg font-black text-white mb-2" style={{ fontFamily: "'Syne', sans-serif" }}>Enlist New Agent</h4>
                        <p className="text-xs text-slate-400 mb-6 leading-relaxed">Expand your workforce with specialized agents for SEO, Social Listening, or CRM Audit.</p>
                        <Button className="w-full h-11 gradient-primary shadow-lg shadow-primary/20 font-bold uppercase tracking-widest text-[11px]" onClick={() => navigate('/dashboard/fastest-ai')}>
                            Open AI Hub
                        </Button>
                    </div>

                    <PremiumCard className="border-slate-800/50 bg-slate-900/10">
                        <PremiumCardHeader className="pb-2">
                            <PremiumCardTitle className="text-xs text-slate-500 uppercase">System Health</PremiumCardTitle>
                        </PremiumCardHeader>
                        <PremiumCardContent className="space-y-3">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">LLM Response Time</span>
                                <span className="font-mono text-emerald-500">420ms</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">Memory Pressure</span>
                                <span className="font-mono text-slate-300">12%</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">API Uptime</span>
                                <span className="font-mono text-emerald-500">99.99%</span>
                            </div>
                        </PremiumCardContent>
                    </PremiumCard>
                </div>
            </div>
        </div>
    );
}
