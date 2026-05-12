import { useState, useEffect } from 'react';
// DashboardLayout removed
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Workflow, Plus, Zap, ArrowRight, Mail, Phone, UserPlus, Loader2, Trash2, ArrowRightLeft, Bell, RefreshCw } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { automationService, Automation } from '@/services/automationService';
import { CreateAutomationDialog } from '@/components/automations/CreateAutomationDialog';
import { WorkflowCanvas } from '@/components/automations/WorkflowCanvas';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const EXAMPLE_AUTOMATIONS = [
    {
        icon: <Bell className="h-5 w-5 text-primary" />,
        trigger: 'New Lead Assigned',
        action: 'Send Welcome Email',
        description: 'Instantly email new leads when they are assigned to you.',
    },
    {
        icon: <RefreshCw className="h-5 w-5 text-primary" />,
        trigger: 'Status → Interested',
        action: 'Notify Manager',
        description: 'Alert your manager the moment a lead becomes interested.',
    },
    {
        icon: <Zap className="h-5 w-5 text-primary" />,
        trigger: 'Follow-up Due',
        action: 'Webhook Trigger',
        description: 'Push data to your CRM or Zapier on follow-up deadlines.',
    },
];

export default function Automations() {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'visual'>('visual');
    const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
    const { toast } = useToast();

    const fetchAutomations = async () => {
        try {
            const data = await automationService.getAutomations();
            setAutomations(data);
        } catch (error) {
            console.error('Failed to fetch automations', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAutomations();
    }, []);

    const handleToggle = async (id: string, currentState: boolean) => {
        try {
            await automationService.toggleAutomation(id, currentState);
            setAutomations(automations.map(a =>
                a.id === id ? { ...a, is_active: !currentState } : a
            ));
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update automation status",
                variant: 'destructive'
            });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await automationService.deleteAutomation(id);
            setAutomations(automations.filter(a => a.id !== id));
            toast({ title: "Deleted", description: "Automation deleted successfully" });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete automation",
                variant: 'destructive'
            });
        }
    };

    const getIconForType = (type: string) => {
        switch (type) {
            case 'send_email': return <Mail className="h-4 w-4" />;
            case 'webhook': return <Zap className="h-4 w-4" />;
            default: return <Workflow className="h-4 w-4" />;
        }
    };

    const formatConfig = (config: any) => {
        if (!config) return '';
        if (config.to_status) return `to ${config.to_status}`;
        if (config.url) return 'Webhook';
        if (config.subject) return config.subject;
        return '';
    };

    return (
        <>
            <div className="p-4 md:p-8 space-y-6 md:space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Workflow Automations</h1>
                        <p className="text-muted-foreground">Automate repetitive tasks and scale your sales process.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-[180px]">
                            <TabsList className="grid grid-cols-2">
                                <TabsTrigger value="list">List</TabsTrigger>
                                <TabsTrigger value="visual">Visual</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Button className="gradient-primary w-full sm:w-auto" onClick={() => setIsCreateOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Automation
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {automations.length === 0 ? (
                            <div className="space-y-6">
                                <div className="text-center py-10 px-6 rounded-2xl border border-dashed border-border bg-muted/10">
                                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                        <Workflow className="h-8 w-8 text-primary" />
                                    </div>
                                    <h2 className="text-lg font-semibold mb-1">No automations yet</h2>
                                    <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
                                        Set up your first workflow to save time and never miss a follow-up.
                                    </p>
                                    <Button className="gradient-primary" onClick={() => setIsCreateOpen(true)}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create Your First Automation
                                    </Button>
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
                                        Popular automations
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {EXAMPLE_AUTOMATIONS.map((ex, i) => (
                                            <div
                                                key={i}
                                                className="rounded-xl border border-border bg-card/50 p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors cursor-pointer"
                                                onClick={() => setIsCreateOpen(true)}
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    {ex.icon}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground mb-1.5">
                                                        <span className="bg-muted px-2 py-0.5 rounded-full">{ex.trigger}</span>
                                                        <ArrowRight className="h-3 w-3 shrink-0" />
                                                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">{ex.action}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground leading-snug">{ex.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : viewMode === 'list' ? (
                            automations.map((auto) => (
                                <Card key={auto.id} className="glass hover:border-primary/50 transition-colors">
                                    <CardContent className="p-4 md:p-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-4 min-w-0">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${auto.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                                                    <Workflow className={`h-5 w-5 ${auto.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-semibold text-base mb-1.5 leading-snug">{auto.name}</h3>
                                                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                                        <Badge variant="outline" className="bg-background flex items-center gap-1 text-xs">
                                                            {auto.trigger_type.replace('_', ' ')}
                                                            {formatConfig(auto.trigger_config) && (
                                                                <span className="opacity-60 ml-0.5">{formatConfig(auto.trigger_config)}</span>
                                                            )}
                                                        </Badge>
                                                        <ArrowRight className="h-3 w-3 shrink-0" />
                                                        <Badge variant="outline" className="bg-background flex items-center gap-1 text-xs">
                                                            {getIconForType(auto.action_type)}
                                                            {auto.action_type.replace('_', ' ')}
                                                            {formatConfig(auto.action_config) && (
                                                                <span className="opacity-60 ml-0.5">{formatConfig(auto.action_config)}</span>
                                                            )}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                                                <span className="text-xs text-muted-foreground hidden sm:inline">
                                                    {auto.is_active ? 'Active' : 'Paused'}
                                                </span>
                                                <Switch
                                                    checked={auto.is_active}
                                                    onCheckedChange={() => handleToggle(auto.id, auto.is_active)}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                                                    onClick={() => handleDelete(auto.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                          <WorkflowCanvas 
                            automations={automations} 
                            onNodeClick={(auto) => {
                                setEditingAutomation(auto);
                                setIsCreateOpen(true);
                            }} 
                          />
                        )}
                    </div>
                )}

                <CreateAutomationDialog
                    isOpen={isCreateOpen}
                    automation={editingAutomation}
                    onOpenChange={(open) => {
                        setIsCreateOpen(open);
                        if (!open) setEditingAutomation(null);
                    }}
                    onSuccess={fetchAutomations}
                />
            </div>
        </>
    );
}
