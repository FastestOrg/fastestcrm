import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Zap, Plus, Bot, Mail, MessageCircle, Calendar, RefreshCcw,
  Bell, Trash2, Play, Loader2, Target, Activity, ArrowRight,
  CheckCircle2, Shield, Wand2, Users, Clock, SlidersHorizontal
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/hooks/use-toast';
import { useWhatsAppAccounts } from '@/hooks/useWhatsAppAccounts';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { WhatsAppAccountAddDialog } from '@/components/integrations/WhatsAppAccountAddDialog';
import { EmailAccountAddDialog } from '@/components/integrations/EmailAccountAddDialog';
import { useForms } from '@/hooks/useForms';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';


type TriggerType = 'lead_created' | 'status_changed' | 'tag_added' | 'inactivity' | 'form_submitted' | 'manual';
type OutcomeGoal = 'meeting_booked' | 'demo_scheduled' | 'sale_closed' | 'site_visit' | 'whatsapp_reply' | 'custom';
type AutonomyMode = 'guided' | 'full_pilot';

interface AIWorkflow {
  id: string;
  name: string;
  description?: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, any>;
  steps: any[];
  outcome_goal: OutcomeGoal;
  autonomy_mode: AutonomyMode;
  is_active: boolean;
  run_count: number;
  success_count: number;
  created_at: string;
}

const TRIGGER_OPTIONS = [
  { value: 'lead_created', label: 'Lead Added', icon: Users, description: 'When a new lead is added to CRM' },
  { value: 'status_changed', label: 'Status Changed', icon: RefreshCcw, description: 'When a lead moves to a specific status' },
  { value: 'inactivity', label: 'Lead Inactive', icon: Clock, description: 'When a lead has no activity for X days' },
  { value: 'tag_added', label: 'Tag Added', icon: Zap, description: 'When a specific tag is applied to a lead' },
  { value: 'form_submitted', label: 'Form Submitted', icon: Activity, description: 'When a lead submits a form' },
  { value: 'manual', label: 'Manual Trigger', icon: Play, description: 'Triggered manually from leads view' },
];

const OUTCOME_OPTIONS = [
  { value: 'meeting_booked', label: '📅 Meeting Booked', description: 'Schedule a call or meeting' },
  { value: 'demo_scheduled', label: '🎯 Demo Scheduled', description: 'Product demo appointment' },
  { value: 'site_visit', label: '🏠 Site Visit Booked', description: 'Property/office visit (Real Estate)' },
  { value: 'sale_closed', label: '💰 Sale Closed', description: 'Convert lead to paying customer' },
  { value: 'whatsapp_reply', label: '💬 WhatsApp Reply', description: 'Get a response via WhatsApp' },
  { value: 'custom', label: '⚡ Custom Goal', description: 'Define your own outcome' },
];

const ACTION_TEMPLATES = [
  {
    id: 'ai_whatsapp',
    label: 'AI WhatsApp Message',
    icon: MessageCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    description: 'Send a personalized WhatsApp message crafted by AI',
    channel: 'whatsapp',
  },
  {
    id: 'ai_email',
    label: 'AI Email',
    icon: Mail,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    description: 'Send a personalized email composed by AI',
    channel: 'email',
  },
  {
    id: 'ai_book_meeting',
    label: 'Book Meeting / Demo',
    icon: Calendar,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    description: 'AI sends booking link with personalized context',
    channel: 'any',
  },
  {
    id: 'ai_update_status',
    label: 'Update Lead Status',
    icon: RefreshCcw,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    description: 'AI decides and updates the lead\'s CRM status',
    channel: 'crm',
  },
  {
    id: 'ai_notify_team',
    label: 'Notify Team Member',
    icon: Bell,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    description: 'Alert the sales owner or manager',
    channel: 'notification',
  },
];

const DEFAULT_STEP = {
  action_type: 'ai_whatsapp',
  action_config: {
    channel: 'whatsapp',
    instructions: '',
    allowed_tools: ['send_whatsapp', 'create_booking_link'],
  },
};

