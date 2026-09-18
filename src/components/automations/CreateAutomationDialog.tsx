import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Loader2, Check, ChevronsUpDown, X, PhoneCall, Bot, Sparkles, MessageSquare, Mail, Clock, GitBranch, Plus, Trash2 } from 'lucide-react';
import { automationService, TriggerType, ActionType, WorkflowStep, Automation } from '@/services/automationService';
import { useTeam } from '@/hooks/useTeam';
import { useForms } from '@/hooks/useForms';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAICallerAgents } from '@/hooks/useAICallerAgents';

interface CreateAutomationDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    automation?: Automation | null;
}

export function CreateAutomationDialog({ isOpen, onOpenChange, onSuccess, automation }: CreateAutomationDialogProps) {
    const [name, setName] = useState('');
    const [triggerType, setTriggerType] = useState<TriggerType>('lead_created');
    const [actionType, setActionType] = useState<ActionType>('send_whatsapp');
    const [loading, setLoading] = useState(false);

    // Sequence Mode Toggle
    const [isSequenceMode, setIsSequenceMode] = useState(false);
    const [sequenceSteps, setSequenceSteps] = useState<WorkflowStep[]>([]);

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

            const steps = automation.sequence_steps || automation.action_config?.sequence_steps;
            if (steps && steps.length > 0) {
                setIsSequenceMode(true);
                setSequenceSteps(steps);
            } else {
                setIsSequenceMode(false);
                setSequenceSteps([]);
            }
        } else {
            setName('');
            setTriggerType('lead_created');
            setActionType('send_whatsapp');
            setTriggerConfig({});
            setActionConfig({});
            setIsSequenceMode(false);
            setSequenceSteps([]);
        }
    }, [automation, isOpen]);

    // Apply Standard Drip Template
    const applyDripTemplate = () => {
        setName('Lead Welcome & Drip Follow-up');
        setTriggerType('lead_created');
        setIsSequenceMode(true);
        setSequenceSteps([
            {
                id: 'step-1',
                step_type: 'action',
                name: 'Send WhatsApp Welcome',
                action_type: 'send_whatsapp',
                action_config: {
                    message: 'Hi {{name}}, welcome to our platform! Thank you for reaching out. A specialist will be in touch shortly.'
                }
            },
            {
                id: 'step-2',
                step_type: 'delay',
                name: 'Wait 2 Days',
                delay: {
                    amount: 2,
                    unit: 'days'
                }
            },
            {
                id: 'step-3',
                step_type: 'condition',
                name: 'Check If Status Is Still New',
                condition: {
                    field: 'status',
                    operator: 'equals',
                    value: 'new'
                }
            },
            {
                id: 'step-4',
                step_type: 'action',
                name: 'Send Email Reminder',
                action_type: 'send_email',
                action_config: {
                    subject: 'Following up on your inquiry, {{name}}',
                    body: '<p>Hi {{name}},</p><p>We wanted to follow up and see if you had any questions regarding your inquiry.</p><p>Best regards,<br/>Sales Team</p>'
                }
            }
        ]);
        toast({ title: 'Drip Template Loaded', description: 'WhatsApp → Wait 2 Days → Check Status → Email Reminder sequence loaded.' });
    };

    const addSequenceStep = (type: 'action' | 'delay' | 'condition') => {
        const id = `step-${Date.now()}`;
        if (type === 'delay') {
            setSequenceSteps(prev => [
                ...prev,
                { id, step_type: 'delay', name: 'Wait Delay', delay: { amount: 2, unit: 'days' } }
            ]);
        } else if (type === 'condition') {
            setSequenceSteps(prev => [
                ...prev,
                { id, step_type: 'condition', name: 'Condition Check', condition: { field: 'status', operator: 'equals', value: 'new' } }
            ]);
        } else {
            setSequenceSteps(prev => [
                ...prev,
                { id, step_type: 'action', name: 'WhatsApp Message', action_type: 'send_whatsapp', action_config: { message: 'Hello {{name}}!' } }
            ]);
        }
    };

    const removeSequenceStep = (index: number) => {
        setSequenceSteps(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;

        setLoading(true);
        try {
            const finalActionConfig = {
                ...actionConfig,
                sequence_steps: isSequenceMode ? sequenceSteps : undefined,
            };

            if (automation?.id) {
                await automationService.updateAutomation(automation.id, {
                    name,
                    trigger_type: triggerType,
                    trigger_config: triggerConfig,
                    action_type: isSequenceMode && sequenceSteps.length > 0 ? (sequenceSteps[0].action_type || actionType) : actionType,
                    action_config: finalActionConfig,
                    sequence_steps: isSequenceMode ? sequenceSteps : undefined,
                });
                toast({ title: 'Success', description: 'Automation updated successfully' });
            } else {
                await automationService.createAutomation({
                    name,
                    trigger_type: triggerType,
                    trigger_config: triggerConfig,
                    action_type: isSequenceMode && sequenceSteps.length > 0 ? (sequenceSteps[0].action_type || actionType) : actionType,
                    action_config: finalActionConfig,
                    sequence_steps: isSequenceMode ? sequenceSteps : undefined,
                });
                toast({ title: 'Success', description: 'Automation created successfully' });
            }

            onSuccess();
            onOpenChange(false);
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

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between pr-6">
                        <DialogTitle>{automation ? 'Edit Automation' : 'Create New Automation'}</DialogTitle>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={applyDripTemplate}
                            className="text-xs gap-1.5 bg-gradient-to-r from-amber-500/10 to-primary/10 border-primary/20 hover:bg-primary/20"
                        >
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            Use Drip Sequence Template
                        </Button>
                    </div>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Automation Name</Label>
                        <Input
                            placeholder="e.g. Lead Welcome & 2-Day Drip Sequence"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Multi-Step Mode Switch */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/30">
                        <div>
                            <p className="text-sm font-semibold flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-500" />
                                Multi-Step Time-Delayed Drip Sequence
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Chain triggers with timed delays (e.g. Wait 2 days) and conditional status checks.
                            </p>
                        </div>
                        <Switch
                            checked={isSequenceMode}
                            onCheckedChange={setIsSequenceMode}
                        />
                    </div>

                    <div className="space-y-4">
                        {/* Trigger Section */}
                        <div className="space-y-4 p-4 border rounded-xl bg-muted/20">
                            <h3 className="font-semibold text-xs uppercase tracking-wider text-primary">When this happens... (Trigger)</h3>
                            <div className="space-y-2">
                                <Label>Trigger Type</Label>
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

                        {/* Sequence Builder Mode */}
                        {isSequenceMode ? (
                            <div className="space-y-4 p-4 border rounded-xl bg-muted/20">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                        Automated Sequence Steps ({sequenceSteps.length})
                                    </h3>
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs gap-1"
                                            onClick={() => addSequenceStep('action')}
                                        >
                                            <Plus className="h-3 w-3" /> Action
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                            onClick={() => addSequenceStep('delay')}
                                        >
                                            <Clock className="h-3 w-3" /> Delay
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs gap-1 text-purple-600 dark:text-purple-400 border-purple-500/30"
                                            onClick={() => addSequenceStep('condition')}
                                        >
                                            <GitBranch className="h-3 w-3" /> Condition
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {sequenceSteps.map((step, idx) => (
                                        <div key={step.id || idx} className="p-3.5 bg-background rounded-lg border shadow-sm relative space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                                                        {idx + 1}
                                                    </span>
                                                    {step.step_type === 'delay' && (
                                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                                            <Clock className="h-3 w-3 mr-1" /> Time Delay
                                                        </Badge>
                                                    )}
                                                    {step.step_type === 'condition' && (
                                                        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
                                                            <GitBranch className="h-3 w-3 mr-1" /> Condition Check
                                                        </Badge>
                                                    )}
                                                    {(step.step_type === 'action' || !step.step_type) && (
                                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                                            Action
                                                        </Badge>
                                                    )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-destructive"
                                                    onClick={() => removeSequenceStep(idx)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>

                                            {/* Delay Config */}
                                            {step.step_type === 'delay' && (
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-medium">Wait for</span>
                                                    <Input
                                                        type="number"
                                                        className="w-20 h-8 text-xs"
                                                        value={step.delay?.amount || 2}
                                                        onChange={(e) => {
                                                            const updated = [...sequenceSteps];
                                                            updated[idx].delay = {
                                                                amount: parseInt(e.target.value) || 1,
                                                                unit: updated[idx].delay?.unit || 'days',
                                                            };
                                                            setSequenceSteps(updated);
                                                        }}
                                                    />
                                                    <Select
                                                        value={step.delay?.unit || 'days'}
                                                        onValueChange={(val: any) => {
                                                            const updated = [...sequenceSteps];
                                                            updated[idx].delay = {
                                                                amount: updated[idx].delay?.amount || 2,
                                                                unit: val,
                                                            };
                                                            setSequenceSteps(updated);
                                                        }}
                                                    >
                                                        <SelectTrigger className="w-[120px] h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="minutes">Minutes</SelectItem>
                                                            <SelectItem value="hours">Hours</SelectItem>
                                                            <SelectItem value="days">Days</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}

                                            {/* Condition Config */}
                                            {step.step_type === 'condition' && (
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <Label className="text-[10px]">Field</Label>
                                                        <Input
                                                            className="h-8 text-xs font-mono"
                                                            value={step.condition?.field || 'status'}
                                                            onChange={(e) => {
                                                                const updated = [...sequenceSteps];
                                                                updated[idx].condition = {
                                                                    ...updated[idx].condition!,
                                                                    field: e.target.value,
                                                                };
                                                                setSequenceSteps(updated);
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px]">Operator</Label>
                                                        <Select
                                                            value={step.condition?.operator || 'equals'}
                                                            onValueChange={(val: any) => {
                                                                const updated = [...sequenceSteps];
                                                                updated[idx].condition = {
                                                                    ...updated[idx].condition!,
                                                                    operator: val,
                                                                };
                                                                setSequenceSteps(updated);
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="equals">Equals (==)</SelectItem>
                                                                <SelectItem value="not_equals">Not Equals (!=)</SelectItem>
                                                                <SelectItem value="contains">Contains</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px]">Value</Label>
                                                        <Input
                                                            className="h-8 text-xs"
                                                            placeholder="e.g. new"
                                                            value={step.condition?.value || ''}
                                                            onChange={(e) => {
                                                                const updated = [...sequenceSteps];
                                                                updated[idx].condition = {
                                                                    ...updated[idx].condition!,
                                                                    value: e.target.value,
                                                                };
                                                                setSequenceSteps(updated);
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action Config */}
                                            {(step.step_type === 'action' || !step.step_type) && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Label className="text-[11px]">Action Type</Label>
                                                        <Select
                                                            value={step.action_type || 'send_whatsapp'}
                                                            onValueChange={(val: any) => {
                                                                const updated = [...sequenceSteps];
                                                                updated[idx].action_type = val;
                                                                setSequenceSteps(updated);
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs w-[180px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="send_whatsapp">Send WhatsApp</SelectItem>
                                                                <SelectItem value="send_email">Send Email</SelectItem>
                                                                <SelectItem value="ai_personalized_followup">AI Custom Follow-up</SelectItem>
                                                                <SelectItem value="ai_call">Trigger AI Voice Call</SelectItem>
                                                                <SelectItem value="update_status">Update Status</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {(step.action_type === 'send_whatsapp' || !step.action_type) && (
                                                        <Textarea
                                                            placeholder="WhatsApp message... (Use {{name}} placeholder)"
                                                            className="text-xs min-h-[60px]"
                                                            value={step.action_config?.message || ''}
                                                            onChange={(e) => {
                                                                const updated = [...sequenceSteps];
                                                                updated[idx].action_config = {
                                                                    ...updated[idx].action_config,
                                                                    message: e.target.value,
                                                                };
                                                                setSequenceSteps(updated);
                                                            }}
                                                        />
                                                    )}

                                                    {step.action_type === 'send_email' && (
                                                        <div className="space-y-1.5">
                                                            <Input
                                                                placeholder="Subject..."
                                                                className="h-8 text-xs"
                                                                value={step.action_config?.subject || ''}
                                                                onChange={(e) => {
                                                                    const updated = [...sequenceSteps];
                                                                    updated[idx].action_config = {
                                                                        ...updated[idx].action_config,
                                                                        subject: e.target.value,
                                                                    };
                                                                    setSequenceSteps(updated);
                                                                }}
                                                            />
                                                            <Textarea
                                                                placeholder="HTML / Text Email Body..."
                                                                className="text-xs min-h-[60px]"
                                                                value={step.action_config?.body || ''}
                                                                onChange={(e) => {
                                                                    const updated = [...sequenceSteps];
                                                                    updated[idx].action_config = {
                                                                        ...updated[idx].action_config,
                                                                        body: e.target.value,
                                                                    };
                                                                    setSequenceSteps(updated);
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* Standard Single Action Section */
                            <div className="space-y-4 p-4 border rounded-xl bg-muted/20">
                                <h3 className="font-semibold text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">...Do this (Action)</h3>
                                <div className="space-y-2">
                                    <Label>Action Type</Label>
                                    <Select
                                        value={actionType}
                                        onValueChange={(val) => setActionType(val as ActionType)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="send_whatsapp">Send WhatsApp Message</SelectItem>
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

                                {actionType === 'send_whatsapp' && (
                                    <div className="space-y-2">
                                        <Label>WhatsApp Message</Label>
                                        <Textarea
                                            placeholder="Hello {{name}}, thank you for your interest..."
                                            value={actionConfig.message || actionConfig.template || ''}
                                            onChange={(e) => setActionConfig({ ...actionConfig, message: e.target.value })}
                                            className="min-h-[80px] text-xs"
                                        />
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
                                        <Textarea
                                            placeholder="Hello {{name}}, ..."
                                            value={actionConfig.body || ''}
                                            onChange={(e) => setActionConfig({ ...actionConfig, body: e.target.value })}
                                            className="min-h-[80px] text-xs"
                                        />
                                    </div>
                                )}

                                {actionType === 'ai_personalized_followup' && (
                                    <div className="space-y-2">
                                        <Label>Instructions for AI Agent</Label>
                                        <Textarea
                                            placeholder="e.g. Ask them if they're still looking for a 2BHK in Mumbai..."
                                            value={actionConfig.instructions || ''}
                                            onChange={(e) => setActionConfig({ ...actionConfig, instructions: e.target.value })}
                                            className="min-h-[80px] text-xs"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {automation ? 'Save Changes' : 'Create Automation'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
