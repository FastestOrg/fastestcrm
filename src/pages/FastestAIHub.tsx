import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BrainCircuit, Zap, Target, TrendingUp, ShieldCheck, Sparkles,
  Wand2, Activity, ArrowRight, Bot, Mail, MessageCircle, Calendar,
  RefreshCcw, CheckCircle2, Clock, Play, BarChart3, Workflow, Users, Rocket, Globe
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';

const AI_FEATURES = [
  {
    icon: Globe,
    label: 'Fastest Scout',
    path: '/dashboard/fastest-scout',
    description: 'AI-powered prospecting agent. Describe your ideal client and Scout finds them via Apollo.io.',
    color: 'from-blue-600 to-indigo-600',
    badge: 'Autonomous',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    icon: Zap,
    label: 'Agentic Workflows',
    path: '/dashboard/agentic-workflows',
    description: 'Build AI-driven workflows that autonomously act on leads via email, WhatsApp & booking.',
    color: 'from-violet-500 to-purple-600',
    badge: 'Core',
    badgeColor: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  },
  {
    icon: Users,
    label: 'AI Employees',
    path: '/dashboard/ai-employees',
    description: 'Create and manage your autonomous sales team. Assign knowledge, tools & goals.',
    color: 'from-orange-500 to-amber-600',
    badge: 'NEW',
    badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  {
    icon: Target,
    label: 'Deal Intelligence',
    path: '/dashboard/deal-intelligence',
    description: 'Real-time Deal Health Scores. AI detects at-risk deals and triggers interventions.',
    color: 'from-blue-500 to-cyan-600',
    badge: 'ADIE',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  {
    icon: BarChart3,
    label: 'Revenue Forecast',
    path: '/dashboard/revenue-forecast',
    description: 'Probabilistic P10/P50/P90 revenue modeling with autonomous gap response.',
    color: 'from-emerald-500 to-green-600',
    badge: 'PRCC',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    icon: Users,
    label: 'Customer Health',
    path: '/dashboard/customer-health',
    description: 'Proactive churn prevention. AI monitors health signals and executes retention plays.',
    color: 'from-rose-500 to-pink-600',
    badge: 'ACHPE',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
  {
    icon: Sparkles,
    label: 'Personalization Engine',
    path: '/dashboard/personalization',
    description: 'Hyper-personalized outreach at machine scale. 5-8x higher reply rates.',
    color: 'from-amber-500 to-orange-600',
    badge: 'APIEE',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  {
    icon: Rocket,
    label: 'AI Growth Hacker',
    path: '/dashboard/lg',
    description: 'Autonomous growth engineering. AI analyzes conversion loops and scales your viral reach.',
    color: 'from-emerald-500 to-teal-600',
    badge: 'NEW',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    icon: ShieldCheck,
    label: 'AI Ops Center',
    path: '/dashboard/ai-ops',
    description: 'Mission Control for autonomous lead lifecycle management and decision oversight.',
    color: 'from-slate-500 to-slate-600',
    badge: 'Live',
    badgeColor: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  },
  {
    icon: BrainCircuit,
    label: 'AI Insights',
    path: '/dashboard/ai',
    description: 'Strategic CRM analysis powered by Gemini. Bottlenecks, team insights & actions.',
    color: 'from-primary to-violet-600',
    badge: 'Live',
    badgeColor: 'bg-primary/20 text-primary border-primary/30',
  },
];

const TOOL_ICONS: Record<string, any> = {
  send_email: Mail,
  send_whatsapp: MessageCircle,
  create_booking_link: Calendar,
  update_lead_status: RefreshCcw,
  notify_team: Activity,
  no_action: Clock,
};

export default function FastestAIHub() {
  const navigate = useNavigate();
  const { company } = useCompany();
  const [executions, setExecutions] = useState<any[]>([]);
  const [stats, setStats] = useState({ workflows: 0, executions: 0, outcomes: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id) return;
    fetchData();

    const channel = supabase
      .channel('ai_hub_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_workflow_executions' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [company?.id]);

  const fetchData = async () => {
    if (!company?.id) return;
    try {
      const [execRes, wfRes, outcomeRes, pendingRes] = await Promise.all([
        (supabase as any).from('ai_workflow_executions').select('*, ai_workflows(name, outcome_goal)').eq('company_id', company.id).order('created_at', { ascending: false }).limit(15),
        (supabase as any).from('ai_workflows').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('is_active', true),
        (supabase as any).from('ai_agent_outcomes').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
        (supabase as any).from('ai_ops_decisions').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'pending_approval'),
      ]);

      setExecutions(execRes.data || []);
      setStats({
        workflows: wfRes.count || 0,
        executions: execRes.data?.length || 0,
        outcomes: outcomeRes.count || 0,
        pending: pendingRes.count || 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-400';
      case 'running': return 'text-blue-400 animate-pulse';
      case 'failed': return 'text-red-400';
      default: return 'text-amber-400';
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 min-h-screen">
      {/* Hero Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950/30 to-slate-950 border border-violet-500/20 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-600/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30">
                <Bot className="h-7 w-7 text-violet-400" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
                  FastestAI Hub
                </h1>
                <p className="text-violet-300/70 text-sm">Autonomous CRM Operating System</p>
              </div>
            </div>
            <p className="text-slate-400 max-w-xl leading-relaxed">
              Your AI agents are working 24/7 to engage leads, book meetings, prevent churn, and drive revenue.
              All actions logged, all decisions explainable.
            </p>
          </div>
          <Button
            onClick={() => navigate('/dashboard/agentic-workflows')}
            className="gradient-primary h-12 px-6 rounded-xl shadow-lg shadow-primary/20 text-base font-semibold shrink-0"
          >
            <Workflow className="h-5 w-5 mr-2" />
            Build Workflow
          </Button>
        </div>

        {/* Stats Row */}
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {[
            { label: 'Active Workflows', value: stats.workflows, icon: Workflow, color: 'text-violet-400' },
            { label: 'Actions Taken', value: stats.executions, icon: Zap, color: 'text-blue-400' },
            { label: 'Outcomes Logged', value: stats.outcomes, icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'Pending Approval', value: stats.pending, icon: Clock, color: 'text-amber-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-slate-400">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{loading ? '—' : stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Capabilities
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {AI_FEATURES.map((feature) => (
            <Card
              key={feature.label}
              onClick={() => navigate(feature.path)}
              className="cursor-pointer group border border-border hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 overflow-hidden"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${feature.color} bg-opacity-10`}>
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                  <Badge variant="outline" className={`text-xs rounded-full ${feature.badgeColor}`}>
                    {feature.badge}
                  </Badge>
                </div>
                <h3 className="font-semibold text-sm mb-1.5 group-hover:text-primary transition-colors">{feature.label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                <div className="mt-4 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Open</span><ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Live Agent Activity
              <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400 font-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </CardTitle>
          </CardHeader>
          <ScrollArea className="h-[360px]">
            {executions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
                <Bot className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm">No agent activity yet.</p>
                <p className="text-xs mt-1">Create a workflow to start autonomous execution.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/dashboard/agentic-workflows')}>
                  <Zap className="h-3.5 w-3.5 mr-1.5" /> Create First Workflow
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {executions.map((exec) => {
                  const stepsLog = exec.steps_log || [];
                  const lastStep = stepsLog[stepsLog.length - 1];
                  const toolUsed = lastStep?.tool_chosen || 'unknown';
                  const ToolIcon = TOOL_ICONS[toolUsed] || Bot;
                  return (
                    <div key={exec.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted shrink-0">
                          <ToolIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-sm font-medium truncate">{exec.ai_workflows?.name || 'Workflow'}</p>
                            <span className={`text-xs ${getStatusColor(exec.status)} shrink-0`}>{exec.status}</span>
                          </div>
                          {exec.outcome && (
                            <p className="text-xs text-muted-foreground truncate">{exec.outcome}</p>
                          )}
                          {exec.message_draft && (
                            <div className="mt-2 p-2 rounded bg-muted/50 border border-border">
                              <p className="text-xs text-muted-foreground italic truncate">"{exec.message_draft}"</p>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(exec.created_at).toLocaleString()} · {exec.ai_workflows?.outcome_goal || 'custom goal'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" /> Quick Launch
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {[
                { label: 'Review Pending Decisions', path: '/dashboard/ai-ops', icon: ShieldCheck, count: stats.pending },
                { label: 'Run Intelligence Audit', path: '/dashboard/ai-ops', icon: Activity },
                { label: 'View AI Insights', path: '/dashboard/ai', icon: BrainCircuit },
                { label: 'Closing Assistant', path: '/dashboard/ai-closing', icon: Target },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left group"
                >
                  <action.icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm flex-1">{action.label}</span>
                  {action.count !== undefined && action.count > 0 && (
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30 shrink-0">
                      {action.count}
                    </Badge>
                  )}
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-violet-500/20 bg-violet-500/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-5 w-5 text-violet-400" />
                <h4 className="font-semibold text-sm">Autonomy Status</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Default Mode</span>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">Guided</Badge>
                </div>
                <p className="text-xs text-muted-foreground">All AI actions require approval. Enable "Full Pilot" per workflow for autonomous execution.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 text-xs"
                onClick={() => navigate('/dashboard/agentic-workflows')}
              >
                Manage Workflows
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
