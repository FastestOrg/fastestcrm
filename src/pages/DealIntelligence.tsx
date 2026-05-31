import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Target, TrendingUp, TrendingDown, Zap, AlertTriangle,
  RefreshCcw, Activity, MessageCircle, Mail, Calendar,
  ChevronRight, BrainCircuit, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useLeadsTable } from '@/hooks/useLeadsTable';
import { useToast } from '@/hooks/use-toast';

interface DealScore {
  lead_id: string;
  name: string;
  status: string;
  score: number;
  risk_factors: string[];
  recommended_action: string;
  channel: string;
  days_stagnant: number;
}

export default function DealIntelligence() {
  const { tableName, companyId, loading: tableLoading } = useLeadsTable();
  const { company } = useCompany();
  const { toast } = useToast();
  const [deals, setDeals] = useState<DealScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, atRisk: 0, healthy: 0, avgScore: 0 });

  useEffect(() => {
    if (companyId && tableName) fetchDeals();
  }, [companyId, tableName]);

  const fetchDeals = async () => {
    if (!companyId || !tableName) return;
    setLoading(true);
    try {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - 2);

      const { data: leads } = await supabase
        .from(tableName as any)
        .select('id, name, status, updated_at, phone, email')
        .eq('company_id', companyId)
        .not('status', 'in', '("closed","won","lost","converted","archived")')
        .order('updated_at', { ascending: true })
        .limit(20);

      if (!leads) { setLoading(false); return; }

      const scored: DealScore[] = leads.map(lead => {
        const updatedAt = new Date(lead.updated_at);
        const daysStagnant = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
        const riskFactors: string[] = [];
        let score = 100;

        if (daysStagnant > 7) { score -= 30; riskFactors.push(`${daysStagnant} days without activity`); }
        else if (daysStagnant > 3) { score -= 15; riskFactors.push(`${daysStagnant} days stagnant`); }
        if (!lead.phone && !lead.email) { score -= 20; riskFactors.push('No contact info'); }
        if (!lead.phone) { score -= 5; riskFactors.push('No phone number'); }
        if (['new', 'cold'].includes(lead.status?.toLowerCase())) { score -= 10; riskFactors.push('Early stage lead'); }

        const channel = lead.phone ? 'WhatsApp' : lead.email ? 'Email' : 'Manual';
        let recommendedAction = 'Follow up with personalized message';
        if (daysStagnant > 14) recommendedAction = 'Urgent re-engagement needed';
        else if (daysStagnant > 7) recommendedAction = 'Schedule a demo call';
        else recommendedAction = 'Send value-add content';

        return {
          lead_id: lead.id,
          name: lead.name,
          status: lead.status,
          score: Math.max(score, 5),
          risk_factors: riskFactors,
          recommended_action: recommendedAction,
          channel,
          days_stagnant: daysStagnant,
        };
      });

      scored.sort((a, b) => a.score - b.score);
      setDeals(scored);

      const atRisk = scored.filter(d => d.score < 60).length;
      const avgScore = scored.length ? Math.round(scored.reduce((s, d) => s + d.score, 0) / scored.length) : 0;
      setStats({ total: scored.length, atRisk, healthy: scored.length - atRisk, avgScore });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleRunAgent = async (deal: DealScore) => {
    setRunning(deal.lead_id);
    try {
      const { data, error } = await supabase.functions.invoke('ai-workflow-executor', {
        body: {
          lead_id: deal.lead_id,
          company_id: company?.id,
          trigger_type: 'manual',
          manual_trigger: false,
          trigger_data: { source: 'deal_intelligence' }
        }
      });
      if (error) throw error;
      toast({ title: 'AI Agent Dispatched', description: `Decision queued in AI Ops Center for ${deal.name}.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-500/20';
    if (score >= 40) return 'bg-amber-500/20';
    return 'bg-red-500/20';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 70) return { label: 'Healthy', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    if (score >= 40) return { label: 'At Risk', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    return { label: 'Critical', color: 'bg-red-500/10 text-red-400 border-red-500/30' };
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-blue-400" /> Deal Intelligence
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time Deal Health Scores. AI-powered risk detection and autonomous intervention.</p>
        </div>
        <Button onClick={fetchDeals} variant="outline" disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh Scores
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Deals Tracked', value: stats.total, icon: Activity, color: 'text-blue-400' },
          { label: 'At Risk', value: stats.atRisk, icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Healthy', value: stats.healthy, icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Avg Health Score', value: `${stats.avgScore}%`, icon: BrainCircuit, color: 'text-primary' },
        ].map((stat) => (
          <Card key={stat.label} className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold">{loading ? '—' : stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deal Health List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : deals.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl py-16 text-center text-muted-foreground">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p>No active deals to analyze. Add leads to see health scores.</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="space-y-3 pr-2">
            {deals.map((deal) => {
              const risk = getRiskLabel(deal.score);
              return (
                <Card key={deal.lead_id} className="border-border hover:border-primary/30 transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Score Ring */}
                      <div className={`w-14 h-14 rounded-full ${getScoreBg(deal.score)} flex items-center justify-center shrink-0`}>
                        <span className={`text-lg font-black ${getScoreColor(deal.score)}`}>{deal.score}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-semibold">{deal.name}</h3>
                          <Badge variant="outline" className={`text-xs ${risk.color}`}>{risk.label}</Badge>
                          <Badge variant="outline" className="text-xs">{deal.status}</Badge>
                          <span className="text-xs text-muted-foreground ml-auto">{deal.days_stagnant}d inactive</span>
                        </div>

                        <Progress value={deal.score} className="h-1.5 mb-3" />

                        {deal.risk_factors.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {deal.risk_factors.map((rf, i) => (
                              <span key={i} className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                                {rf}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-4">
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Zap className="h-3 w-3 text-primary" />
                            {deal.recommended_action} via {deal.channel}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                            disabled={running === deal.lead_id}
                            onClick={() => handleRunAgent(deal)}
                          >
                            {running === deal.lead_id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <BrainCircuit className="h-3 w-3 mr-1" />}
                            Run AI Agent
                          </Button>
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
