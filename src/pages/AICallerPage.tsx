import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Bot, Plus, Phone, PhoneCall, PhoneOff, Pencil, Trash2,
    Clock, Mic, Globe, Sparkles, AlertTriangle, Loader2,
    BarChart2, Activity, CheckCircle2, XCircle
} from 'lucide-react';
import { useAICallerAgents, AICallerAgent } from '@/hooks/useAICallerAgents';
import { AICallerAgentDialog } from '@/components/ai-caller/AICallerAgentDialog';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { CallAudioPlayer } from '@/components/ai-caller/CallAudioPlayer';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const VOICE_COLORS: Record<string, string> = {
    Aoede: 'bg-purple-500/10 text-purple-600',
    Charon: 'bg-blue-500/10 text-blue-600',
    Fenrir: 'bg-cyan-500/10 text-cyan-600',
    Kore: 'bg-orange-500/10 text-orange-600',
    Puck: 'bg-green-500/10 text-green-600',
    Leda: 'bg-pink-500/10 text-pink-600',
};

function AgentCard({
    agent,
    onEdit,
    onDelete,
    onToggle,
    onTest,
    telephonyConnected,
}: {
    agent: AICallerAgent;
    onEdit: (a: AICallerAgent) => void;
    onDelete: (a: AICallerAgent) => void;
    onToggle: (id: string, active: boolean) => void;
    onTest: (a: AICallerAgent) => void;
    telephonyConnected: boolean;
}) {
    return (
        <Card className={cn(
            "relative overflow-hidden transition-all border",
            agent.is_active ? "border-border" : "border-border/50 opacity-60"
        )}>
            {/* Gradient accent line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" />

            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Bot className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-base leading-tight">{agent.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge className={cn("text-xs", VOICE_COLORS[agent.voice] || "bg-gray-100 text-gray-600")}>
                                    <Mic className="h-2.5 w-2.5 mr-1" />
                                    {agent.voice}
                                </Badge>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Globe className="h-3 w-3" />
                                    {agent.language}
                                </span>
                            </div>
                        </div>
                    </div>
                    <Switch
                        checked={agent.is_active}
                        onCheckedChange={(v) => onToggle(agent.id, v)}
                    />
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* System Prompt Preview */}
                <div className="p-3 rounded-md bg-muted/30 border text-xs font-mono text-muted-foreground line-clamp-3 leading-relaxed">
                    {agent.system_prompt}
                </div>

                {/* Meta info */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{agent.phone_number || 'No phone set'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Max {agent.max_duration_minutes}m</span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span>FastAI STS Latest · {agent.telephony_provider === 'tata_smartflo' ? 'Tata Smartflo' : 'Vobiz SIP'}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-1 border-t">
                    <Button
                        size="sm"
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/95"
                        onClick={() => onTest(agent)}
                        disabled={!telephonyConnected || !agent.is_active}
                    >
                        <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
                        Test Agent Call
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => onEdit(agent)}
                        >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            Edit
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => onDelete(agent)}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function TelephonyNotConnectedBanner() {
    return (
        <div className="flex items-center gap-4 p-5 rounded-xl bg-orange-500/5 border border-orange-500/20">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
            </div>
            <div>
                <p className="font-semibold text-foreground">No Telephony Provider Connected</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Connect <strong>Vobiz AI Telephony</strong> or <strong>Tata Tele Smartflo</strong> to enable AI calling. Go to{' '}
                    <a href="/dashboard/integrations" className="text-primary underline underline-offset-2">
                        Settings → Integrations
                    </a>{' '}
                    and add your credentials.
                </p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto shrink-0" asChild>
                <a href="/dashboard/integrations">Connect Provider →</a>
            </Button>
        </div>
    );
}

export default function AICallerPage() {
    const { agents, isLoading, deleteAgent, toggleAgent } = useAICallerAgents();
    const { company } = useCompany();
    const { toast } = useToast();
    const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
    const [editAgent, setEditAgent] = useState<AICallerAgent | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AICallerAgent | null>(null);
    const [testAgent, setTestAgent] = useState<AICallerAgent | null>(null);
    const [testPhoneNumber, setTestPhoneNumber] = useState('');
    const [triggeringTestCall, setTriggeringTestCall] = useState(false);

    const handleTriggerTestCall = async () => {
        if (!testAgent || !testPhoneNumber.trim() || !company?.id) return;
        setTriggeringTestCall(true);
        try {
            const { data, error } = await supabase.functions.invoke('trigger-ai-call', {
                body: {
                    lead_phone: testPhoneNumber.trim(),
                    lead_name: "Test Call Recipient",
                    agent_id: testAgent.id,
                    company_id: company.id,
                    lead_id: null,
                }
            });

            if (error) throw error;
            if (data?.success === false || (data && !data.success && data.error)) {
                throw new Error(data.error || "Failed to trigger call");
            }

            toast({
                title: "✓ Call Triggered!",
                description: "The AI caller has initiated the call. You should receive it shortly.",
            });
            setTestAgent(null);
            refetchHistory();
        } catch (err: any) {
            console.error("Test call error:", err);
            toast({
                title: "Call initiation failed",
                description: err.message || "An unexpected error occurred",
                variant: "destructive",
            });
        } finally {
            setTriggeringTestCall(false);
        }
    };

    // Check if Vobiz is connected
    const { data: vobizConfig } = useQuery({
        queryKey: ['vobiz-config', company?.id],
        queryFn: async () => {
            if (!company?.id) return null;
            const { data } = await supabase
                .from('integration_api_keys')
                .select('api_key, is_active')
                .eq('company_id', company.id)
                .eq('service_name', 'vobiz')
                .eq('is_active', true)
                .maybeSingle() as any;
            if (!data) return null;
            return typeof data.api_key === 'string' ? JSON.parse(data.api_key) : data.api_key;
        },
        enabled: !!company?.id,
    });

    // Check if Tata Smartflo is connected
    const { data: smartfloConfig } = useQuery({
        queryKey: ['smartflo-config', company?.id],
        queryFn: async () => {
            if (!company?.id) return null;
            const { data } = await supabase
                .from('integration_api_keys')
                .select('api_key, is_active')
                .eq('company_id', company.id)
                .eq('service_name', 'tata_smartflo')
                .eq('is_active', true)
                .maybeSingle() as any;
            if (!data) return null;
            return typeof data.api_key === 'string' ? JSON.parse(data.api_key) : data.api_key;
        },
        enabled: !!company?.id,
    });

    const vobizConnected = !!vobizConfig;
    const smartfloConnected = !!smartfloConfig;
    const anyTelephonyConnected = vobizConnected || smartfloConnected;
    const activeAgents = agents.filter(a => a.is_active);

    // Query for call queue / history
    const { data: callHistory, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
        queryKey: ['ai-call-history', company?.id],
        queryFn: async () => {
            if (!company?.id) return [];
            const { data, error } = await supabase
                .from('ai_caller_logs')
                .select('id, lead_name, lead_phone, created_at, status, duration_seconds, agent_id, call_recording, error')
                .eq('company_id', company.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            return data || [];
        },
        enabled: !!company?.id,
        refetchInterval: 5000, // Poll every 5s for live updates
    });

    const handleEdit = (agent: AICallerAgent) => {
        setEditAgent(agent);
        setIsAgentDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteAgent(deleteTarget.id);
            toast({ title: 'Agent deleted', description: `"${deleteTarget.name}" has been removed.` });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleToggle = async (id: string, is_active: boolean) => {
        try {
            await toggleAgent({ id, is_active });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <PhoneCall className="h-6 w-6 text-primary" />
                        AI Caller
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Configure AI agents powered by FastAI STS Latest to make intelligent outbound calls.
                    </p>
                </div>
                <Button
                    onClick={() => { setEditAgent(null); setIsAgentDialogOpen(true); }}
                    disabled={!anyTelephonyConnected}
                    className="gradient-primary"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    New Agent
                </Button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Agents', value: agents.length, icon: Bot, color: 'text-primary' },
                    { label: 'Active Agents', value: activeAgents.length, icon: CheckCircle2, color: 'text-green-500' },
                    { label: 'Telephony', value: anyTelephonyConnected ? (vobizConnected && smartfloConnected ? 'Both' : vobizConnected ? 'Vobiz' : 'Smartflo') : 'Not Set', icon: anyTelephonyConnected ? PhoneCall : PhoneOff, color: anyTelephonyConnected ? 'text-green-500' : 'text-orange-500' },
                    { label: 'AI Model', value: 'FastAI STS Latest', icon: Sparkles, color: 'text-purple-500' },
                ].map((s) => (
                    <Card key={s.label} className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg bg-muted", s.color)}>
                                <s.icon className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                                <p className="font-semibold text-sm">{s.value}</p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <Tabs defaultValue="agents">
                <TabsList>
                    <TabsTrigger value="agents">
                        <Bot className="h-4 w-4 mr-2" />
                        Agents ({agents.length})
                    </TabsTrigger>
                    <TabsTrigger value="call-history">
                        <Clock className="h-4 w-4 mr-2" />
                        Call History & Queue
                    </TabsTrigger>
                    <TabsTrigger value="how-it-works">
                        <Activity className="h-4 w-4 mr-2" />
                        How It Works
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="agents" className="mt-4 space-y-4">
                    {/* Telephony Banner if not connected */}
                    {!anyTelephonyConnected && <TelephonyNotConnectedBanner />}

                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : agents.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                                    <Bot className="h-8 w-8 text-primary" />
                                </div>
                                <h3 className="font-semibold text-lg">No AI Agents yet</h3>
                                <p className="text-muted-foreground text-sm mt-2 max-w-sm">
                                    Create your first AI caller agent. It will use FastAI STS Latest for ultra-low latency voice conversations.
                                </p>
                                <Button
                                    className="mt-6 gradient-primary"
                                    onClick={() => { setEditAgent(null); setIsAgentDialogOpen(true); }}
                                    disabled={!anyTelephonyConnected}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create First Agent
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {agents.map(agent => (
                                <AgentCard
                                    key={agent.id}
                                    agent={agent}
                                    onEdit={handleEdit}
                                    onDelete={setDeleteTarget}
                                    onToggle={handleToggle}
                                    telephonyConnected={anyTelephonyConnected}
                                    onTest={(a) => { setTestAgent(a); setTestPhoneNumber(''); }}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="how-it-works" className="mt-4">
                    <Card>
                        <CardContent className="py-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                    {
                                        step: '01',
                                        icon: PhoneCall,
                                        title: 'Call Initiated',
                                        desc: 'FastEngage sends a REST API call to your telephony provider (Vobiz or Tata Smartflo) to dial the lead\'s phone number from your DID.',
                                        color: 'bg-blue-500/10 text-blue-500',
                                    },
                                    {
                                        step: '02',
                                        icon: Activity,
                                        title: 'AI Takes Over',
                                        desc: 'When the call connects, the telephony provider streams audio via WebSocket to our bridge. FastAI STS Latest processes speech in real-time (~20ms latency).',
                                        color: 'bg-primary/10 text-primary',
                                    },
                                    {
                                        step: '03',
                                        icon: BarChart2,
                                        title: 'Post-Call Actions',
                                        desc: 'After the call ends, the provider sends a CDR webhook. FastEngage logs the call and triggers configured automations (update lead status, send follow-up, etc.)',
                                        color: 'bg-green-500/10 text-green-500',
                                    },
                                ].map(s => (
                                    <div key={s.step} className="flex flex-col gap-3">
                                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", s.color)}>
                                            <s.icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-muted-foreground">STEP {s.step}</span>
                                            <h3 className="font-semibold mt-0.5">{s.title}</h3>
                                            <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 p-4 rounded-lg bg-muted/30 border">
                                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    Queue-Based Architecture
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    When automations trigger AI calls, they're added to a company-scoped FIFO queue. Calls are processed sequentially to respect provider rate limits and ensure quality. You can monitor the queue status in real-time.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="call-history" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base">Recent AI Calls & Queue Status</CardTitle>
                                <CardDescription>Monitor outgoing AI calls, queue positions, and real-time status details.</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => refetchHistory()} className="gap-1.5">
                                <Activity className="h-3.5 w-3.5" />
                                Refresh
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {isLoadingHistory ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : !callHistory || callHistory.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-lg">
                                    No calls have been initiated yet.
                                </div>
                            ) : (
                                <div className="relative overflow-x-auto rounded-lg border">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground border-b">
                                            <tr>
                                                <th className="px-4 py-3">Recipient</th>
                                                <th className="px-4 py-3">Phone</th>
                                                <th className="px-4 py-3">Triggered</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3">Duration</th>
                                                <th className="px-4 py-3">Recording</th>
                                                <th className="px-4 py-3">Agent</th>
                                                <th className="px-4 py-3">Notes / Error</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {callHistory.map((call: any) => {
                                                const agentName = agents.find(a => a.id === call.agent_id)?.name || 'Unknown Agent';
                                                
                                                let statusBadge = (
                                                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                                                        Pending
                                                    </Badge>
                                                );
                                                if (call.status === 'calling') {
                                                    statusBadge = (
                                                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 animate-pulse">
                                                            Calling
                                                        </Badge>
                                                    );
                                                } else if (call.status === 'completed') {
                                                    statusBadge = (
                                                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                                                            Completed
                                                        </Badge>
                                                    );
                                                } else if (call.status === 'failed') {
                                                    statusBadge = (
                                                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                                                            Failed
                                                        </Badge>
                                                    );
                                                }

                                                return (
                                                    <tr key={call.id} className="hover:bg-muted/20 transition-colors">
                                                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                                                            {call.lead_name || 'Unknown'}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-mono">
                                                            {call.lead_phone}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                                                            {new Date(call.created_at).toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            {statusBadge}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                                                            {call.duration_seconds ? `${call.duration_seconds}s` : '—'}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            {call.call_recording ? (
                                                                <CallAudioPlayer url={call.call_recording} logId={call.id} />
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                                                            {agentName}
                                                        </td>
                                                        <td className="px-4 py-3 max-w-xs text-xs">
                                                            {call.error ? (
                                                                <span className="text-destructive font-medium flex items-center gap-1 leading-normal break-words">
                                                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                                                    {call.error}
                                                                </span>
                                                            ) : call.status === 'calling' ? (
                                                                <span className="text-blue-500 flex items-center gap-1">
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                    Connecting voice bridge...
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted-foreground">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Agent Dialog */}
            <AICallerAgentDialog
                isOpen={isAgentDialogOpen}
                onOpenChange={(open) => {
                    setIsAgentDialogOpen(open);
                    if (!open) setEditAgent(null);
                }}
                editAgent={editAgent}
                vobizPhoneNumber={vobizConfig?.phone_number}
                tataSmartfloPhoneNumber={smartfloConfig?.phone_number}
                vobizConnected={vobizConnected}
                smartfloConnected={smartfloConnected}
            />

            {/* Delete Confirm */}
            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Agent</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>"{deleteTarget?.name}"</strong>? This cannot be undone. Any automations using this agent will stop working.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Delete Agent
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Test Call Dialog */}
            <Dialog open={!!testAgent} onOpenChange={(open) => { if (!open) setTestAgent(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PhoneCall className="h-5 w-5 text-primary" />
                            Test Agent: {testAgent?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Enter a phone number to receive a live test call from this AI Agent.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="test-phone">Your Phone Number</Label>
                            <Input
                                id="test-phone"
                                placeholder="e.g. +919876543210 or 8447129797"
                                value={testPhoneNumber}
                                onChange={(e) => setTestPhoneNumber(e.target.value)}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Make sure the number has the country code (e.g. 91 for India) if required by your telephony provider.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTestAgent(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleTriggerTestCall}
                            disabled={triggeringTestCall || !testPhoneNumber.trim()}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {triggeringTestCall ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Calling...
                                </>
                            ) : (
                                <>
                                    <Phone className="mr-2 h-4 w-4" />
                                    Start Test Call
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
