import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Mail, Users, Activity, Settings, Plus, Play, Pause, Trash2, Loader2, Bot, Wand2, Edit2, BarChart, AlignLeft, CalendarClock, Inbox, RefreshCcw, Reply, ArrowLeft, Search, Eye, MousePointerClick, Send, TrendingUp, Clock, ChevronRight, Zap, Target, Brain, Sparkles, ArrowUpRight, Filter, Hash, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { useEmailAccounts, EmailAccount } from '@/hooks/useEmailAccounts';
import { useEmailCampaigns, EmailCampaign, CampaignSequenceStep } from '@/hooks/useEmailCampaigns';
import { useEmailInbox, EmailThread, EmailMessage } from '@/hooks/useEmailInbox';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { generateFullDripCampaign, GeneratedEmail } from '@/services/emailAIService';
import { useCompany } from '@/hooks/useCompany';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// ─── Accounts Tab ─────────────────────────────────────────────────────────────
function AccountsTab() {
    const { accounts, isLoading, createAccount, testConnection, deleteAccount, updateAccount, sendTestEmail } = useEmailAccounts();
    const [isConnecting, setIsConnecting] = useState(false);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    
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
    
    // IMAP State
    const [protocol, setProtocol] = useState<'smtp_only' | 'imap_smtp'>('smtp_only');
    const [imapHost, setImapHost] = useState('');
    const [imapPort, setImapPort] = useState(993);
    const [imapUser, setImapUser] = useState('');
    const [imapPassword, setImapPassword] = useState('');
    
    // Testing existing account state
    const [isTestingExisting, setIsTestingExisting] = useState(false);
    const [testingAccountId, setTestingAccountId] = useState<string | null>(null);

    // Auto-fill defaults
    React.useEffect(() => {
        if (provider === 'outlook') {
            setSmtpHost('smtp-mail.outlook.com');
            setSmtpPort(587);
            setSmtpSecure(true);
            setImapHost('outlook.office365.com');
            setImapPort(993);
        } else if (provider === 'zoho') {
            setSmtpHost('smtp.zoho.com');
            setSmtpPort(587);
            setSmtpSecure(true);
            setImapHost('imap.zoho.com');
            setImapPort(993);
        } else if (provider === 'gmail') {
            setSmtpHost('smtp.gmail.com');
            setSmtpPort(587);
            setImapHost('imap.gmail.com');
            setImapPort(993);
        }
    }, [provider]);

    const handleConnect = async () => {
        if (provider === 'gmail') {
            // Use the Google Client ID provided by user
            const clientId = '1033874890501-p253hb5at1qb077rcoitv6pjc9elf75n.apps.googleusercontent.com';
            
            const redirectUri = window.location.origin + '/google-oauth-callback';
            const scope = encodeURIComponent('https://mail.google.com/ https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');
            const state = encodeURIComponent(window.location.pathname);
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;
            
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
                protocol: protocol,
                smtp_host: smtpHost,
                smtp_port: smtpPort,
                smtp_user: smtpUser || email,
                smtp_password: password,
                smtp_secure: smtpSecure,
                imap_host: protocol === 'imap_smtp' ? imapHost : null,
                imap_port: protocol === 'imap_smtp' ? imapPort : null,
                imap_user: protocol === 'imap_smtp' ? (imapUser || email) : null,
                imap_password: protocol === 'imap_smtp' ? (imapPassword || password) : null,
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
                                    <span className="font-medium">{acc.provider === 'gmail' ? 'smtp.gmail.com' : acc.smtp_host || 'Not set'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Connection Mode</span>
                                    <span className={`font-medium ${acc.provider === 'gmail' ? 'text-green-600' : 'text-blue-600'}`}>
                                        {acc.provider === 'gmail' ? 'Google OAuth 2.0' : 'Standard SMTP'}
                                    </span>
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
                                    <SelectItem value="custom">Custom SMTP / IMAP</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Mode</Label>
                            <Select value={protocol} onValueChange={(val: any) => setProtocol(val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="smtp_only">Send Only (SMTP)</SelectItem>
                                    <SelectItem value="imap_smtp">Send & Receive (SMTP + IMAP)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold px-1">
                                {protocol === 'imap_smtp' ? 'Enables inbox and two-way communication' : 'Optimized for outbound campaigns only'}
                            </p>
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

                                {protocol === 'imap_smtp' && (
                                    <div className="border-t pt-4 mt-2 space-y-4">
                                        <h4 className="text-sm font-medium flex items-center gap-2">
                                            <Inbox className="w-4 h-4" /> IMAP Settings
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>IMAP Host</Label>
                                                <Input placeholder="imap.example.com" value={imapHost} onChange={e => setImapHost(e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>IMAP Port</Label>
                                                <Input type="number" value={imapPort} onChange={e => setImapPort(Number(e.target.value))} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>IMAP Username</Label>
                                            <Input placeholder="Usually same as email" value={imapUser} onChange={e => setImapUser(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>IMAP Password</Label>
                                            <Input type="password" placeholder="Usually same as SMTP passwd" value={imapPassword} onChange={e => setImapPassword(e.target.value)} />
                                        </div>
                                    </div>
                                )}

                                <div className="border-t pt-4 mt-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                        <Play className="w-4 h-4 text-blue-600" /> Test Configuration
                                    </h4>
                                    <div className="flex flex-col gap-3">
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
                                                {sendTestEmail.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Test Email"}
                                            </Button>
                                        </div>
                                        
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="w-full bg-white border-blue-200 text-blue-600 hover:bg-blue-50"
                                            onClick={() => testConnection.mutate({
                                                provider,
                                                email,
                                                protocol,
                                                smtpHost,
                                                smtpPort,
                                                smtpUser: smtpUser || email,
                                                smtpPassword: password,
                                                smtpSecure,
                                                imapHost,
                                                imapPort,
                                                imapUser: imapUser || email,
                                                imapPassword: imapPassword || password
                                            } as any)}
                                            disabled={testConnection.isPending || !email || !password}
                                        >
                                            {testConnection.isPending ? (
                                                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Testing...</>
                                            ) : (
                                                <><Activity className="w-4 h-4 mr-2" /> Test Credentials (SMTP + IMAP)</>
                                            )}
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
                        <Button 
                            onClick={handleConnect} 
                            disabled={createAccount.isPending || (provider !== 'gmail' && (!email || !password))}
                        >
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
function CampaignsTab(props: { onEdit: (campaign: any) => void; onOpenDetail: (campaign: any) => void }) {
    const { campaigns, isLoading, startCampaign, pauseCampaign, resumeCampaign, deleteCampaign } = useEmailCampaigns();

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>;

    return (
        <div className="space-y-4">
            <div className="grid gap-4">
                {campaigns.map(camp => (
                    <Card key={camp.id} className="group hover:border-primary/40 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-primary/5" onClick={() => props.onOpenDetail(camp)}>
                        <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 gap-4">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-semibold text-lg">{camp.name}</h4>
                                    <Badge variant={camp.status === 'active' ? 'default' : camp.status === 'completed' ? 'secondary' : 'outline'} className={camp.status === 'active' ? 'bg-green-500' : ''}>
                                        {camp.status.toUpperCase()}
                                    </Badge>
                                    <Badge variant="outline" className="capitalize">{camp.campaign_mode} AI</Badge>
                                    {(camp as any).ai_auto_reply_enabled && (
                                        <Badge variant="outline" className="border-purple-400/50 text-purple-400 gap-1 animate-pulse">
                                            <Bot className="h-3 w-3" /> AI Autopilot
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground flex gap-4 flex-wrap">
                                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Recipients: {camp.recipient_count}</span>
                                    <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Goal: {camp.campaign_goal.replace('_', ' ')}</span>
                                    <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {format(new Date(camp.created_at), 'MMM d, yyyy')}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 w-full md:w-auto" onClick={e => e.stopPropagation()}>
                                <CampaignAnalyticsBadge campaignId={camp.id} recipientCount={camp.recipient_count} />

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
                                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
function CampaignAnalyticsBadge({ campaignId, recipientCount }: { campaignId: string; recipientCount: number }) {
    const { useCampaignAnalytics } = useEmailCampaigns();
    const { data: stats } = useCampaignAnalytics(campaignId);

    if (!stats) return null;

    return (
        <div className="flex gap-3 px-4 py-2 bg-muted/30 rounded-lg mr-2 text-sm border items-center">
            <div className="text-center">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Sent</span>
                <p className="font-bold text-primary">{stats.sent}<span className="text-muted-foreground font-normal">/{recipientCount}</span></p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Open</span>
                <p className="font-semibold text-blue-500">{stats.openRate}%</p>
            </div>
            <div className="text-center">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Reply</span>
                <p className="font-semibold text-green-500">{stats.replyRate}%</p>
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
    const [autopilotEnabled, setAutopilotEnabled] = useState(false);
    
    // Sequences state
    const [sequences, setSequences] = useState<any[]>([]);
    
    // Settings state
    const [delayMs, setDelayMs] = useState(60000); // 1 min between emails

    const handleGenerateAgentic = async () => {
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
                campaignMode: 'agentic',
                accountIds: selectedAccounts,
                delayBetweenEmailsMs: delayMs,
                aiGenerated: true,
                aiPerspective: perspective,
                aiAutoReplyEnabled: autopilotEnabled,
                aiAutoReplyGoal: goal,
                aiAutoReplyPerspective: perspective,
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
                            <CardDescription>Agentic mode writes the entire campaign at once</CardDescription>
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

                            <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-primary/5 border-primary/20 mt-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-primary flex items-center gap-2">
                                        <Bot className="h-4 w-4" /> AI Autopilot
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Let Gemini fully negotiate and reply to incoming leads automatically to reach your goal.
                                    </p>
                                </div>
                                <Switch
                                    checked={autopilotEnabled}
                                    onCheckedChange={setAutopilotEnabled}
                                />
                            </div>

                            <div className="pt-4 border-t mt-4">
                                <Button 
                                    className="w-full font-semibold" 
                                    onClick={handleGenerateAgentic}
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

// ─── Campaign Detail View (Full Analytics Dashboard) ─────────────────────────
function CampaignDetailView({ campaign, onBack }: { campaign: EmailCampaign; onBack: () => void }) {
    const { useCampaignAnalytics, useCampaignRecipients, useCampaignLogs, useCampaignSequences, startCampaign, pauseCampaign, resumeCampaign } = useEmailCampaigns();
    const { data: stats, isLoading: statsLoading } = useCampaignAnalytics(campaign.id);
    const { data: recipients } = useCampaignRecipients(campaign.id);
    const { data: logs } = useCampaignLogs({ campaignId: campaign.id });
    const { data: sequences } = useCampaignSequences(campaign.id);
    const [recipientFilter, setRecipientFilter] = useState('all');
    const [recipientSearch, setRecipientSearch] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    const filteredRecipients = useMemo(() => {
        if (!recipients) return [];
        let filtered = recipients as any[];
        if (recipientFilter !== 'all') filtered = filtered.filter(r => r.status === recipientFilter);
        if (recipientSearch) {
            const q = recipientSearch.toLowerCase();
            filtered = filtered.filter(r => (r.lead_name || '').toLowerCase().includes(q) || (r.lead_email || '').toLowerCase().includes(q));
        }
        return filtered;
    }, [recipients, recipientFilter, recipientSearch]);

    const statusColors: Record<string, string> = {
        pending: 'bg-gray-500/20 text-gray-400',
        in_progress: 'bg-blue-500/20 text-blue-400',
        completed: 'bg-emerald-500/20 text-emerald-400',
        replied: 'bg-green-500/20 text-green-400',
        bounced: 'bg-orange-500/20 text-orange-400',
        failed: 'bg-red-500/20 text-red-400',
        unsubscribed: 'bg-yellow-500/20 text-yellow-400',
    };

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold tracking-tight">{campaign.name}</h2>
                            <Badge variant={campaign.status === 'active' ? 'default' : 'outline'} className={campaign.status === 'active' ? 'bg-green-500' : ''}>
                                {campaign.status.toUpperCase()}
                            </Badge>
                            {(campaign as any).ai_auto_reply_enabled && (
                                <Badge variant="outline" className="border-purple-400/50 text-purple-400 gap-1">
                                    <Bot className="h-3 w-3 animate-pulse" /> AI Autopilot Active
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Created {format(new Date(campaign.created_at), 'MMM d, yyyy')} • Goal: {campaign.campaign_goal.replace('_', ' ')} • {campaign.campaign_mode} AI
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {campaign.status === 'active' && (
                        <Button variant="outline" size="sm" onClick={() => pauseCampaign.mutate(campaign.id)}><Pause className="mr-2 h-4 w-4" /> Pause</Button>
                    )}
                    {campaign.status === 'paused' && (
                        <Button size="sm" onClick={() => resumeCampaign.mutate(campaign.id)}><Play className="mr-2 h-4 w-4" /> Resume</Button>
                    )}
                    {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                        <Button size="sm" onClick={() => startCampaign.mutate(campaign.id)}><Zap className="mr-2 h-4 w-4" /> Launch Campaign</Button>
                    )}
                </div>
            </div>

            {/* Hero Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                        { label: 'Recipients', value: stats.total, icon: Users, color: 'text-foreground' },
                        { label: 'Emails Sent', value: stats.sent, icon: Send, color: 'text-primary' },
                        { label: 'Opened', value: stats.opened, icon: Eye, color: 'text-blue-500', sub: `${stats.openRate}%` },
                        { label: 'Replied', value: stats.replied, icon: Reply, color: 'text-green-500', sub: `${stats.replyRate}%` },
                        { label: 'Clicked', value: stats.clicked, icon: MousePointerClick, color: 'text-purple-500', sub: `${stats.clickRate}%` },
                        { label: 'Failed', value: stats.bounced + stats.failed, icon: XCircle, color: 'text-red-500' },
                    ].map((stat) => (
                        <Card key={stat.label} className="border-border/50 bg-card/50 backdrop-blur">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <stat.icon className={`h-4 w-4 ${stat.color} opacity-70`} />
                                    {stat.sub && <span className={`text-xs font-semibold ${stat.color}`}>{stat.sub}</span>}
                                </div>
                                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                                <p className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wider">{stat.label}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Sending Progress */}
            {stats && stats.total > 0 && (
                <Card className="border-border/50">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Campaign Progress</span>
                            <span className="text-xs text-muted-foreground">{stats.sent} of {stats.total} emails sent ({Math.round((stats.sent / Math.max(stats.total, 1)) * 100)}%)</span>
                        </div>
                        <Progress value={(stats.sent / Math.max(stats.total, 1)) * 100} className="h-2" />
                    </CardContent>
                </Card>
            )}

            {/* Tabs: Overview / Recipients / Activity */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-muted/50">
                    <TabsTrigger value="overview" className="gap-2"><BarChart className="h-3.5 w-3.5" /> Overview</TabsTrigger>
                    <TabsTrigger value="recipients" className="gap-2"><Users className="h-3.5 w-3.5" /> Recipients ({stats?.total || 0})</TabsTrigger>
                    <TabsTrigger value="activity" className="gap-2"><Activity className="h-3.5 w-3.5" /> Activity Log</TabsTrigger>
                </TabsList>

                {/* OVERVIEW Tab */}
                <TabsContent value="overview" className="mt-4 space-y-6">
                    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
                        {/* Sequence Steps */}
                        <Card>
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base flex items-center gap-2"><AlignLeft className="h-4 w-4" /> Sequence Performance</CardTitle>
                                <CardDescription>{stats?.totalSteps || 0} email steps in this campaign</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {stats?.stepStats?.map((step, idx) => (
                                    <div key={idx} className="relative border rounded-lg p-4 bg-muted/20">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">{step.stepNumber}</div>
                                                <div>
                                                    <p className="font-medium text-sm line-clamp-1">{step.subject}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase">{step.condition.replace('_', ' ')}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-4 gap-3 text-center text-xs">
                                            <div><span className="font-bold text-lg text-primary block">{step.sent}</span><span className="text-muted-foreground">Sent</span></div>
                                            <div><span className="font-bold text-lg text-blue-500 block">{step.opened}</span><span className="text-muted-foreground">Opened</span></div>
                                            <div><span className="font-bold text-lg text-green-500 block">{step.replied}</span><span className="text-muted-foreground">Replied</span></div>
                                            <div><span className="font-bold text-lg text-purple-500 block">{step.clicked}</span><span className="text-muted-foreground">Clicked</span></div>
                                        </div>
                                        {step.sent > 0 && (
                                            <div className="mt-3 flex gap-1">
                                                <div className="h-1.5 rounded-full bg-blue-500/80" style={{ width: `${(step.opened / step.sent) * 100}%` }} />
                                                <div className="h-1.5 rounded-full bg-green-500/80" style={{ width: `${(step.replied / step.sent) * 100}%` }} />
                                                <div className="h-1.5 rounded-full bg-muted flex-1" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(!stats?.stepStats || stats.stepStats.length === 0) && (
                                    <p className="text-center text-muted-foreground py-8">No sequence data yet</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* AI Agent Panel */}
                        <div className="space-y-4">
                            <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Brain className="h-4 w-4 text-purple-400" /> AI Agent Intelligence
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${(campaign as any).ai_auto_reply_enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                                            <span className="text-sm font-medium">Autopilot Mode</span>
                                        </div>
                                        <Badge variant={(campaign as any).ai_auto_reply_enabled ? 'default' : 'secondary'}>
                                            {(campaign as any).ai_auto_reply_enabled ? 'ACTIVE' : 'OFF'}
                                        </Badge>
                                    </div>
                                    <div className="space-y-3 text-sm">
                                        <div>
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Campaign Goal</span>
                                            <p className="font-medium capitalize mt-1">{campaign.campaign_goal.replace('_', ' ')}</p>
                                        </div>
                                        {(campaign as any).ai_perspective && (
                                            <div>
                                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Perspective</span>
                                                <p className="text-muted-foreground mt-1 line-clamp-3">{(campaign as any).ai_perspective}</p>
                                            </div>
                                        )}
                                    </div>
                                    {(campaign as any).ai_auto_reply_enabled && (
                                        <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                                                <span className="text-xs font-semibold text-purple-400">AI STATUS</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                AI is autonomously engaging with leads who reply. Gemini analyzes conversation context and responds to move toward your campaign goal.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Status Breakdown */}
                            {stats && (
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">Recipient Status</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {[
                                            { label: 'Pending', count: stats.pending, color: 'bg-gray-500' },
                                            { label: 'In Progress', count: stats.in_progress, color: 'bg-blue-500' },
                                            { label: 'Completed', count: stats.completed, color: 'bg-emerald-500' },
                                            { label: 'Replied', count: stats.replied, color: 'bg-green-500' },
                                            { label: 'Bounced', count: stats.bounced, color: 'bg-orange-500' },
                                            { label: 'Failed', count: stats.failed, color: 'bg-red-500' },
                                        ].filter(s => s.count > 0).map(s => (
                                            <div key={s.label} className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                                                    <span>{s.label}</span>
                                                </div>
                                                <span className="font-semibold">{s.count}</span>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* RECIPIENTS Tab */}
                <TabsContent value="recipients" className="mt-4">
                    <Card>
                        <CardHeader className="pb-4">
                            <div className="flex flex-col sm:flex-row justify-between gap-3">
                                <CardTitle className="text-base">Recipients</CardTitle>
                                <div className="flex gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="Search name or email..." className="pl-9 h-9 w-[250px]" value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} />
                                    </div>
                                    <Select value={recipientFilter} onValueChange={setRecipientFilter}>
                                        <SelectTrigger className="w-[150px] h-9"><Filter className="h-3.5 w-3.5 mr-2" /><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Status</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="in_progress">In Progress</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                            <SelectItem value="replied">Replied</SelectItem>
                                            <SelectItem value="failed">Failed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-center">Step</TableHead>
                                            <TableHead className="text-center">Opened</TableHead>
                                            <TableHead className="text-center">Replied</TableHead>
                                            <TableHead>Last Sent</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRecipients.slice(0, 100).map((r: any) => (
                                            <TableRow key={r.id} className="text-sm">
                                                <TableCell className="font-medium">{r.lead_name || '—'}</TableCell>
                                                <TableCell className="text-muted-foreground">{r.lead_email}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={statusColors[r.status] || ''}>{r.status}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center">{r.current_step}/{stats?.totalSteps || '?'}</TableCell>
                                                <TableCell className="text-center">{r.opened_at ? <Eye className="h-4 w-4 text-blue-500 mx-auto" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                                                <TableCell className="text-center">{r.replied_at ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                                                <TableCell className="text-muted-foreground text-xs">{r.last_sent_at ? format(new Date(r.last_sent_at), 'MMM d, h:mm a') : '—'}</TableCell>
                                            </TableRow>
                                        ))}
                                        {filteredRecipients.length === 0 && (
                                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No recipients match your filters</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {filteredRecipients.length > 100 && (
                                <p className="text-center py-3 text-xs text-muted-foreground border-t">Showing 100 of {filteredRecipients.length} recipients</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ACTIVITY LOG Tab */}
                <TabsContent value="activity" className="mt-4">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Email Activity Log</CardTitle>
                            <CardDescription>Recent email sends and tracking events</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y max-h-[600px] overflow-y-auto">
                                {(logs || []).slice(0, 50).map((log: any) => (
                                    <div key={log.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                            log.status === 'opened' ? 'bg-blue-500/20 text-blue-400' :
                                            log.status === 'replied' ? 'bg-green-500/20 text-green-400' :
                                            log.status === 'clicked' ? 'bg-purple-500/20 text-purple-400' :
                                            log.status === 'bounced' || log.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                            'bg-primary/20 text-primary'
                                        }`}>
                                            {log.status === 'opened' ? <Eye className="h-4 w-4" /> :
                                             log.status === 'replied' ? <Reply className="h-4 w-4" /> :
                                             log.status === 'clicked' ? <MousePointerClick className="h-4 w-4" /> :
                                             log.status === 'failed' || log.status === 'bounced' ? <XCircle className="h-4 w-4" /> :
                                             <Send className="h-4 w-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{log.recipient_email}</p>
                                            <p className="text-xs text-muted-foreground truncate">{log.subject || 'No subject'}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <Badge variant="outline" className="text-[10px]">{log.status}</Badge>
                                            <p className="text-[10px] text-muted-foreground mt-1">{log.sent_at ? format(new Date(log.sent_at), 'MMM d, h:mm a') : ''}</p>
                                        </div>
                                    </div>
                                ))}
                                {(!logs || logs.length === 0) && (
                                    <p className="text-center py-12 text-muted-foreground">No activity yet. Start the campaign to see email sends here.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ─── Analytics & Logs Tabs ──────────────────────────────────────────────────
function AnalyticsTab() {
    const { campaigns, isLoading } = useEmailCampaigns();

    if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>;

    const activeCampaigns = campaigns.filter(c => c.status !== 'draft');

    return (
        <div className="space-y-6">
            {activeCampaigns.length === 0 && (
                <div className="text-center py-12 border rounded-lg bg-card">
                    <BarChart className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
                    <h3 className="font-medium text-lg">No analytics yet</h3>
                    <p className="text-muted-foreground">Start a campaign to see analytics here.</p>
                </div>
            )}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {activeCampaigns.map(camp => (
                    <AnalyticsCard key={camp.id} campaign={camp} />
                ))}
            </div>
        </div>
    );
}

function AnalyticsCard({ campaign }: { campaign: any }) {
    const { useCampaignAnalytics } = useEmailCampaigns();
    const { data: stats } = useCampaignAnalytics(campaign.id);

    if (!stats) return <Card><CardContent className="p-6"><Loader2 className="animate-spin h-4 w-4" /></CardContent></Card>;

    return (
        <Card className="hover:border-primary/30 transition-colors">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base truncate" title={campaign.name}>{campaign.name}</CardTitle>
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className={campaign.status === 'active' ? 'bg-green-500' : ''}>
                        {campaign.status}
                    </Badge>
                </div>
                <CardDescription className="flex items-center gap-1"><Send className="h-3 w-3" />{stats.sent} emails sent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 pt-2">
                    <div className="space-y-1 text-center">
                        <div className="text-2xl font-bold text-blue-500">{stats.openRate}%</div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Open Rate</span>
                        <Progress value={stats.openRate} className="h-1" />
                    </div>
                    <div className="space-y-1 text-center">
                        <div className="text-2xl font-bold text-green-500">{stats.replyRate}%</div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Reply Rate</span>
                        <Progress value={stats.replyRate} className="h-1" />
                    </div>
                    <div className="space-y-1 text-center">
                        <div className="text-2xl font-bold text-purple-500">{stats.clickRate}%</div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Click Rate</span>
                        <Progress value={stats.clickRate} className="h-1" />
                    </div>
                </div>
                
                <div className="grid grid-cols-4 gap-2 pt-4 border-t text-center text-xs">
                    <div><div className="font-semibold">{stats.total}</div><div className="text-muted-foreground">Total</div></div>
                    <div><div className="font-semibold text-primary">{stats.sent}</div><div className="text-muted-foreground">Sent</div></div>
                    <div><div className="font-semibold text-blue-500">{stats.opened}</div><div className="text-muted-foreground">Opens</div></div>
                    <div><div className="font-semibold text-red-500">{stats.bounced + stats.failed}</div><div className="text-muted-foreground">Failed</div></div>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Inbox Tab ─────────────────────────────────────────────────────────────
function InboxTab() {
    const { threads, isLoadingThreads, useMessages, syncEmails, markAsRead } = useEmailInbox();
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const { data: messages, isLoading: isLoadingMessages } = useMessages(selectedThreadId);
    const [replyText, setReplyText] = useState('');
    const { company } = useCompany();
    const { accounts } = useEmailAccounts();
    const queryClient = useQueryClient();
    
    const sendReply = useMutation({
        mutationFn: async () => {
            const thread = threads.find(t => t.id === selectedThreadId);
            if (!thread || !replyText.trim()) return;

            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

            // Get the last inbound message to get message_id for threading
            const lastInbound = [...(messages || [])].reverse().find(m => m.direction === 'inbound');

            const res = await fetch(`https://${projectId}.supabase.co/functions/v1/fastsend-send`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountId: thread.email_account_id,
                    to: lastInbound?.from_address || thread.subject.match(/<(.+?)>/)?.[1] || '',
                    subject: thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`,
                    bodyHtml: `<p>${replyText.replace(/\n/g, '<br/>')}</p>`,
                    companyId: company?.id,
                    threadId: thread.id,
                    inReplyTo: lastInbound?.message_id || null,
                    references: lastInbound?.message_id || null
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to send reply');
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Reply sent!');
            setReplyText('');
            queryClient.invalidateQueries({ queryKey: ['email-messages', selectedThreadId] });
            queryClient.invalidateQueries({ queryKey: ['email-threads'] });
        },
        onError: (err: any) => {
            toast.error(err.message);
        }
    });

    // Auto-mark as read when thread is selected
    React.useEffect(() => {
        if (selectedThreadId) {
            const thread = threads.find(t => t.id === selectedThreadId);
            if (thread && !thread.is_read) {
                markAsRead.mutate(selectedThreadId);
            }
        }
    }, [selectedThreadId, threads, markAsRead]);

    if (isLoadingThreads) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="grid lg:grid-cols-[350px_1fr] gap-0 border rounded-xl bg-card overflow-hidden h-[calc(100vh-280px)] min-h-[500px]">
            {/* Sidebar: Thread List */}
            <div className="border-r flex flex-col bg-muted/10">
                <div className="p-4 border-b flex justify-between items-center bg-card">
                    <h3 className="font-semibold flex items-center gap-2"><Inbox className="h-4 w-4" /> Inbox</h3>
                    <Button variant="ghost" size="icon" onClick={() => syncEmails.mutate()} disabled={syncEmails.isPending}>
                        <RefreshCcw className={`h-4 w-4 ${syncEmails.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                    {threads.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            No messages found. Click refresh to sync.
                        </div>
                    ) : (
                        threads.map(thread => (
                            <div 
                                key={thread.id} 
                                onClick={() => { setSelectedThreadId(thread.id); setReplyText(''); }}
                                className={`p-4 border-b cursor-pointer transition-colors hover:bg-muted/50 ${selectedThreadId === thread.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''} ${!thread.is_read ? 'bg-blue-50/30' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-sm truncate pr-2 ${!thread.is_read ? 'font-bold' : 'font-medium'}`}>
                                        {thread.subject}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                                        {format(new Date(thread.last_message_at), 'MMM d')}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                    {thread.snippet || 'No preview available'}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main: Message View */}
            <div className="flex flex-col bg-card overflow-hidden">
                {selectedThreadId ? (
                    <>
                        <div className="p-4 border-b flex justify-between items-center bg-muted/5">
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSelectedThreadId(null)}>
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <div>
                                    <h4 className="font-bold text-base leading-none">
                                        {threads.find(t => t.id === selectedThreadId)?.subject}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Thread ID: {selectedThreadId}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Users className="h-3.5 w-3.5" /> View Lead
                                </Button>
                                <Button size="sm" className="gap-2">
                                    <Reply className="h-3.5 w-3.5" /> Reply
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/5">
                            {isLoadingMessages ? (
                                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
                            ) : (
                                messages?.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm border ${msg.direction === 'outbound' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'}`}>
                                            <div className="flex justify-between items-center mb-2 gap-4">
                                                <span className="text-xs font-bold opacity-80">
                                                    {msg.direction === 'outbound' ? 'You' : msg.from_address}
                                                </span>
                                                <span className="text-[10px] opacity-60">
                                                    {format(new Date(msg.received_at), 'MMM d, h:mm a')}
                                                </span>
                                            </div>
                                            <div 
                                                className={`text-sm leading-relaxed prose prose-sm max-w-none ${msg.direction === 'outbound' ? 'text-white prose-invert' : 'text-foreground'}`}
                                                dangerouslySetInnerHTML={{ __html: msg.body_html || `<p>${msg.body_text}</p>` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t bg-muted/5">
                            <div className="relative group">
                                <Textarea 
                                    placeholder="Type your reply here..." 
                                    className="min-h-[100px] pr-12 focus-visible:ring-primary shadow-inner"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    disabled={sendReply.isPending}
                                />
                                <Button 
                                    size="icon" 
                                    className="absolute bottom-3 right-3 h-8 w-8 shadow-md"
                                    onClick={() => sendReply.mutate()}
                                    disabled={!replyText.trim() || sendReply.isPending}
                                >
                                    {sendReply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Reply className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12">
                        <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                            <Mail className="h-10 w-10 opacity-20" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">Select a thread</h3>
                        <p className="max-w-[300px] text-center text-sm">
                            Choose a conversation from the left to view the full message history and reply.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Page Component ───────────────────────────────────────────────────
export default function FastSend() {
    const [viewMode, setViewMode] = useState<'list' | 'builder' | 'detail'>('list');
    const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);

    if (viewMode === 'builder') {
        return <div className="p-4 md:p-8 pt-6"><BuilderTab onCancel={() => setViewMode('list')} /></div>;
    }

    if (viewMode === 'detail' && selectedCampaign) {
        return <CampaignDetailView campaign={selectedCampaign} onBack={() => { setViewMode('list'); setSelectedCampaign(null); }} />;
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2 mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">FastSend AI</h2>
                        <Badge variant="outline" className="border-purple-400/50 text-purple-400 gap-1.5 text-xs">
                            <Bot className="h-3 w-3" /> Agentic Platform
                        </Badge>
                    </div>
                    <p className="text-muted-foreground">Autonomous AI email campaigns that negotiate, engage, and close leads</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setViewMode('builder')} className="shadow-md bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
                        <Zap className="mr-2 h-4 w-4" /> New Campaign
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="campaigns" className="space-y-4">
                <div className="border-b">
                    <TabsList className="bg-transparent h-12">
                        <TabsTrigger value="campaigns" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none shadow-none gap-2">
                            <AlignLeft className="h-4 w-4" /> Campaigns
                        </TabsTrigger>
                        <TabsTrigger value="inbox" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none shadow-none gap-2">
                            <Inbox className="h-4 w-4" /> Inbox
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
                    <CampaignsTab onEdit={() => setViewMode('builder')} onOpenDetail={(camp) => { setSelectedCampaign(camp); setViewMode('detail'); }} />
                </TabsContent>

                <TabsContent value="inbox" className="m-0 pt-4">
                    <InboxTab />
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
