import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Rocket, TrendingUp, Zap, BrainCircuit, Activity, Link2, 
  Copy, Plus, Loader2, Sparkles, Target, Share2, 
  BarChart3, Brain, ArrowUpRight, CheckCircle2, FlaskConical,
  MousePointerClick, MessageCircle
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import { useForms } from '@/hooks/useForms';
import { useLGLinks } from '@/hooks/useLGLinks';
import { useGrowthSettings } from '@/hooks/useGrowthSettings';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AIGrowthHacker() {
    const [caName, setCaName] = useState('');
    const [selectedForm, setSelectedForm] = useState('');
    const [utmCampaign, setUtmCampaign] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const { toast } = useToast();

    const { data: forms = [], isLoading: formsLoading } = useForms();
    const { links, loading: linksLoading, createLink } = useLGLinks();
    const { settings, loading: settingsLoading, updateSettings } = useGrowthSettings();

    const activeForms = forms.filter(f => f.status === 'active');

    const handleCreateLink = async () => {
        if (!caName || !selectedForm) {
            toast({
                title: "Missing Information",
                description: "Please select a form and enter a CA Name.",
                variant: "destructive"
            });
            return;
        }

        setIsCreating(true);
        const { data, error } = await createLink(selectedForm, caName, utmCampaign || undefined);
        setIsCreating(false);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to create link. Please try again.",
                variant: "destructive"
            });
            return;
        }

        const utmSource = caName.toLowerCase().replace(/\s+/g, '_');
        const baseUrl = `${window.location.origin}/form/${selectedForm}`;
        const params = new URLSearchParams({
            utm_source: utmSource,
            utm_medium: 'referral',
            ...(utmCampaign && { utm_campaign: utmCampaign }),
            link_id: data?.id || ''
        });
        const generatedLink = `${baseUrl}?${params.toString()}`;

        navigator.clipboard.writeText(generatedLink);
        toast({
            title: "Link Created & Copied!",
            description: "The link has been generated and copied to your clipboard.",
        });

        setCaName('');
        setSelectedForm('');
        setUtmCampaign('');
    };

    const copyLink = (link: any) => {
        const baseUrl = `${window.location.origin}/form/${link.form_id}`;
        const params = new URLSearchParams({
            utm_source: link.utm_source,
            utm_medium: link.utm_medium || 'referral',
            ...(link.utm_campaign && { utm_campaign: link.utm_campaign }),
            link_id: link.id
        });
        const url = `${baseUrl}?${params.toString()}`;
        navigator.clipboard.writeText(url);
        toast({
            title: "Copied",
            description: "Link copied to clipboard",
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    // Calculate simulated k-factor (leads per link)
    const kFactor = links.length > 0 
        ? (links.reduce((acc, curr) => acc + (curr.lead_count || 0), 0) / links.length).toFixed(2)
        : '0.00';

    return (
        <div className="p-6 md:p-8 space-y-8 min-h-screen">
            {/* Header with Hacker Aesthetic */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-emerald-500/20 p-8 shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-20%,_var(--tw-gradient-stops))] from-emerald-600/10 via-transparent to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                                <Rocket className="h-7 w-7 text-emerald-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>
                                    AI Growth Hacker
                                </h1>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] uppercase tracking-wider font-bold">
                                        Active Terminal
                                    </Badge>
                                    <span className="text-slate-500 text-xs font-mono">v4.2.0-stable</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-slate-400 max-w-xl leading-relaxed text-sm">
                            Autonomous growth engineering lab. AI is analyzing your conversion loops, identifying high-intent targets, and scaling your referral network in real-time.
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Current Growth Score</p>
                            <div className="flex items-center gap-2">
                                <span className="text-4xl font-black text-emerald-400 tracking-tighter">84</span>
                                <div className="flex flex-col items-start leading-tight">
                                    <span className="text-xs font-bold text-emerald-500/80 flex items-center">
                                        <TrendingUp className="h-3 w-3 mr-0.5" /> +12%
                                    </span>
                                    <span className="text-[10px] text-slate-600">vs last week</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Growth Matrix */}
                <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
                    {[
                        { label: 'Viral K-Factor', value: kFactor, icon: Share2, color: 'text-emerald-400', desc: 'Leads per referrer' },
                        { label: 'Growth Reach', value: links.reduce((a,c) => a + (c.lead_count || 0), 0), icon: Target, color: 'text-blue-400', desc: 'Total tracked leads' },
                        { label: 'Conversion Velocity', value: '4.2d', icon: Activity, color: 'text-amber-400', desc: 'Lead to paid time' },
                        { label: 'Autonomous ROI', value: '3.1x', icon: BarChart3, color: 'text-violet-400', desc: 'AI-driven returns' },
                    ].map((stat) => (
                        <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm group hover:border-emerald-500/30 transition-all duration-300">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`p-1.5 rounded-lg bg-black/40 ${stat.color}`}>
                                    <stat.icon className="h-4 w-4" />
                                </div>
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">{stat.label}</span>
                            </div>
                            <p className="text-2xl font-bold text-white mb-0.5">{stat.value}</p>
                            <p className="text-[10px] text-slate-500">{stat.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Strategy Lab & Prospecting Agent */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* AI Strategy Playbook */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <FlaskConical className="h-5 w-5 text-emerald-500" />
                            Growth Playbook
                        </h2>
                        <Button variant="ghost" size="sm" className="text-xs text-emerald-400 hover:text-emerald-300">
                            <Zap className="h-3 w-3 mr-1.5" /> Refresh Insights
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            {
                                title: "Viral Referral Loop",
                                desc: "Implement a 'Lead Magnet' discount for any lead who refers 3 others. Projected lift: +18% leads.",
                                impact: "High Impact",
                                difficulty: "Low effort",
                                status: "Recommended",
                                icon: Share2,
                                color: "emerald"
                            },
                            {
                                title: "Niche LinkedIn Extraction",
                                desc: "AI detected a trend in SaaS CEOs looking for EdTech solutions. Launch outbound campaign.",
                                impact: "Medium Impact",
                                difficulty: "Autonomous",
                                status: "Running",
                                icon: Target,
                                color: "blue"
                            },
                            {
                                title: "WhatsApp Drip Sequence",
                                desc: "Automate a 3-day value-add sequence for 'Interested' leads who haven't paid yet.",
                                impact: "High Impact",
                                difficulty: "Configured",
                                status: "Deployable",
                                icon: MessageCircleClick,
                                color: "amber"
                            },
                            {
                                title: "Contextual Content Loop",
                                desc: "Generate 5 landing pages targeting hyper-specific regional pain points found in CRM notes.",
                                impact: "Medium Impact",
                                difficulty: "Medium effort",
                                status: "Ready",
                                icon: Sparkles,
                                color: "violet"
                            }
                        ].map((play, i) => (
                            <Card key={i} className="border-border hover:border-emerald-500/40 transition-all cursor-pointer group bg-card/40 backdrop-blur-sm overflow-hidden">
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`p-2 rounded-lg bg-${play.color}-500/10`}>
                                            <play.icon className={`h-5 w-5 text-${play.color}-500`} />
                                        </div>
                                        <Badge variant="outline" className={`text-[10px] bg-${play.color}-500/5 text-${play.color}-400 border-${play.color}-500/20 uppercase tracking-widest px-2`}>
                                            {play.status}
                                        </Badge>
                                    </div>
                                    <h3 className="font-bold text-sm mb-2 group-hover:text-emerald-400 transition-colors">{play.title}</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed mb-4">{play.desc}</p>
                                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                        <div className="flex items-center gap-3">
                                          <div className="flex flex-col">
                                            <span className="text-[9px] uppercase font-bold text-slate-500">Impact</span>
                                            <span className="text-[10px] font-bold text-white">{play.impact}</span>
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="text-[9px] uppercase font-bold text-slate-500">Effort</span>
                                            <span className="text-[10px] font-bold text-white">{play.difficulty}</span>
                                          </div>
                                        </div>
                                        <Button size="sm" className="h-7 text-[10px] px-3 bg-white/10 hover:bg-white/20 border-white/10 text-white">
                                            Launch <ArrowUpRight className="h-3 w-3 ml-1" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Autonomous Scaling Agent */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <BrainCircuit className="h-5 w-5 text-emerald-500" />
                        Scaling Agent
                    </h2>
                    <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-lg overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <Brain className="h-20 w-20 text-emerald-500" />
                        </div>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
                                Autonomous Growth Engine
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 px-5">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-white uppercase tracking-wider">AI Enrichment</p>
                                    <p className="text-[10px] text-slate-500">Auto-research every new lead</p>
                                </div>
                                <Switch 
                                    checked={settings?.is_enabled || false} 
                                    onCheckedChange={(val) => updateSettings({ is_enabled: val })}
                                    disabled={settingsLoading}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-white uppercase tracking-wider">Auto-Outreach</p>
                                    <p className="text-[10px] text-slate-500">Trigger campaigns autonomously</p>
                                </div>
                                <Switch 
                                    checked={settings?.auto_outreach_enabled || false} 
                                    onCheckedChange={(val) => updateSettings({ auto_outreach_enabled: val })}
                                    disabled={settingsLoading || !settings?.is_enabled}
                                />
                            </div>
                            <div className="space-y-2 pt-2 border-t border-emerald-500/10">
                                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500">
                                    <span>Daily Scale Cap</span>
                                    <span className="text-emerald-400">{settings?.daily_budget_limit || 0} Leads</span>
                                </div>
                                <Input 
                                    type="number"
                                    className="h-8 bg-black/40 border-emerald-500/20 text-white text-xs"
                                    value={settings?.daily_budget_limit || 100}
                                    onChange={(e) => updateSettings({ daily_budget_limit: parseInt(e.target.value) || 0 })}
                                    disabled={settingsLoading}
                                />
                            </div>
                            <Button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9">
                                <Zap className="h-3 w-3 mr-2" /> Start Scaling Mode
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-card/40 backdrop-blur-sm">
                        <CardHeader className="pb-3 px-5">
                            <CardTitle className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <MousePointerClick className="h-3.5 w-3.5" /> Recent Conversions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 pb-5">
                          <ScrollArea className="h-[180px]">
                            <div className="space-y-3">
                                {links.slice(0, 5).map((link, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-white truncate max-w-[120px]">{link.ca_name}</span>
                                            <span className="text-[9px] text-slate-600 font-mono italic">{link.utm_source}</span>
                                        </div>
                                        <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[9px] h-4">
                                            {link.lead_count || 0} Leads
                                        </Badge>
                                    </div>
                                ))}
                                {links.length === 0 && (
                                    <p className="text-[10px] text-slate-600 italic text-center py-4">No viral activity tracked yet.</p>
                                )}
                            </div>
                          </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Viral Engineering Lab (Legacy LG) */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Share2 className="h-5 w-5 text-blue-500" />
                        Viral Referral Engine
                    </h2>
                    <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/20">
                        {links.length} Tracked Nodes
                    </Badge>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Generator */}
                    <Card className="lg:col-span-1 border-border bg-card/40 backdrop-blur-sm h-fit">
                        <CardHeader>
                            <CardTitle className="text-sm">Link Generator</CardTitle>
                            <CardDescription className="text-[10px]">Create trackable referral links for partners.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Referrer Name</label>
                                <Input
                                    placeholder="e.g. John Doe"
                                    className="h-8 text-xs bg-black/20"
                                    value={caName}
                                    onChange={(e) => setCaName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Target Form</label>
                                <Select value={selectedForm} onValueChange={setSelectedForm}>
                                    <SelectTrigger className="h-8 text-xs bg-black/20">
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {activeForms.map(form => (
                                            <SelectItem key={form.id} value={form.id} className="text-xs">{form.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                onClick={handleCreateLink}
                                className="w-full gradient-primary h-8 text-[10px] font-bold"
                                disabled={isCreating}
                            >
                                {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-2" />}
                                Generate Viral Link
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Table */}
                    <Card className="lg:col-span-3 border-border bg-card/40 backdrop-blur-sm">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-white/5">
                                        <TableHead className="text-[10px] uppercase font-bold py-2">Referrer / Source</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-2 text-right">Reach</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-2 text-right">Intention</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-2 text-right">Revenue</TableHead>
                                        <TableHead className="text-[10px] uppercase font-bold py-2 text-right">Growth</TableHead>
                                        <TableHead className="py-2"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {linksLoading ? (
                                        [1, 2, 3].map(i => (
                                            <TableRow key={i}>
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                                <TableCell></TableCell>
                                            </TableRow>
                                        ))
                                    ) : links.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-600">
                                                No tracked nodes found. Start your first growth experiment.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        links.map((link) => (
                                            <TableRow key={link.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{link.ca_name}</span>
                                                        <span className="text-[10px] text-slate-500 font-mono italic">{link.utm_source}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs">{link.lead_count || 0}</TableCell>
                                                <TableCell className="text-right font-mono text-xs text-emerald-400">{link.interested_count || 0}</TableCell>
                                                <TableCell className="text-right font-mono text-xs text-white">{formatCurrency(link.revenue_received || 0)}</TableCell>
                                                <TableCell className="text-right font-mono text-xs text-slate-500">{formatCurrency(link.revenue_projected || 0)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => copyLink(link)}
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// Helper icons missing in imports
const MessageCircleClick = (props: any) => (
    <div {...props} className="relative">
        <Activity className="h-full w-full" />
        <MousePointerClick className="absolute -bottom-1 -right-1 h-2/3 w-2/3" />
    </div>
);
