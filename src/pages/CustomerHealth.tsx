import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users, Heart, AlertTriangle, TrendingUp, Loader2,
  RefreshCcw, Zap, BrainCircuit, CheckCircle2, Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/hooks/use-toast';

interface CustomerHealth {
  lead_id: string;
  name: string;
  status: string;
  health_score: number;
  churn_risk: 'low' | 'medium' | 'high' | 'critical';
  signals: string[];
  last_activity: string;
  recommended_play: string;
}

export default function CustomerHealth() {
  const { company } = useCompany();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<CustomerHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, critical: 0, atRisk: 0, healthy: 0 });

  useEffect(() => { if (company?.id) fetchAccounts(); }, [company?.id]);

  const fetchAccounts = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, name, status, updated_at, created_at, phone, email')
        .eq('company_id', company.id)
        .in('status', ['paid', 'closed', 'won', 'converted', 'active', 'customer'])
        .order('updated_at', { ascending: true })
        .limit(25);

      // Also get leads that look like "customers" (recently paid/interested)
      const { data: prospects } = await supabase
        .from('leads')
        .select('id, name, status, updated_at, created_at, phone, email')
        .eq('company_id', company.id)
        .in('status', ['interested', 'follow_up', 'warm'])
        .order('updated_at', { ascending: true })
        .limit(10);

      const allContacts = [...(leads || []), ...(prospects || [])];

      const scored: CustomerHealth[] = allContacts.map(lead => {
        const updatedAt = new Date(lead.updated_at);
        const createdAt = new Date(lead.created_at);
        const daysSinceUpdate = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
        const daysSinceCreated = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        const signals: string[] = [];
        let healthScore = 100;

        if (daysSinceUpdate > 30) { healthScore -= 40; signals.push('No interaction in 30+ days'); }
        else if (daysSinceUpdate > 14) { healthScore -= 20; signals.push('Quiet for 2 weeks'); }
        if (!lead.phone && !lead.email) { healthScore -= 15; signals.push('No contact info on file'); }

        let churnRisk: CustomerHealth['churn_risk'] = 'low';
        if (healthScore < 40) churnRisk = 'critical';
        else if (healthScore < 60) churnRisk = 'high';
        else if (healthScore < 80) churnRisk = 'medium';

        let recommendedPlay = 'Schedule quarterly business review';
        if (churnRisk === 'critical') recommendedPlay = 'Urgent executive outreach required';
        else if (churnRisk === 'high') recommendedPlay = 'Send personalized check-in + value update';
        else if (churnRisk === 'medium') recommendedPlay = 'Share case study / product update';

        return {
          lead_id: lead.id,
          name: lead.name,
          status: lead.status,
          health_score: Math.max(healthScore, 5),
          churn_risk: churnRisk,
          signals,
          last_activity: updatedAt.toLocaleDateString(),
          recommended_play: recommendedPlay,
        };
      });

      scored.sort((a, b) => a.health_score - b.health_score);
      setAccounts(scored);

      setStats({
        total: scored.length,
        critical: scored.filter(a => a.churn_risk === 'critical').length,
        atRisk: scored.filter(a => a.churn_risk === 'high').length,
        healthy: scored.filter(a => a.churn_risk === 'low').length,
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const dispatchRetention = async (account: CustomerHealth) => {
    setRunning(account.lead_id);
    try {
      const { error } = await supabase.functions.invoke('ai-workflow-executor', {
        body: {
          lead_id: account.lead_id,
          company_id: company?.id,
          trigger_type: 'manual',
          manual_trigger: false,
          trigger_data: { source: 'customer_health', churn_risk: account.churn_risk }
        }
      });
      if (error) throw error;
      toast({ title: 'Retention Play Queued', description: `AI agent will prepare a re-engagement for ${account.name}.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(null);
    }
  };

  const getRiskConfig = (risk: string) => {
    switch (risk) {
      case 'critical': return { color: 'bg-red-500/10 text-red-400 border-red-500/30', bar: 'bg-red-500', label: '🔴 Critical' };
      case 'high': return { color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', bar: 'bg-amber-500', label: '🟠 High Risk' };
      case 'medium': return { color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', bar: 'bg-blue-500', label: '🔵 Monitor' };
      default: return { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', bar: 'bg-emerald-500', label: '🟢 Healthy' };
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Heart className="h-6 w-6 text-rose-400" /> Customer Health
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Proactive churn prevention. Monitor health signals and deploy AI retention plays.</p>
        </div>
        <Button onClick={fetchAccounts} variant="outline" disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Recalculate
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Accounts Tracked', value: stats.total, icon: Users, color: 'text-blue-400' },
          { label: 'Critical Risk', value: stats.critical, icon: AlertTriangle, color: 'text-red-400' },
          { label: 'At Risk', value: stats.atRisk, icon: Clock, color: 'text-amber-400' },
          { label: 'Healthy', value: stats.healthy, icon: CheckCircle2, color: 'text-emerald-400' },
        ].map(s => (
          <Card key={s.label} className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{loading ? '—' : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Account Health List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : accounts.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl py-16 text-center text-muted-foreground">
          <Heart className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No customer accounts to monitor.</p>
          <p className="text-xs mt-1">Leads with status "paid", "won", "converted" will appear here.</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="space-y-3 pr-2">
            {accounts.map((account) => {
              const riskCfg = getRiskConfig(account.churn_risk);
              return (
                <Card key={account.lead_id} className="border-border hover:border-primary/30 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="font-bold text-lg">{account.name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-semibold">{account.name}</h3>
                          <Badge variant="outline" className={`text-xs ${riskCfg.color}`}>{riskCfg.label}</Badge>
                          <span className="ml-auto text-xs text-muted-foreground">Last active: {account.last_activity}</span>
                        </div>

                        <div className="flex items-center gap-3 mb-3">
                          <Progress value={account.health_score} className="h-1.5 flex-1" />
                          <span className="text-xs font-bold text-muted-foreground w-10 text-right">{account.health_score}%</span>
                        </div>

                        {account.signals.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {account.signals.map((s, i) => (
                              <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">{s}</span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-4">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Zap className="h-3 w-3 text-primary shrink-0" />
                            {account.recommended_play}
                          </p>
                          {account.churn_risk !== 'low' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10 shrink-0"
                              disabled={running === account.lead_id}
                              onClick={() => dispatchRetention(account)}
                            >
                              {running === account.lead_id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Heart className="h-3 w-3 mr-1" />}
                              Retention Play
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
