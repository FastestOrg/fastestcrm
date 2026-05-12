import { useState } from 'react';
// DashboardLayout removed
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link2, Copy, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForms } from '@/hooks/useForms';
import { useLGLinks } from '@/hooks/useLGLinks';
import { useGrowthSettings } from '@/hooks/useGrowthSettings';
import { Switch } from '@/components/ui/switch';
import { Wand2, Zap, BrainCircuit, Activity } from 'lucide-react';

export default function LGDashboard() {
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

    const copyLink = (link: typeof links[0]) => {
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

    return (
        <>
            <div className="p-8 space-y-8">
                <div>
                    <h1 className="text-2xl font-bold mb-2">Lead Generation Dashboard</h1>
                    <p className="text-muted-foreground">Create UTM-tracked links and monitor performance.</p>
                </div>

                {/* Autonomous Growth Engine Section */}
                <Card className="border-primary/20 bg-primary/5 shadow-lg overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <BrainCircuit className="h-24 w-24 text-primary" />
                    </div>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-primary">
                            <Wand2 className="h-5 w-5" />
                            Autonomous Growth Engine
                        </CardTitle>
                        <CardDescription>Configure AI to autonomously find, enrich, and engage leads in the background.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-background/50 border shadow-sm">
                                <div className="space-y-1">
                                    <h4 className="font-semibold flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-amber-500" />
                                        Autonomous Enrichment
                                    </h4>
                                    <p className="text-xs text-muted-foreground">Automatically research every new lead using Gemini AI.</p>
                                </div>
                                <Switch 
                                    checked={settings?.is_enabled || false} 
                                    onCheckedChange={(val) => updateSettings({ is_enabled: val })}
                                    disabled={settingsLoading}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-xl bg-background/50 border shadow-sm">
                                <div className="space-y-1">
                                    <h4 className="font-semibold flex items-center gap-2">
                                        <Activity className="h-4 w-4 text-green-500" />
                                        Auto-Outreach
                                    </h4>
                                    <p className="text-xs text-muted-foreground">Trigger "Agentic" campaigns immediately after enrichment.</p>
                                </div>
                                <Switch 
                                    checked={settings?.auto_outreach_enabled || false} 
                                    onCheckedChange={(val) => updateSettings({ auto_outreach_enabled: val })}
                                    disabled={settingsLoading || !settings?.is_enabled}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-xl bg-background/50 border shadow-sm">
                                <div className="space-y-1">
                                    <h4 className="font-semibold flex items-center gap-2">
                                        <Activity className="h-4 w-4 text-blue-500" />
                                        Approval Mode
                                    </h4>
                                    <p className="text-xs text-muted-foreground">Require human approval before AI sends messages.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                        {settings?.autonomy_mode === 'autonomous' ? 'Full Auto' : 'Review'}
                                    </span>
                                    <Switch 
                                        checked={settings?.autonomy_mode === 'autonomous'} 
                                        onCheckedChange={(val) => updateSettings({ autonomy_mode: val ? 'autonomous' : 'semi-autonomous' })}
                                        disabled={settingsLoading || !settings?.auto_outreach_enabled}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-xl bg-background/50 border shadow-sm">
                                <div className="space-y-1">
                                    <h4 className="font-semibold flex items-center gap-2 text-primary">
                                        <Zap className="h-4 w-4" />
                                        Channel Priority
                                    </h4>
                                    <p className="text-xs text-muted-foreground">Choose the AI's preferred outreach platform.</p>
                                </div>
                                <Select 
                                    value={settings?.preferred_channel || 'email'} 
                                    onValueChange={(val: any) => updateSettings({ preferred_channel: val })}
                                    disabled={settingsLoading}
                                >
                                    <SelectTrigger className="w-28 h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="email">Email</SelectItem>
                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 p-4 rounded-xl bg-background/50 border shadow-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-sm font-semibold">Daily Autonomy Budget</label>
                                    <span className="text-xs font-mono bg-primary/10 px-2 py-0.5 rounded text-primary">
                                        {settings?.daily_budget_limit || 0} Leads/Day
                                    </span>
                                </div>
                                <Input 
                                    type="number"
                                    className="h-8"
                                    value={settings?.daily_budget_limit || 100}
                                    onChange={(e) => updateSettings({ daily_budget_limit: parseInt(e.target.value) || 0 })}
                                    disabled={settingsLoading}
                                />
                                <p className="text-[10px] text-muted-foreground">Limits Gemini API and outreach volume to control costs.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Create Link Section */}
                <Card className="glass">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Link2 className="h-5 w-5 text-primary" />
                            Create Public Link with UTM Tracking
                        </CardTitle>
                        <CardDescription>Generate a unique lead form link with UTM parameters for tracking.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="text-sm text-muted-foreground mb-1 block">Select Form *</label>
                                <Select value={selectedForm} onValueChange={setSelectedForm}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a form" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {formsLoading ? (
                                            <SelectItem value="loading" disabled>Loading...</SelectItem>
                                        ) : activeForms.length === 0 ? (
                                            <SelectItem value="none" disabled>No active forms</SelectItem>
                                        ) : (
                                            activeForms.map(form => (
                                                <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground mb-1 block">CA Name (utm_source) *</label>
                                <Input
                                    placeholder="e.g., Rahul Kumar"
                                    value={caName}
                                    onChange={(e) => setCaName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground mb-1 block">Campaign (utm_campaign)</label>
                                <Input
                                    placeholder="e.g., summer_2024"
                                    value={utmCampaign}
                                    onChange={(e) => setUtmCampaign(e.target.value)}
                                />
                            </div>
                            <div className="flex items-end">
                                <Button
                                    onClick={handleCreateLink}
                                    className="gradient-primary w-full"
                                    disabled={isCreating}
                                >
                                    {isCreating ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4 mr-2" />
                                    )}
                                    Generate Link
                                </Button>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                            UTM parameters: utm_source={caName ? caName.toLowerCase().replace(/\s+/g, '_') : '[ca_name]'},
                            utm_medium=referral
                            {utmCampaign && `, utm_campaign=${utmCampaign}`}
                        </p>
                    </CardContent>
                </Card>

                {/* Reporting Table */}
                <Card className="glass">
                    <CardHeader>
                        <CardTitle>Link Performance</CardTitle>
                        <CardDescription>Track leads and revenue generated by each link.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {linksLoading ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>CA Name</TableHead>
                                        <TableHead>Form</TableHead>
                                        <TableHead>UTM Source</TableHead>
                                        <TableHead>Campaign</TableHead>
                                        <TableHead className="text-right">Total Leads</TableHead>
                                        <TableHead className="text-right">Interested</TableHead>
                                        <TableHead className="text-right">Paid</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                        <TableHead className="text-right">Projected</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[1, 2, 3].map((i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : links.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No links created yet. Create your first link above.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>CA Name</TableHead>
                                        <TableHead>Form</TableHead>
                                        <TableHead>UTM Source</TableHead>
                                        <TableHead>Campaign</TableHead>
                                        <TableHead className="text-right">Total Leads</TableHead>
                                        <TableHead className="text-right">Interested</TableHead>
                                        <TableHead className="text-right">Paid</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                        <TableHead className="text-right">Projected</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {links.map((link) => (
                                        <TableRow key={link.id}>
                                            <TableCell className="font-medium">{link.ca_name}</TableCell>
                                            <TableCell>{link.form?.name || '-'}</TableCell>
                                            <TableCell className="text-muted-foreground">{link.utm_source}</TableCell>
                                            <TableCell className="text-muted-foreground">{link.utm_campaign || '-'}</TableCell>
                                            <TableCell className="text-right">{link.lead_count || 0}</TableCell>
                                            <TableCell className="text-right">{link.interested_count || 0}</TableCell>
                                            <TableCell className="text-right">{link.paid_count || 0}</TableCell>
                                            <TableCell className="text-right text-success font-medium">
                                                {formatCurrency(link.revenue_received || 0)}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {formatCurrency(link.revenue_projected || 0)}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => copyLink(link)}
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
