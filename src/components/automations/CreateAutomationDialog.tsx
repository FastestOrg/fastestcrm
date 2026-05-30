
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Loader2, Check, ChevronsUpDown, X } from 'lucide-react';
import { automationService, TriggerType, ActionType } from '@/services/automationService';
import { useTeam } from '@/hooks/useTeam';
import { useForms } from '@/hooks/useForms';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAICallerAgents } from '@/hooks/useAICallerAgents';
import { PhoneCall, Bot } from 'lucide-react';

interface CreateAutomationDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    automation?: Automation | null;
}

export function CreateAutomationDialog({ isOpen, onOpenChange, onSuccess, automation }: CreateAutomationDialogProps) {
    const [name, setName] = useState('');
    const [triggerType, setTriggerType] = useState<TriggerType>('lead_created');
    const [actionType, setActionType] = useState<ActionType>('send_email');
    const [loading, setLoading] = useState(false);

    // Trigger Config State
    const [triggerConfig, setTriggerConfig] = useState<any>({});

    // Action Config State
    const [actionConfig, setActionConfig] = useState<any>({});

    const { toast } = useToast();
    const { members } = useTeam();
    const { data: forms, isLoading: isLoadingForms } = useForms();
    const { agents: aiAgents, isLoading: isLoadingAgents } = useAICallerAgents();

    // Populate state for editing
    useEffect(() => {
        if (automation) {
            setName(automation.name);
            setTriggerType(automation.trigger_type);
            setActionType(automation.action_type);
            setTriggerConfig(automation.trigger_config || {});
            setActionConfig(automation.action_config || {});
        } else {
            setName('');
            setTriggerType('lead_created');
            setActionType('send_email');
            setTriggerConfig({});
            setActionConfig({});
        }
    }, [automation, isOpen]);

    // Reset config when action type changes
    useEffect(() => {
        if (!automation) {
            setActionConfig({});
        }
    }, [actionType, automation]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;

        setLoading(true);
        try {
            if (automation?.id) {
                await automationService.updateAutomation(automation.id, {
                    name,
                    trigger_type: triggerType,
                    trigger_config: triggerConfig,
                    action_type: actionType,
                    action_config: actionConfig
                });
                toast({ title: 'Success', description: 'Automation updated successfully' });
            } else {
                await automationService.createAutomation({
                    name,
                    trigger_type: triggerType,
                    trigger_config: triggerConfig,
                    action_type: actionType,
                    action_config: actionConfig
                });
                toast({ title: 'Success', description: 'Automation created successfully' });
            }

            onSuccess();
            onOpenChange(false);
            if (!automation) {
                setName('');
                setTriggerConfig({});
                setActionConfig({});
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const toggleUserSelection = (userId: string) => {
        const currentUsers = actionConfig.target_users || [];
        let newUsers;
        if (currentUsers.includes(userId)) {
            newUsers = currentUsers.filter((id: string) => id !== userId);
        } else {
            newUsers = [...currentUsers, userId];
        }
        setActionConfig({ ...actionConfig, target_users: newUsers });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{automation ? 'Edit Automation' : 'Create New Automation'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Automation Name</Label>
                        <Input
                            placeholder="Name your Workflow"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Trigger Section */}
                        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">When this happens...</h3>
                            <div className="space-y-2">
                                <Label>Trigger</Label>
                                <Select
                                    value={triggerType}
                                    onValueChange={(val) => setTriggerType(val as TriggerType)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="lead_created">New Lead Created</SelectItem>
                                        <SelectItem value="form_submitted">New Form Submitted</SelectItem>
                                        <SelectItem value="status_changed">Lead Status Changed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {triggerType === 'form_submitted' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Select Form</Label>
                                        <Select
                                            value={triggerConfig.form_id || ''}
                                            onValueChange={(val) => setTriggerConfig({ ...triggerConfig, form_id: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a form" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {isLoadingForms ? (
                                                    <SelectItem value="loading" disabled>Loading forms...</SelectItem>
                                                ) : (
                                                    forms?.map(form => (
                                                        <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="flex justify-between items-center">
                                            Conditions
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    const currentConditions = triggerConfig.conditions || [];
                                                    setTriggerConfig({
                                                        ...triggerConfig,
                                                        conditions: [...currentConditions, { field: '', operator: 'equals', value: '' }]
                                                    });
                                                }}
                                            >
                                                + Add
                                            </Button>
                                        </Label>

                                        {triggerConfig.conditions?.map((idx: number, index: number) => (
                                            <div key={index} className="flex gap-2 items-center">
                                                <Input
                                                    placeholder="Field (e.g. city)"
                                                    className="flex-1"
                                                    value={triggerConfig.conditions[index].field}
                                                    onChange={(e) => {
                                                        const newConditions = [...triggerConfig.conditions];
                                                        newConditions[index].field = e.target.value;
                                                        setTriggerConfig({ ...triggerConfig, conditions: newConditions });
                                                    }}
                                                />
                                                <Select
                                                    value={triggerConfig.conditions[index].operator}
                                                    onValueChange={(val) => {
                                                        const newConditions = [...triggerConfig.conditions];
                                                        newConditions[index].operator = val;
                                                        setTriggerConfig({ ...triggerConfig, conditions: newConditions });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-[110px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="equals">=</SelectItem>
                                                        <SelectItem value="not_equals">!=</SelectItem>
                                                        <SelectItem value="contains">contains</SelectItem>
                                                        <SelectItem value="greater_than">&gt;</SelectItem>
                                                        <SelectItem value="less_than">&lt;</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Input
                                                    placeholder="Value"
                                                    className="flex-1"
                                                    value={triggerConfig.conditions[index].value}
                                                    onChange={(e) => {
                                                        const newConditions = [...triggerConfig.conditions];
                                                        newConditions[index].value = e.target.value;
                                                        setTriggerConfig({ ...triggerConfig, conditions: newConditions });
                                                    }}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => {
                                                        const newConditions = triggerConfig.conditions.filter((_: any, i: number) => i !== index);
                                                        setTriggerConfig({ ...triggerConfig, conditions: newConditions });
                                                    }}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {triggerType === 'status_changed' && (
                                <div className="space-y-2">
                                    <Label>To Status</Label>
                                    <Select
                                        value={triggerConfig.to_status}
                                        onValueChange={(val) => setTriggerConfig({ ...triggerConfig, to_status: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="New">New</SelectItem>
                                            <SelectItem value="Contacted">Contacted</SelectItem>
                                            <SelectItem value="Qualified">Qualified</SelectItem>
                                            <SelectItem value="Won">Won</SelectItem>
                                            <SelectItem value="Lost">Lost</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* Action Section */}
                        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">...Do this</h3>
                            <div className="space-y-2">
                                <Label>Action</Label>
                                <Select
                                    value={actionType}
                                    onValueChange={(val) => setActionType(val as ActionType)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="send_email">Send Email</SelectItem>
                                        <SelectItem value="ai_personalized_followup">AI Personalized Follow-up</SelectItem>
                                        <SelectItem value="ai_call">
                                            <div className="flex items-center gap-2">
                                                <PhoneCall className="h-3.5 w-3.5 text-primary" />
                                                AI Phone Call
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="webhook">Call Webhook</SelectItem>
                                        <SelectItem value="assign_lead">Assign Lead</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {actionType === 'ai_call' && (
                                <div className="space-y-3">
                                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 mb-2 flex items-start gap-2">
                                        <PhoneCall className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-[11px] text-primary font-medium">AI CALLER MODE</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                An AI agent will call the lead using Gemini 3.1 Flash Live via Vobiz telephony.
                                                Calls are queued and processed sequentially.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>AI Caller Agent</Label>
                                        <Select
                                            value={actionConfig.agent_id || ''}
                                            onValueChange={(val) => setActionConfig({ ...actionConfig, agent_id: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={isLoadingAgents ? 'Loading agents...' : 'Select an AI agent'} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {aiAgents.length === 0 ? (
                                                    <SelectItem value="none" disabled>
                                                        No agents — create one in FastEngage → AI Caller
                                                    </SelectItem>
                                                ) : (
                                                    aiAgents.filter(a => a.is_active).map(agent => (
                                                        <SelectItem key={agent.id} value={agent.id}>
                                                            <div className="flex items-center gap-2">
                                                                <Bot className="h-3.5 w-3.5 text-primary" />
                                                                {agent.name}
                                                            </div>
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {aiAgents.length === 0 && !isLoadingAgents && (
                                            <p className="text-xs text-orange-500">
                                                ⚠ No active agents found.{' '}
                                                <a href="/dashboard/ai-caller" className="underline">Create an AI agent first →</a>
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Custom Call Instructions <span className="text-muted-foreground font-normal">(optional)</span></Label>
                                        <Textarea
                                            placeholder="Override agent prompt for this specific automation, e.g. 'Start the call by asking about their budget range'"
                                            value={actionConfig.custom_instructions || ''}
                                            onChange={(e) => setActionConfig({ ...actionConfig, custom_instructions: e.target.value })}
                                            className="min-h-[80px]"
                                        />
                                    </div>
                                </div>
                            )}

                            {actionType === 'ai_personalized_followup' && (
                                <div className="space-y-3">
                                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 mb-2">
                                        <p className="text-[11px] text-primary font-medium flex items-center gap-1">
                                            <Loader2 className="h-3 w-3 animate-pulse" /> 
                                            AGENTIC MODE ENABLED
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            The AI will analyze the lead profile and recent history to craft a unique message.
                                        </p>
                                    </div>
                                    <Label>Instructions for AI Agent</Label>
                                    <Textarea
                                        placeholder="e.g. Ask them if they're still looking for a 2BHK in Mumbai. Mention our 15% discount for this month."
                                        value={actionConfig.instructions || ''}
                                        onChange={(e) => setActionConfig({ ...actionConfig, instructions: e.target.value })}
                                        className="min-h-[100px]"
                                    />
                                    <div className="flex items-center space-x-2 pt-2">
                                        <Switch 
                                            id="auto-send" 
                                            checked={actionConfig.auto_send || false} 
                                            onCheckedChange={(val) => setActionConfig({ ...actionConfig, auto_send: val })}
                                        />
                                        <Label htmlFor="auto-send" className="text-xs cursor-pointer">Auto-send without review</Label>
                                    </div>
                                </div>
                            )}

                            {actionType === 'send_email' && (
                                <div className="space-y-2">
                                    <Label>Subject</Label>
                                    <Input
                                        placeholder="Email Subject"
                                        value={actionConfig.subject || ''}
                                        onChange={(e) => setActionConfig({ ...actionConfig, subject: e.target.value })}
                                    />
                                    <Label>Message Body</Label>
                                    <Input
                                        placeholder="Hello {{name}}, ..."
                                        value={actionConfig.body || ''}
                                        onChange={(e) => setActionConfig({ ...actionConfig, body: e.target.value })}
                                    />
                                </div>
                            )}

                            {actionType === 'webhook' && (
                                <div className="space-y-2">
                                    <Label>Webhook URL</Label>
                                    <Input
                                        placeholder="https://api.example.com/webhook"
                                        value={actionConfig.url || ''}
                                        onChange={(e) => setActionConfig({ ...actionConfig, url: e.target.value })}
                                    />
                                </div>
                            )}

                            {actionType === 'assign_lead' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Distribution Logic</Label>
                                        <Select
                                            value={actionConfig.distribution_logic || ''}
                                            onValueChange={(val) => setActionConfig({ ...actionConfig, distribution_logic: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Logic" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="round_robin">Round Robin</SelectItem>
                                                <SelectItem value="random">Random</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Select Users</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className="w-full justify-between h-auto min-h-[40px]"
                                                >
                                                    <span className="truncate">
                                                        {actionConfig.target_users && actionConfig.target_users.length > 0
                                                            ? `${actionConfig.target_users.length} users selected`
                                                            : "Select users..."}
                                                    </span>
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[300px] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search users..." />
                                                    <CommandList>
                                                        <CommandEmpty>No user found.</CommandEmpty>
                                                        <CommandGroup className="max-h-[200px] overflow-y-auto">
                                                            {members.map((member) => (
                                                                <CommandItem
                                                                    key={member.id}
                                                                    value={member.full_name || member.email || member.id}
                                                                    onSelect={() => toggleUserSelection(member.id)}
                                                                >
                                                                    <div
                                                                        className={cn(
                                                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                            actionConfig.target_users?.includes(member.id)
                                                                                ? "bg-primary text-primary-foreground"
                                                                                : "opacity-50 [&_svg]:invisible"
                                                                        )}
                                                                    >
                                                                        <Check className={cn("h-4 w-4")} />
                                                                    </div>
                                                                    <span>{member.full_name || member.email}</span>
                                                                    <Badge variant="secondary" className="ml-auto text-xs">
                                                                        {member.role}
                                                                    </Badge>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Selected users will receive leads based on the chosen logic.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Automation
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