export default function AgenticWorkflows() {
  const { company } = useCompany();
  const { toast } = useToast();
  const { accounts: whatsappAccounts } = useWhatsAppAccounts();
  const { accounts: emailAccounts } = useEmailAccounts();
  const { forms } = useForms();
  const { statuses } = useLeadStatuses();

  
  const [workflows, setWorkflows] = useState<AIWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRunning, setIsRunning] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger_type: 'lead_created' as TriggerType,
    trigger_config: {} as Record<string, any>,
    outcome_goal: 'meeting_booked' as OutcomeGoal,
    autonomy_mode: 'guided' as AutonomyMode,
    selectedAction: 'ai_whatsapp',
    instructions: '',
    whatsapp_account_id: '' as string | null,
    email_account_id: '' as string | null,
  });

  const [isWhatsAppAddOpen, setIsWhatsAppAddOpen] = useState(false);
  const [isEmailAddOpen, setIsEmailAddOpen] = useState(false);

  const fetchWorkflows = async () => {
    if (!company?.id) return;
    try {
      const { data, error } = await (supabase as any)
        .from('ai_workflows')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setWorkflows(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWorkflows(); }, [company?.id]);

  const handleCreate = async () => {
    if (!form.name.trim() || !company?.id) return;

    const selectedActionDef = ACTION_TEMPLATES.find(a => a.id === form.selectedAction);
    const step = {
      action_type: form.selectedAction,
      order: 0,
      action_config: {
        channel: selectedActionDef?.channel || 'any',
        instructions: form.instructions,
        allowed_tools: getToolsForAction(form.selectedAction),
        whatsapp_account_id: form.selectedAction === 'ai_whatsapp' ? form.whatsapp_account_id : null,
        email_account_id: form.selectedAction === 'ai_email' ? form.email_account_id : null,
      },
    };

    try {
      const { error } = await (supabase as any).from('ai_workflows').insert({
        company_id: company.id,
        name: form.name,
        description: form.description,
        trigger_type: form.trigger_type,
        trigger_config: form.trigger_config,
        steps: [step],
        outcome_goal: form.outcome_goal,
        autonomy_mode: form.autonomy_mode,
        is_active: true,
      });

      if (error) throw error;
      toast({ title: 'Workflow Created', description: 'Your AI workflow is now active.' });
      setIsCreateOpen(false);
      setForm({ name: '', description: '', trigger_type: 'lead_created', trigger_config: {}, outcome_goal: 'meeting_booked', autonomy_mode: 'guided', selectedAction: 'ai_whatsapp', instructions: '', whatsapp_account_id: null, email_account_id: null });
      fetchWorkflows();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const getToolsForAction = (actionId: string): string[] => {
    switch (actionId) {
      case 'ai_whatsapp': return ['send_whatsapp', 'no_action'];
      case 'ai_email': return ['send_email', 'no_action'];
      case 'ai_book_meeting': return ['create_booking_link', 'send_whatsapp', 'send_email'];
      case 'ai_update_status': return ['update_lead_status', 'no_action'];
      case 'ai_notify_team': return ['notify_team', 'no_action'];
      default: return ['send_whatsapp', 'send_email', 'create_booking_link', 'update_lead_status', 'notify_team', 'no_action'];
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    await (supabase as any).from('ai_workflows').update({ is_active: !current }).eq('id', id);
    setWorkflows(wfs => wfs.map(w => w.id === id ? { ...w, is_active: !current } : w));
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from('ai_workflows').delete().eq('id', id);
    setWorkflows(wfs => wfs.filter(w => w.id !== id));
    toast({ title: 'Deleted', description: 'Workflow removed.' });
  };

  const handleRunManual = async (workflow: AIWorkflow) => {
    setIsRunning(workflow.id);
    try {
      const { data, error } = await supabase.functions.invoke('ai-workflow-executor', {
        body: { workflow_id: workflow.id, company_id: company?.id, trigger_type: 'manual', manual_trigger: true },
      });
      if (error) throw error;
      toast({ title: 'Workflow Triggered', description: `Executed with ${data.executions?.length || 0} result(s).` });
      fetchWorkflows();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsRunning(null);
    }
  };

  const getTriggerDef = (type: string) => TRIGGER_OPTIONS.find(t => t.value === type);
  const getOutcomeDef = (goal: string) => OUTCOME_OPTIONS.find(o => o.value === goal);
  const getActionDef = (steps: any[]) => {
    const type = steps?.[0]?.action_type;
    return ACTION_TEMPLATES.find(a => a.id === type);
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" /> Agentic Workflows
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI agents that autonomously act on leads — email, WhatsApp, bookings, and more.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gradient-primary shrink-0">
          <Plus className="h-4 w-4 mr-2" /> New Workflow
        </Button>
      </div>

      {/* Quick Template Pills */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center mr-1">Quick templates:</span>
        {[
          { label: '📅 Book Meeting on Lead Added', trigger: 'lead_created', goal: 'meeting_booked', action: 'ai_book_meeting' },
          { label: '💬 WhatsApp on Status Change', trigger: 'status_changed', goal: 'whatsapp_reply', action: 'ai_whatsapp' },
          { label: '🏠 Site Visit (Real Estate)', trigger: 'lead_created', goal: 'site_visit', action: 'ai_book_meeting' },
          { label: '🎯 Demo for Inactive Leads', trigger: 'inactivity', goal: 'demo_scheduled', action: 'ai_email' },
        ].map((tpl) => (
          <button
            key={tpl.label}
            onClick={() => {
              setForm(f => ({ ...f, trigger_type: tpl.trigger as TriggerType, outcome_goal: tpl.goal as OutcomeGoal, selectedAction: tpl.action, name: tpl.label }));
              setIsCreateOpen(true);
            }}
            className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            {tpl.label}
          </button>
        ))}
      </div>

      {/* Workflow List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : workflows.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center py-20 text-center">
          <div className="p-5 rounded-2xl bg-primary/10 mb-5">
            <Bot className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">No Workflows Yet</h2>
          <p className="text-muted-foreground max-w-sm text-sm mb-6">
            Create your first agentic workflow to let AI engage leads autonomously via email, WhatsApp, and booking links.
          </p>
          <Button onClick={() => setIsCreateOpen(true)} className="gradient-primary">
            <Plus className="h-4 w-4 mr-2" /> Create First Workflow
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((wf) => {
            const triggerDef = getTriggerDef(wf.trigger_type);
            const outcomeDef = getOutcomeDef(wf.outcome_goal);
            const actionDef = getActionDef(wf.steps);
            const successRate = wf.run_count > 0 ? Math.round((wf.success_count / wf.run_count) * 100) : 0;

            return (
              <Card key={wf.id} className={`transition-all border ${wf.is_active ? 'border-border' : 'border-border/50 opacity-60'} hover:border-primary/30`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`p-2.5 rounded-xl ${actionDef?.bgColor || 'bg-primary/10'} shrink-0`}>
                      {actionDef ? <actionDef.icon className={`h-5 w-5 ${actionDef.color}`} /> : <Bot className="h-5 w-5 text-primary" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-semibold">{wf.name}</h3>
                        <Badge variant="outline" className={`text-xs ${wf.autonomy_mode === 'full_pilot' ? 'bg-violet-500/10 text-violet-400 border-violet-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                          {wf.autonomy_mode === 'full_pilot' ? '🚀 Full Pilot' : '🛡 Guided'}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          {outcomeDef?.label || wf.outcome_goal}
                        </Badge>
                      </div>

                      {/* Trigger → Action flow */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
                        <span className="bg-muted px-2 py-1 rounded-md flex items-center gap-1">
                          {triggerDef && <triggerDef.icon className="h-3 w-3" />}
                          {triggerDef?.label || wf.trigger_type}
                        </span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span className="bg-primary/10 text-primary px-2 py-1 rounded-md">
                          {actionDef?.label || 'AI Action'}
                        </span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span className="bg-muted px-2 py-1 rounded-md">{outcomeDef?.label?.split(' ').slice(1).join(' ') || wf.outcome_goal}</span>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Play className="h-3 w-3" />{wf.run_count} runs</span>
                        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-400" />{successRate}% success</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        disabled={isRunning === wf.id}
                        onClick={() => handleRunManual(wf)}
                        title="Run manually"
                      >
                        {isRunning === wf.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      </Button>
                      <Switch checked={wf.is_active} onCheckedChange={() => handleToggle(wf.id, wf.is_active)} />
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(wf.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Workflow Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-primary" /> Create Agentic Workflow
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="trigger" className="mt-2">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="trigger">1. Trigger</TabsTrigger>
              <TabsTrigger value="action">2. AI Action</TabsTrigger>
              <TabsTrigger value="settings">3. Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="trigger" className="space-y-4 pt-4">
              <div>
                <Label>Workflow Name</Label>
                <Input
                  placeholder="e.g. Book Meeting for New Leads"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder="What should this agent do?"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="mt-1.5 resize-none"
                  rows={2}
                />
              </div>
              <div>
                <Label className="mb-2 block">Trigger Event</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TRIGGER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(f => ({ ...f, trigger_type: opt.value as TriggerType }))}
                      className={`p-3 rounded-xl border text-left transition-all ${form.trigger_type === opt.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <opt.icon className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{opt.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              {form.trigger_type === 'status_changed' && (
                <div>
                  <Label>Changed to Status</Label>
                  <Input
                    placeholder="e.g. Interested"
                    value={form.trigger_config.to_status || ''}
                    onChange={e => setForm(f => ({ ...f, trigger_config: { ...f.trigger_config, to_status: e.target.value } }))}
                    className="mt-1.5"
                  />
                </div>
              )}
              {form.trigger_type === 'inactivity' && (
                <div>
                  <Label>Days of Inactivity</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 3"
                    value={form.trigger_config.days || ''}
                    onChange={e => setForm(f => ({ ...f, trigger_config: { ...f.trigger_config, days: parseInt(e.target.value) } }))}
                    className="mt-1.5"
                  />
                </div>
              )}
              {form.trigger_type === 'tag_added' && (
                <div>
                  <Label>Specific Tag (e.g. "Hot Lead")</Label>
                  <Input
                    placeholder="e.g. newsletter-subscriber"
                    value={form.trigger_config.tag || ''}
                    onChange={e => setForm(f => ({ ...f, trigger_config: { ...f.trigger_config, tag: e.target.value } }))}
                    className="mt-1.5"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Case-sensitive tag name.</p>
                </div>
              )}
              {form.trigger_type === 'form_submitted' && (
                <div>
                  <Label>Select Form</Label>
                  <Select 
                    value={form.trigger_config.form_id || 'any'} 
                    onValueChange={(val) => setForm(f => ({ ...f, trigger_config: { ...f.trigger_config, form_id: val === 'any' ? null : val } }))}
                  >
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select a form" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Form</SelectItem>
                      {forms?.map(form => (
                        <SelectItem key={form.id} value={form.id}>{form.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </TabsContent>

            <TabsContent value="action" className="space-y-4 pt-4">
              <div>
                <Label className="mb-2 block">Outcome Goal</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OUTCOME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(f => ({ ...f, outcome_goal: opt.value as OutcomeGoal }))}
                      className={`p-3 rounded-xl border text-left transition-all ${form.outcome_goal === opt.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                    >
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">AI Action</Label>
                <div className="space-y-2">
                  {ACTION_TEMPLATES.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => setForm(f => ({ ...f, selectedAction: action.id }))}
                      className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${form.selectedAction === action.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                    >
                      <div className={`p-2 rounded-lg ${action.bgColor}`}>
                        <action.icon className={`h-4 w-4 ${action.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{action.label}</p>
                        <p className="text-xs text-muted-foreground">{action.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>AI Instructions</Label>
                <Textarea
                  placeholder={`e.g. "Keep the tone friendly and professional. Always mention our free trial. Focus on booking a 15-minute demo call."`}
                  value={form.instructions}
                  onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                  className="mt-1.5 resize-none"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">The AI agent will follow these instructions when crafting its message for each lead.</p>
              </div>

              {form.selectedAction === 'ai_update_status' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label>Update to Status (Target)</Label>
                  <Select 
                    value={form.trigger_config.target_status || 'none'} 
                    onValueChange={(val) => setForm(f => ({ ...f, trigger_config: { ...f.trigger_config, target_status: val === 'none' ? null : val } }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select target status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">AI Decides (Not recommended)</SelectItem>
                      {statuses?.map(status => (
                        <SelectItem key={status.id} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">The AI will update the lead to this status after successful engagement.</p>
                </div>
              )}

              {form.selectedAction === 'ai_whatsapp' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label>Sender WhatsApp Account</Label>
                  <Select 
                    value={form.whatsapp_account_id || 'none'} 
                    onValueChange={(val) => {
                      if (val === 'add_new') {
                        setIsWhatsAppAddOpen(true);
                      } else {
                        setForm(f => ({ ...f, whatsapp_account_id: val === 'none' ? null : val }));
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">First Available</SelectItem>
                      {whatsappAccounts?.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.display_name} ({acc.phone_number})</SelectItem>
                      ))}
                      <SelectItem value="add_new" className="text-emerald-400 font-bold border-t border-border mt-1">
                        <Plus className="h-3 w-3 mr-2" /> Add New Account...
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.selectedAction === 'ai_email' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label>Sender Email Account</Label>
                  <Select 
                    value={form.email_account_id || 'none'} 
                    onValueChange={(val) => {
                      if (val === 'add_new') {
                        setIsEmailAddOpen(true);
                      } else {
                        setForm(f => ({ ...f, email_account_id: val === 'none' ? null : val }));
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">First Available</SelectItem>
                      {emailAccounts?.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.display_name} ({acc.email_address})</SelectItem>
                      ))}
                      <SelectItem value="add_new" className="text-primary font-bold border-t border-border mt-1">
                        <Plus className="h-3 w-3 mr-2" /> Add New Account...
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-5 pt-4">
              <div className="p-4 rounded-xl border border-border space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-400" /> Guided Mode (Recommended)
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">AI plans actions but waits for your approval before sending. Review in AI Ops Center.</p>
                  </div>
                  <Switch
                    checked={form.autonomy_mode === 'guided'}
                    onCheckedChange={(v) => setForm(f => ({ ...f, autonomy_mode: v ? 'guided' : 'full_pilot' }))}
                  />
                </div>

                <div className="border-t border-border pt-4 flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-violet-400" /> Full Pilot Mode
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">AI executes actions autonomously without approval. Recommended only after testing.</p>
                  </div>
                  <Switch
                    checked={form.autonomy_mode === 'full_pilot'}
                    onCheckedChange={(v) => setForm(f => ({ ...f, autonomy_mode: v ? 'full_pilot' : 'guided' }))}
                  />
                </div>
              </div>

              {form.autonomy_mode === 'full_pilot' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                  ⚠️ Full Pilot mode will execute AI actions immediately on each matching lead without human review. Ensure your instructions are thoroughly tested first.
                </div>
              )}

              <div className="p-4 rounded-xl bg-muted/30 border border-border">
                <h4 className="text-sm font-semibold mb-3">Workflow Summary</h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Name</span><span className="text-foreground font-medium">{form.name || 'Untitled'}</span></div>
                  <div className="flex justify-between"><span>Trigger</span><span className="text-foreground">{getTriggerDef(form.trigger_type)?.label}</span></div>
                  <div className="flex justify-between"><span>AI Action</span><span className="text-foreground">{ACTION_TEMPLATES.find(a => a.id === form.selectedAction)?.label}</span></div>
                  <div className="flex justify-between"><span>Outcome Goal</span><span className="text-foreground">{OUTCOME_OPTIONS.find(o => o.value === form.outcome_goal)?.label}</span></div>
                  <div className="flex justify-between"><span>Autonomy</span><span className={form.autonomy_mode === 'full_pilot' ? 'text-violet-400' : 'text-amber-400'}>{form.autonomy_mode === 'full_pilot' ? '🚀 Full Pilot' : '🛡 Guided'}</span></div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.name.trim()} className="gradient-primary">
              <Zap className="h-4 w-4 mr-1.5" /> Activate Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WhatsAppAccountAddDialog 
        isOpen={isWhatsAppAddOpen} 
        onOpenChange={setIsWhatsAppAddOpen}
        onSuccess={(id) => setForm(f => ({ ...f, whatsapp_account_id: id }))}
      />
      <EmailAccountAddDialog 
        isOpen={isEmailAddOpen} 
        onOpenChange={setIsEmailAddOpen}
        onSuccess={(id) => setForm(f => ({ ...f, email_account_id: id }))}
      />
    </div>
  );
}
