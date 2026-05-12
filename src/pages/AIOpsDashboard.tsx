import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  RefreshCcw, 
  CheckCircle2, 
  AlertTriangle, 
  MessageSquare, 
  ChevronRight, 
  ShieldCheck, 
  Zap,
  TrendingUp,
  BrainCircuit,
  Target
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Info } from 'lucide-react';

interface OpsDecision {
  id: string;
  lead_id: string;
  decision_type: 'RE_ENGAGE' | 'NURTURE' | 'ESCALATE' | 'STATUS_UPDATE';
  reasoning: string;
  status: 'pending_approval' | 'executed' | 'rejected';
  created_at: string;
  action_details: {
    draft?: string;
    context_snapshot?: any;
  };
  leads?: {
    name: string;
    status: string;
  };
}

export default function AIOpsDashboard() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [decisions, setDecisions] = useState<OpsDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const companyId = (session?.user as any)?.company_id;
      if (!companyId) return;

      const { data, error } = await supabase
        .from('autonomous_growth_settings')
        .select('auto_approve_stagnant_leads')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;
      if (data) setAutoApprove(data.auto_approve_stagnant_leads ?? false);
    } catch (err) {
      console.error('Settings Fetch Error:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchDecisions = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_ops_decisions' as any)
        .select('*, leads(name, status)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setDecisions(data || []);
    } catch (err) {
      console.error('Ops Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecisions();
    fetchSettings();

    // Real-time updates
    const channel = supabase
      .channel('ai_ops_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_ops_decisions' }, () => {
        fetchDecisions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user]);

  const runAudit = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('autonomous-ops-manager', {
        body: { companyId: (session?.user as any)?.company_id, manualTrigger: true }
      });

      if (error) throw error;
      toast({ title: 'AI Audit Complete', description: `Processed ${data.results?.length || 0} stagnant leads.` });
    } catch (err: any) {
      toast({ title: 'Audit Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsRunning(false);
    }
  };

  const updateDecision = async (id: string, status: 'executed' | 'rejected') => {
    try {
      if (status === 'executed') {
        const { error: invokeError } = await supabase.functions.invoke('ai-workflow-executor', {
          body: { decision_id: id }
        });
        if (invokeError) throw invokeError;
      } else {
        const { error } = await supabase
          .from('ai_ops_decisions' as any)
          .update({ status })
          .eq('id', id);
        if (error) throw error;
      }
      
      toast({ title: 'Decision Updated', description: `Action ${status} successfully.` });
    } catch (err: any) {
      toast({ title: 'Update Failed', description: err.message, variant: 'destructive' });
    }
  };

  const toggleAutoApprove = async (enabled: boolean) => {
    try {
      const companyId = (session?.user as any)?.company_id;
      if (!companyId) return;

      const { error } = await supabase
        .from('autonomous_growth_settings')
        .update({ auto_approve_stagnant_leads: enabled })
        .eq('company_id', companyId);

      if (error) throw error;
      
      setAutoApprove(enabled);
      toast({ 
        title: enabled ? 'Auto-Pilot Engaged' : 'Manual Approval Required', 
        description: enabled 
          ? 'AI will now execute decisions automatically.' 
          : 'All future AI decisions will require your review.' 
      });
    } catch (err: any) {
      toast({ title: 'Update Failed', description: err.message, variant: 'destructive' });
    }
  };

  const getDecisionIcon = (type: string) => {
    switch (type) {
      case 'RE_ENGAGE': return <MessageSquare className="h-4 w-4 text-blue-400" />;
      case 'ESCALATE': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'NURTURE': return <Zap className="h-4 w-4 text-amber-400" />;
      case 'STATUS_UPDATE': return <RefreshCcw className="h-4 w-4 text-slate-400" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-950 min-h-screen text-slate-200">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            <BrainCircuit className="h-8 w-8 text-primary animate-pulse" />
            AI Ops Center
          </h1>
          <p className="text-slate-400 mt-1 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            Mission Control: Autonomous Lead Lifecycle Management
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center space-x-3 bg-slate-900/50 border border-slate-800 p-2.5 px-4 rounded-xl backdrop-blur-sm">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">AI Auto-Approval</span>
              <Label htmlFor="auto-approval-mode" className="text-sm font-semibold cursor-pointer">
                {autoApprove ? 'Auto-Pilot ON' : 'Manual Approval'}
              </Label>
            </div>
            <Switch 
              id="auto-approval-mode"
              checked={autoApprove}
              onCheckedChange={toggleAutoApprove}
              disabled={settingsLoading}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          <Button 
            onClick={runAudit} 
            disabled={isRunning}
            className="gradient-primary px-6 h-11 rounded-xl shadow-lg shadow-primary/20"
          >
            {isRunning ? (
              <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Activity className="h-4 w-4 mr-2" />
            )}
            Run Intelligence Audit
          </Button>
        </div>
      </header>

      {/* Stats Cluster */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800 glass">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm">Leads Under Mgmt</p>
                <h3 className="text-2xl font-bold mt-1">128</h3>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Target className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 glass">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm">Decisions Pending</p>
                <h3 className="text-2xl font-bold mt-1">
                  {decisions.filter(d => d.status === 'pending_approval').length}
                </h3>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400"><RefreshCcw className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 glass">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm">Stagnation Saved</p>
                <h3 className="text-2xl font-bold mt-1">42%</h3>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg text-green-400"><TrendingUp className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 glass">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm">AI Autonomy Level</p>
                <h3 className={`text-2xl font-bold mt-1 ${autoApprove ? 'text-primary' : 'text-slate-200'}`}>
                  {autoApprove ? 'Auto-Pilot' : 'Guided'}
                </h3>
              </div>
              <div className={`p-2 rounded-lg ${autoApprove ? 'bg-primary/10 text-primary' : 'bg-purple-500/10 text-purple-400'}`}>
                <Zap className={`h-5 w-5 ${autoApprove ? 'animate-pulse' : ''}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Live Decision Feed */}
        <Card className="lg:col-span-2 bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <BrainCircuit className="h-48 w-48" />
          </div>
          <CardHeader className="border-b border-slate-800 px-6 py-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Live Intelligence Stream
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 text-white">
            <ScrollArea className="h-[600px]">
              <div className="divide-y divide-slate-800/50">
                {decisions.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <BrainCircuit className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No recent decisions. Run an audit to start monitoring.</p>
                  </div>
                ) : (
                  decisions.map((decision) => (
                    <div key={decision.id} className="p-6 hover:bg-slate-800/30 transition-colors group">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-800 rounded-lg">
                            {getDecisionIcon(decision.decision_type)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-100">{decision.leads?.name}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(decision.created_at).toLocaleString()} • Stuck in {decision.leads?.status}
                            </p>
                          </div>
                        </div>
                        <Badge variant={decision.status === 'executed' ? 'default' : 'outline'} className="rounded-full">
                          {decision.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="ml-11 mt-2">
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 relative overflow-hidden">
                           <p className="text-sm text-slate-300 italic">"{decision.reasoning}"</p>
                           {decision.action_details?.draft && (
                             <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                               <p className="text-xs font-bold text-primary uppercase mb-1 flex items-center gap-1">
                                 <Zap className="h-3 w-3" /> Draft Nudge
                               </p>
                               <p className="text-sm text-slate-300">{decision.action_details.draft}</p>
                             </div>
                           )}
                        </div>

                        {decision.status === 'pending_approval' && (
                          <div className="flex gap-2 mt-4">
                            <Button size="sm" onClick={() => updateDecision(decision.id, 'executed')} className="h-8 gradient-primary">
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve & Execute
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => updateDecision(decision.id, 'rejected')} className="h-8 text-slate-400 hover:text-red-400">
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Tactical Overview */}
        <div className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle className="text-md text-white">Top Action Targets</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-white">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-400" />
                  <span className="text-sm font-medium">SaaS Pro (Tech Stack)</span>
                </div>
                <Badge variant="secondary">High Intent</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-sm font-medium">Real Estate (Luxury)</span>
                </div>
                <Badge variant="secondary">Stagnant</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="text-sm font-medium">Edu Leads (Global)</span>
                </div>
                <Badge variant="secondary" className="bg-red-500/10 text-red-400 border-red-500/20">Critical</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#8B5CF6]/10 border-[#8B5CF6]/30 overflow-hidden relative">
            <CardContent className="pt-6">
              <div className="relative z-10 text-white">
                <h4 className="font-bold text-slate-100">Upgrade Autonomy?</h4>
                <p className="text-xs text-slate-400 mt-1">Unlock "Full Pilot" mode to allow AI to execute Re-engagements without manual review.</p>
                <Button variant="outline" className="w-full mt-4 h-9 bg-slate-950/50 border-[#8B5CF6]/50 hover:bg-[#8B5CF6]/20 transition-all text-xs">
                  Review Settings
                </Button>
              </div>
              <Activity className="absolute bottom-[-10px] right-[-10px] h-20 w-20 text-[#8B5CF6]/5 pointer-events-none" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
