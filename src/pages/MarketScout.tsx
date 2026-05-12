import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Target, Zap, Globe, RefreshCcw, Search, 
  TrendingUp, Users, ArrowUpRight, CheckCircle2,
  Bot, ShieldCheck, Mail, MessageCircle, Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function MarketScout() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [triggers, setTriggers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScouting, setIsScouting] = useState(false);

  useEffect(() => {
    fetchTriggers();
  }, [session?.user]);

  const fetchTriggers = async () => {
    try {
      const { data, error } = await supabase
        .from('autonomous_market_triggers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTriggers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runScout = async () => {
    setIsScouting(true);
    try {
      const companyId = (session?.user as any)?.company_id;
      const { data, error } = await supabase.functions.invoke('autonomous-market-scout', {
        body: { companyId }
      });

      if (error) throw error;
      
      toast({
        title: "Intelligence Gathered",
        description: data.message,
      });
      fetchTriggers();
    } catch (err: any) {
      toast({
        title: "Scout Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsScouting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-black/95 min-h-screen text-slate-200">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/20 border border-primary/30">
              <Globe className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
              Autonomous Hunter
            </h1>
          </div>
          <p className="text-slate-400 max-w-xl flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Active Market Scanning: Identifying high-intent trigger events.
          </p>
        </div>
        <Button 
          onClick={runScout} 
          disabled={isScouting}
          className="gradient-primary h-12 px-8 rounded-xl shadow-lg shadow-primary/20 font-bold"
        >
          {isScouting ? (
            <RefreshCcw className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <Search className="h-5 w-5 mr-2" />
          )}
          Trigger Market Scan
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900/50 border-slate-800 glass relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Globe className="h-20 w-20" />
          </div>
          <CardContent className="pt-6">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Global Coverage</p>
            <h3 className="text-2xl font-black text-white">Full Pilot</h3>
            <p className="text-[10px] text-emerald-400 mt-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Monitoring 50+ Signal Sources
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 glass">
          <CardContent className="pt-6">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Opportunities Found</p>
            <h3 className="text-2xl font-black text-white">{triggers.length}</h3>
            <p className="text-[10px] text-slate-400 mt-2">Analyzed in the last 24 hours</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 glass">
          <CardContent className="pt-6">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Enlistment Yield</p>
            <h3 className="text-2xl font-black text-primary">84%</h3>
            <p className="text-[10px] text-slate-400 mt-2">Conversion to High-Intent Leads</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Intelligence Feed
            </h2>
            <Badge variant="outline" className="border-slate-800 bg-slate-900/50 text-slate-400">
              Live Updates
            </Badge>
          </div>

          <ScrollArea className="h-[600px] rounded-2xl border border-slate-800 bg-slate-900/40">
            {loading ? (
              <div className="p-10 text-center text-slate-500">Scanning for signals...</div>
            ) : triggers.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-10" />
                <p>No triggers identified yet. Initiate a scan to start.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {triggers.map((trigger) => (
                  <div key={trigger.id} className="p-6 hover:bg-slate-800/30 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-primary/20 transition-colors">
                          <Target className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase mb-1">
                            {trigger.event_type}
                          </Badge>
                          <h4 className="font-bold text-slate-100">{trigger.summary}</h4>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] text-slate-500">Confidence</span>
                        <span className="text-xs font-bold text-emerald-400">{(trigger.confidence_score * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    
                    <div className="ml-11 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="h-6 w-6 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] text-slate-400">
                              U{i}
                            </div>
                          ))}
                        </div>
                        <span className="text-xs text-slate-500">Leads enriched</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-primary hover:bg-primary/10">
                        View Details <ArrowUpRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Hunter Strategy
          </h2>
          <Card className="bg-slate-900/60 border-slate-800 border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Current ICP Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Target Industry</p>
                <p className="text-sm font-medium">B2B SaaS / FinTech</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Focus Signals</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300">Series B+</Badge>
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300">Tech Stack Migration</Badge>
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300">EMEA Expansion</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-950/40 to-slate-950 border-violet-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Bot className="h-5 w-5 text-violet-400" />
                <h4 className="font-bold text-sm">Autonomous Enlistment</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                The Hunter is currently in <strong>Semi-Auto</strong>. It identifies triggers and enriches leads, but waits for "AI Ops" approval to enlist them in workflows.
              </p>
              <Button size="sm" variant="outline" className="w-full h-9 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 gap-2">
                <ShieldCheck className="h-4 w-4" /> Switch to Full Pilot
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
