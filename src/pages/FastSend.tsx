import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Mail, Users, Activity, Settings, Plus, Play, Pause, Trash2, Loader2, Bot, Wand2, Edit2, BarChart, AlignLeft, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { useEmailAccounts, EmailAccount } from '@/hooks/useEmailAccounts';
import { useEmailCampaigns, EmailCampaign, CampaignSequenceStep } from '@/hooks/useEmailCampaigns';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { generateFullDripCampaign, GeneratedEmail } from '@/services/emailAIService';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';

// ─── Accounts Tab ─────────────────────────────────────────────────────────────
function AccountsTab() {
    const { accounts, isLoading, createAccount, testConnection, deleteAccount, updateAccount, sendTestEmail } = useEmailAccounts();
    const [isConnecting, setIsConnecting] = useState(false);
    
    // Form state
    const [provider, setProvider] = useState('gmail');
    const [email, setEmail] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [password, setPassword] = useState(''); // App Password / SMTP Password
    
    // Advanced SMTP state
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState(587);
    const [smtpSecure, setSmtpSecure] = useState(true);
    const [smtpUser, setSmtpUser] = useState('');
    
    const [testRecipient, setTestRecipient] = useState('');
    const [dailyLimit, setDailyLimit] = useState(50);
    const [warmupEnabled, setWarmupEnabled] = useState(true);
    
    // Testing existing account state
    const [isTestingExisting, setIsTestingExisting] = useState(false);
    const [testingAccountId, setTestingAccountId] = useState<string | null>(null);

    // Auto-fill defaults
    React.useEffect(() => {
        if (provider === 'outlook') {
            setSmtpHost('smtp-mail.outlook.com');
            setSmtpPort(587);
            setSmtpSecure(true);
        } else if (provider === 'zoho') {
            setSmtpHost('smtp.zoho.com');
            setSmtpPort(587);
            setSmtpSecure(true);
        } else if (provider === 'gmail') {
            setSmtpHost('smtp.gmail.com');
            setSmtpPort(587);
        }
    }, [provider]);

    const handleConnect = async () => {
        if (provider === 'gmail') {
            // Initiate OAuth flow
            const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
            if (!clientId) {
                toast.error('Google Client ID is missing in environment variables');
                return;
            }
            const redirectUri = window.location.origin + '/google-oauth-callback';
            const scope = encodeURIComponent('https://mail.google.com/ https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
            
            window.location.href = authUrl;
            return;
        }

        if (!email.trim() || !password.trim()) {
            toast.error('Email and password required');
            return;
        }

        try {
            await createAccount.mutateAsync({
                provider,
                email_address: email,
                display_name: displayName,
                protocol: 'smtp_only',
                smtp_host: smtpHost,
                smtp_port: smtpPort,
                smtp_user: smtpUser || email,
                smtp_password: password,
                smtp_secure: smtpSecure,
                daily_limit: dailyLimit,
                warmup_enabled: warmupEnabled,
                warmup_daily_target: 5,
                warmup_ramp_per_day: 2,
            });
            setIsConnecting(false);
            // Reset
            setEmail('');
            setPassword('');
            setDisplayName('');
        } catch (e) {
            // Error handled by hook toast
        }
    };

    if (isLoading) return <div>Loading accounts...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Connected Accounts</h3>
                    <p className="text-sm text-muted-foreground">Manage your sender email addresses</p>
                </div>
                <Button onClick={() => setIsConnecting(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Email Account
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accounts.map(acc => (
                    <Card key={acc.id} className={acc.status === 'error' ? 'border-destructive' : ''}>
                        <CardHeader className="pb-2 text-sm">
                            <CardTitle className="flex justify-between items-center text-base">
                                <div className="truncate pr-2" title={acc.email_address}>{acc.email_address}</div>
                                <Badge variant={acc.status === 'connected' ? 'default' : acc.status === 'error' ? 'destructive' : 'secondary'}>
                                    {acc.status}
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                {acc.provider.toUpperCase()} • {acc.protocol === 'smtp_only' ? 'Send Only' : 'Send & Receive'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Provider Details</span>
                                    <span className="font-medium">{acc.provider === 'gmail' && (acc.smtp_host === 'smtp.gmail.com')}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Requires OAuth</span>
                                    <span className="font-medium text-destructive">Yes - Go to Integrations to setup App Password</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Sent Today</span>
                                    <span className="font-medium">
                                        {acc.emails_sent_today} / {acc.warmup_enabled ? Math.min(acc.daily_limit, acc.warmup_daily_target + (acc.warmup_current_day * acc.warmup_ramp_per_day)) : acc.daily_limit}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <Activity className="h-3 w-3" /> Warm-up
                                    </span>
                                    <Switch 
                                        checked={acc.warmup_enabled} 
                                        onCheckedChange={(val) => updateAccount.mutate({ accountId: acc.id, warmup_enabled: val })}
                                    />
                                </div>
                            </div>
                            
                            {acc.last_error && (
                                <p className="text-xs text-destructive mt-3 bg-red-50 p-2 rounded line-clamp-2" title={acc.last_error}>
                                    Error: {acc.last_error}
                                </p>
                            )}

                            <div className="mt-4 flex flex-col gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full" 
                                    onClick={() => {
                                        setTestingAccountId(acc.id);
                                        setIsTestingExisting(true);
                                    }}
                                >
                                    Test Connection
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" 
                                    disabled={deleteAccount.isPending && deleteAccount.variables === acc.id}
                                    onClick={() => deleteAccount.mutate(acc.id)}
                                >
                                    Remove Account
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isTestingExisting} onOpenChange={setIsTestingExisting}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Test Email Connection</DialogTitle>
                        <DialogDescription>
                            Enter a recipient email to send a real test message from this account.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Recipient Email</Label>
                            <Input 
                                placeholder="name@example.com" 
                                type="email" 
                                value={testRecipient} 
                                onChange={e => setTestRecipient(e.target.value)} 
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsTestingExisting(false)}>Cancel</Button>
                        <Button 
                            onClick={async () => {
                                if (!testingAccountId || !testRecipient) return;
                                try {
                                    await sendTestEmail.mutateAsync({
                                        accountId: testingAccountId,
                                        to: testRecipient
                                    });
                                    setIsTestingExisting(false);
                                } catch (e) {}
                            }}
                            disabled={sendTestEmail.isPending || !testRecipient}
                        >
                            {sendTestEmail.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send Test Email
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isConnecting} onOpenChange={setIsConnecting}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Connect Email Account</DialogTitle>
                        <DialogDescription>
                            Add an email account to send campaigns from. 
                            <br/><strong>Gmail Note:</strong> Use an App Password if 2FA is enabled.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                        <div className="space-y-2">
                            <Label>Provider</Label>
                            <Select value={provider} onValueChange={setProvider}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gmail">Gmail (OAuth)</SelectItem>
                                    <SelectItem value="outlook">Outlook / Office 365</SelectItem>
                                    <SelectItem value="zoho">Zoho Mail</SelectItem>
                                    <SelectItem value="custom">Custom SMTP (Advanced)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {provider !== 'gmail' && (
                            <>
                                <div className="space-y-2">
                                    <Label>Email Address</Label>
                                    <Input placeholder="you@company.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                                </div>

                                <div className="space-y-2">
                                    <Label>From Name (Display Name)</Label>
                                    <Input placeholder="e.g. John from FastestCRM" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                                </div>

                                <div className="space-y-2">
                                    <Label>Password / App Password</Label>
                                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
                                    <p className="text-xs text-muted-foreground">
                                        Generate an 'App Password' from your email provider settings.
                                    </p>
                                </div>

                                <div className="border-t pt-4 mt-2 space-y-4">
                                    <h4 className="text-sm font-medium flex items-center gap-2">
                                        <Settings className="w-4 h-4" /> SMTP Settings
                                    </h4>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>SMTP Host</Label>
                                            <Input placeholder="smtp.example.com" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>SMTP Port</Label>
                                            <Input type="number" value={smtpPort} onChange={e => setSmtpPort(Number(e.target.value))} />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label>SMTP Username (Optional)</Label>
                                        <Input placeholder="Usually same as email" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} />
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Switch id="smtp-secure" checked={smtpSecure} onCheckedChange={setSmtpSecure} />
                                        <Label htmlFor="smtp-secure">Use SSL/TLS</Label>
                                    </div>
                                </div>

                                <div className="border-t pt-4 mt-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                        <Play className="w-4 h-4 text-blue-600" /> Test Configuration
                                    </h4>
                                    <div className="flex gap-2">
                                        <Input 
                                            placeholder="Recipient for test email" 
                                            type="email" 
                                            value={testRecipient} 
                                            onChange={e => setTestRecipient(e.target.value)} 
                                            className="bg-white"
                                        />
                                        <Button 
                                            onClick={() => sendTestEmail.mutate({
                                                to: testRecipient,
                                                smtp_host: smtpHost,
                                                smtp_port: smtpPort,
                                                smtp_user: smtpUser || email,
                                                smtp_password: password,
                                                smtp_secure: smtpSecure,
                                                email_address: email
                                            })}
                                            disabled={sendTestEmail.isPending || !testRecipient || !email || !password || !smtpHost}
                                            variant="secondary"
                                            size="sm"
                                        >
                                            {sendTestEmail.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Test"}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <Label>Daily Send Limit</Label>
                                <Input type="number" value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))} min={1} max={2000} />
                            </div>
                            <div className="space-y-2 flex flex-col justify-end">
                                <div className="flex items-center space-x-2 h-10">
                                    <Checkbox id="warmup" checked={warmupEnabled} onCheckedChange={(val) => setWarmupEnabled(!!val)} />
                                    <Label htmlFor="warmup" className="cursor-pointer">Enable Warm-up</Label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsConnecting(false)}>Cancel</Button>
                        <Button onClick={handleConnect} disabled={createAccount.isPending || !email || !password}>
                            {createAccount.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Connect Email
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Campaigns Tab ────────────────────────────────────────────────────────────
function CampaignsTab(props: { onEdit: (campaign: any) => void }) {
    const { campaigns, isLoading, startCampaign, pauseCampaign, resumeCampaign, deleteCampaign } = useEmailCampaigns();

    if (isLoading) return <div>Loading campaigns...</div>;

    return (
        <div className="space-y-4">
            <div className="grid gap-4">
                {campaigns.map(camp => (
                    <Card key={camp.id}>
                        <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-4">
                            <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-lg">{camp.name}</h4>
                                    <Badge variant={camp.status === 'active' ? 'default' : camp.status === 'completed' ? 'secondary' : 'outline'} className={camp.status === 'active' ? 'bg-green-500' : ''}>
                                        {camp.status.toUpperCase()}
                                    </Badge>
                                    <Badge variant="outline" className="capitalize">{camp.campaign_mode} AI</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground flex gap-4">
                                    <span>Recipients: {camp.recipient_count}</span>
                                    <span>Goal: {camp.campaign_goal.replace('_', ' ')}</span>
                                    <span>Created: {format(new Date(camp.created_at), 'MMM d, yyyy')}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <CampaignAnalyticsBadge campaignId={camp.id} />

                                {(camp.status === 'draft' || camp.status === 'scheduled') && (
                                    <Button size="sm" onClick={() => startCampaign.mutate(camp.id)} disabled={startCampaign.isPending}>
                                        {startCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                        Start
                                    </Button>
                                )}
                                {camp.status === 'active' && (
                                    <Button variant="outline" size="sm" onClick={() => pauseCampaign.mutate(camp.id)} disabled={pauseCampaign.isPending}>
                                        {pauseCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pause className="mr-2 h-4 w-4" />}
                                        Pause
                                    </Button>
                                )}
                                {camp.status === 'paused' && (
                                    <Button variant="outline" size="sm" onClick={() => resumeCampaign.mutate(camp.id)} disabled={resumeCampaign.isPending}>
                                        {resumeCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                        Resume
                                    </Button>
                                )}
                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => {
                                    if(confirm('Delete this campaign? This cannot be undone.')) deleteCampaign.mutate(camp.id);
                                }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                
                {campaigns.length === 0 && (
                    <div className="text-center py-12 border rounded-lg bg-card">
                        <Mail className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
                        <h3 className="font-medium text-lg">No campaigns yet</h3>
                        <p className="text-muted-foreground">Click "New Campaign" to create your first AI-powered drip sequence.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Mini component to fetch and show analytics on the campaign card
function CampaignAnalyticsBadge({ campaignId }: { campaignId: string }) {
    const { useCampaignAnalytics } = useEmailCampaigns();
    const { data: stats } = useCampaignAnalytics(campaignId);

    if (!stats) return null;

    return (
        <div className="flex gap-4 px-4 py-2 bg-muted/30 rounded-lg mr-2 text-sm border">
            <div>
                <span className="text-muted-foreground">Open</span>
                <p className="font-semibold text-blue-600">{stats.openRate}%</p>
            </div>
            <div>
                <span className="text-muted-foreground">Reply</span>
                <p className="font-semibold text-green-600">{stats.replyRate}%</p>
            </div>
        </div>
    );
}


// ─── Campaign Builder Tab ───────────────────────────────────────────────────
function BuilderTab({ onCancel }: { onCancel: () => void }) {
    const { company } = useCompany();
    const { accounts } = useEmailAccounts();
    const { statuses } = useLeadStatuses();
    const { leadColumns, fetchLeads, createCampaign } = useEmailCampaigns();

    // Setup state
    const [name, setName] = useState('');
    const [goal, setGoal] = useState('meeting_booking');
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
    
    // Audience state
    const [leadStatus, setLeadStatus] = useState('all');
    const [emailField, setEmailField] = useState('email');
    
    // AI Generation state
    const [perspective, setPerspective] = useState('');
    const [productInfo, setProductInfo] = useState('');
    const [stepsCount, setStepsCount] = useState(4);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Sequences state
    const [sequences, setSequences] = useState<any[]>([]);
    
    // Settings state
    const [delayMs, setDelayMs] = useState(60000); // 1 min between emails

    const handleGenerateGenetic = async () => {
        if (!company?.id) return;
        setIsGenerating(true);
        try {
            const aiEmails = await generateFullDripCampaign({
                companyId: company.id,
                campaignGoal: goal as any,
                perspective,
                productInfo,
                numberOfSteps: stepsCount,
            });
            setSequences(aiEmails);
            toast.success('Campaign sequence generated!');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveCampaign = async () => {
        if (sequences.length === 0) {
            toast.error('Generate or add at least one email sequence');
            return;
        }

        try {
            const leads = await fetchLeads(leadStatus);
            if (leads.length === 0) {
                toast.error('No leads found for chosen segment');
                return;
            }

            await createCampaign.mutateAsync({
                name,
                campaignGoal: goal,
                campaignMode: 'genetic',
                accountIds: selectedAccounts,
                delayBetweenEmailsMs: delayMs,
                aiGenerated: true,
                aiPerspective: perspective,
                sequences,
                leads,
                emailField,
            });
            onCancel(); // Go back to list
        } catch (e) {
            // Handled in mutate
        }
    };

    // Update specific sequence step
    const updateSequence = (index: number, key: string, value: any) => {
        const newSeq = [...sequences];
        newSeq[index] = { ...newSeq[index], [key]: value };
        setSequences(newSeq);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">AI Campaign Builder</h2>
                    <p className="text-muted-foreground">Instantly generate high-converting drip sequences</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={handleSaveCampaign} disabled={createCampaign.isPending || !name || selectedAccounts.length === 0 || sequences.length === 0}>
                        {createCampaign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create & Save Campaign
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_400px] gap-6">
                
                {/* Left Col - Editor */}
                <div className="space-y-6">
                    {/* Setup Card */}
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg">1. Basic Setup</CardTitle>
                        </CardHeader>
                        <CardContent className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Campaign Name</Label>
                                <Input placeholder="e.g. Q4 SaaS Outreach" value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Select Senders</Label>
                                <Select value={selectedAccounts[0]} onValueChange={(val) => setSelectedAccounts([val])}>
                                    <SelectTrigger><SelectValue placeholder="Choose email account" /></SelectTrigger>
                                    <SelectContent>
                                        {accounts.filter(a => a.status === 'connected' || a.status === 'error').map(acc => (
                                            <SelectItem key={acc.id} value={acc.id}>{acc.email_address}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Target Audience (CRM Leads)</Label>
                                <Select value={leadStatus} onValueChange={setLeadStatus}>
                                    <SelectTrigger><SelectValue placeholder="Select segment" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Leads</SelectItem>
                                        {statuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Email Column</Label>
                                <Select value={emailField} onValueChange={setEmailField}>
                                    <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                                    <SelectContent>
                                        {leadColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Sequence Editor */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <CardTitle className="text-lg">2. Email Sequence</CardTitle>
                            <Badge variant="outline">{sequences.length} Steps</Badge>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {sequences.length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed bg-muted/10 rounded-lg">
                                    <Wand2 className="mx-auto h-8 w-8 text-primary mb-3" />
                                    <p className="font-medium">Use the AI panel to generate your sequence</p>
                                    <p className="text-sm text-muted-foreground mt-1 text-balance">
                                        Describe your goals on the right, and Gemini will instantly write a full multi-step drip campaign.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-6 relative border-l-2 border-muted ml-4 pl-6 pb-4">
                                    {sequences.map((seq, idx) => (
                                        <div key={idx} className="relative bg-card border rounded-lg p-4 shadow-sm group">
                                            {/* Timeline dot */}
                                            <div className="absolute -left-[35px] top-4 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold ring-4 ring-background">
                                                {idx + 1}
                                            </div>
                                            
                                            {/* Header */}
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-muted-foreground">EMAIL {idx + 1}</span>
                                                    {idx > 0 && (
                                                        <Badge variant="secondary" className="font-mono text-xs font-normal">
                                                            Wait {seq.delay_after_ms / 3600000}h • {seq.send_condition.replace('_', ' ')}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setSequences(sequences.filter((_, i) => i !== idx))}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            
                                            <div className="space-y-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Subject</Label>
                                                    <Input value={seq.subject} onChange={(e) => updateSequence(idx, 'subject', e.target.value)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Body</Label>
                                                    <Textarea 
                                                        value={seq.body_text || stripHtml(seq.body_html)} 
                                                        onChange={(e) => {
                                                            updateSequence(idx, 'body_text', e.target.value);
                                                            updateSequence(idx, 'body_html', `<p>${e.target.value.replace(/\n/g, '<br/>')}</p>`);
                                                        }}
                                                        className="min-h-[120px] font-mono text-sm leading-relaxed"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <Button variant="outline" className="w-full mt-4 border-dashed" onClick={() => {
                                        setSequences([...sequences, {
                                            step_number: sequences.length + 1,
                                            subject: '',
                                            body_html: '',
                                            body_text: '',
                                            delay_after_ms: 86400000,
                                            send_condition: 'if_no_reply'
                                        }]);
                                    }}>
                                        <Plus className="mr-2 h-4 w-4" /> Add Manual Step
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Col - AI Generator */}
                <div className="space-y-6">
                    <Card className="border-primary/20 shadow-sm overflow-hidden sticky top-4">
                        <div className="h-1 gradient-primary w-full" />
                        <CardHeader className="bg-primary/5 pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Bot className="h-5 w-5 text-primary" /> AI Matrix Generator
                            </CardTitle>
                            <CardDescription>Genetic mode writes the entire campaign at once</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Campaign Goal</Label>
                                <Select value={goal} onValueChange={setGoal}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sales">Soft Sell / Outreach</SelectItem>
                                        <SelectItem value="meeting_booking">Book a Meeting</SelectItem>
                                        <SelectItem value="app_download">App Download</SelectItem>
                                        <SelectItem value="other">Engagement</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Your Perspective</Label>
                                <Textarea 
                                    className="min-h-[100px] text-sm" 
                                    placeholder="Explain who you are and why you are emailing them..."
                                    value={perspective}
                                    onChange={e => setPerspective(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Offer / Product Details</Label>
                                <Textarea 
                                    className="min-h-[80px] text-sm" 
                                    placeholder="What are the key benefits?"
                                    value={productInfo}
                                    onChange={e => setProductInfo(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label>Number of Steps</Label>
                                    <span className="text-xs font-mono">{stepsCount} touchpoints</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="2" max="7" 
                                    value={stepsCount} 
                                    onChange={e => setStepsCount(Number(e.target.value))}
                                    className="w-full accent-primary"
                                />
                            </div>

                            <div className="pt-4 border-t">
                                <Button 
                                    className="w-full font-semibold" 
                                    onClick={handleGenerateGenetic}
                                    disabled={isGenerating || !perspective}
                                >
                                    {isGenerating ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Magic...</>
                                    ) : (
                                        <><Wand2 className="mr-2 h-4 w-4" /> Generate Sequence</>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}

// ─── Analytics & Logs Tabs ──────────────────────────────────────────────────
function AnalyticsTab() {
    const { campaigns, isLoading } = useEmailCampaigns();

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.filter(c => c.status !== 'draft').map(camp => (
                <AnalyticsCard key={camp.id} campaign={camp} />
            ))}
        </div>
    );
}

function AnalyticsCard({ campaign }: { campaign: any }) {
    const { useCampaignAnalytics } = useEmailCampaigns();
    const { data: stats } = useCampaignAnalytics(campaign.id);

    if (!stats) return <Card><CardContent className="p-6">Loading stats for {campaign.name}...</CardContent></Card>;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base truncate" title={campaign.name}>{campaign.name}</CardTitle>
                <CardDescription>Sent via {campaign.account_ids?.length || 0} accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Open Rate</span>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold">{stats.openRate}%</span>
                        </div>
                        <Progress value={stats.openRate} className="h-1.5" />
                    </div>
                    <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Reply Rate</span>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold">{stats.replyRate}%</span>
                        </div>
                        <Progress value={stats.replyRate} className="h-1.5" />
                    </div>
                </div>
                
                <div className="grid grid-cols-4 gap-2 pt-4 border-t text-center text-xs">
                    <div>
                        <div className="font-semibold">{stats.total}</div>
                        <div className="text-muted-foreground">Total</div>
                    </div>
                    <div>
                        <div className="font-semibold text-blue-600">{stats.completed}</div>
                        <div className="text-muted-foreground">Sent</div>
                    </div>
                    <div>
                        <div className="font-semibold text-green-600">{stats.opened}</div>
                        <div className="text-muted-foreground">Opens</div>
                    </div>
                    <div>
                        <div className="font-semibold text-red-600">{stats.bounced + stats.failed}</div>
                        <div className="text-muted-foreground">Failed</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Main Page Component ───────────────────────────────────────────────────
export default function FastSend() {
    const [viewMode, setViewMode] = useState<'list' | 'builder'>('list');

    if (viewMode === 'builder') {
        return <div className="p-4 md:p-8 pt-6"><BuilderTab onCancel={() => setViewMode('list')} /></div>;
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2 mb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">FastSend Email Engine</h2>
                    <p className="text-muted-foreground">AI-powered drip campaigns and outreach automation</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setViewMode('builder')} className="shadow-md">
                        <Plus className="mr-2 h-4 w-4" /> New Campaign
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="campaigns" className="space-y-4">
                <div className="border-b">
                    <TabsList className="bg-transparent h-12">
                        <TabsTrigger value="campaigns" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none shadow-none gap-2">
                            <AlignLeft className="h-4 w-4" /> Campaigns
                        </TabsTrigger>
                        <TabsTrigger value="accounts" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none shadow-none gap-2">
                            <Settings className="h-4 w-4" /> Email Accounts
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none shadow-none gap-2">
                            <BarChart className="h-4 w-4" /> Analytics
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="campaigns" className="m-0 pt-4">
                    <CampaignsTab onEdit={() => setViewMode('builder')} />
                </TabsContent>

                <TabsContent value="accounts" className="m-0 pt-4">
                    <AccountsTab />
                </TabsContent>

                <TabsContent value="analytics" className="m-0 pt-4">
                    <AnalyticsTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Utils
function stripHtml(html: string) {
    let doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
}
