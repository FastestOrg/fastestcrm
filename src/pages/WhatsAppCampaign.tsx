import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MessageCircle, Users, Activity, Settings, Plus, QrCode, Play, Pause, Trash2, StopCircle, Loader2, Bot, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWhatsAppAccounts } from '@/hooks/useWhatsAppAccounts';
import { useWhatsAppCampaigns } from '@/hooks/useWhatsAppCampaigns';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { format } from 'date-fns';

// ─── Accounts Tab ────────────────────────────────────────────────────────────
function AccountsTab() {
    const { accounts, isLoading, createSession, disconnectSession, deleteAccount, pollQR, updateAccountAI } = useWhatsAppAccounts();
    const [isConnecting, setIsConnecting] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [newSessionName, setNewSessionName] = useState('');
    const [qrStatus, setQrStatus] = useState<'idle' | 'loading' | 'waiting_scan' | 'connected'>('idle');
    const [aiConfigAccount, setAiConfigAccount] = useState<any>(null);
    const pollInterval = React.useRef<any>(null);
    
    React.useEffect(() => {
        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, []);

    const handleConnect = async () => {
        if (!newSessionName.trim()) return;
        const sessionId = `${newSessionName.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;
        setQrStatus('loading');
        
        try {
            const res = await createSession.mutateAsync({ sessionId });
            if (res.status === 'connected') {
                setQrStatus('connected');
                setTimeout(() => setIsConnecting(false), 2000);
            } else if (res.qr) {
                setQrCode(res.qr);
                setQrStatus('waiting_scan');
                
                // Poll for scan
                if (pollInterval.current) clearInterval(pollInterval.current);
                pollInterval.current = setInterval(async () => {
                    const statusRes = await pollQR(sessionId);
                    if (statusRes.status === 'connected') {
                        if (pollInterval.current) clearInterval(pollInterval.current);
                        setQrStatus('connected');
                        setTimeout(() => {
                            setIsConnecting(false);
                            setQrCode(null);
                            setNewSessionName('');
                            setQrStatus('idle');
                        }, 2000);
                    } else if (statusRes.qr && statusRes.qr !== qrCode) {
                        setQrCode(statusRes.qr);
                    }
                }, 3000);
            }
        } catch (e) {
            setQrStatus('idle');
        }
    };

    if (isLoading) return <div>Loading accounts...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Connected Accounts</h3>
                    <p className="text-sm text-muted-foreground">Manage your WhatsApp sender numbers</p>
                </div>
                <Button onClick={() => setIsConnecting(true)}>
                    <QrCode className="mr-2 h-4 w-4" /> Link New Account
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accounts.map(acc => (
                    <Card key={acc.id}>
                        <CardHeader className="pb-2 text-sm">
                            <CardTitle className="flex justify-between items-center text-base">
                                {acc.display_name || acc.phone_number || 'Unnamed'}
                                <Badge variant={acc.status === 'connected' ? 'default' : 'secondary'}>
                                    {acc.status}
                                </Badge>
                            </CardTitle>
                            <CardDescription>{acc.phone_number || 'No phone number'}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Sent Today</span>
                                <span className="font-medium">
                                    {acc.messages_sent_today} / {acc.daily_limit}
                                </span>
                            </div>
                            <div className="mt-4 flex flex-col gap-2">
                                {acc.status === 'connected' ? (
                                    <>
                                        <Button variant="secondary" size="sm" className="w-full" onClick={() => setAiConfigAccount(acc)}>
                                            <Bot className="w-4 h-4 mr-2" /> AI Agent Config
                                        </Button>
                                        <Button variant="outline" size="sm" className="w-full text-muted-foreground" onClick={() => disconnectSession.mutate(acc.session_id)}>
                                            Disconnect
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive" onClick={() => deleteAccount.mutate(acc.id)}>
                                        Remove Account
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isConnecting} onOpenChange={(open) => {
                setIsConnecting(open);
                if (!open) { 
                    if (pollInterval.current) clearInterval(pollInterval.current);
                    setQrCode(null); 
                    setQrStatus('idle'); 
                    setNewSessionName(''); 
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Link WhatsApp Account</DialogTitle>
                        <DialogDescription>
                            Scan the QR code with your WhatsApp app to link this account.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {qrStatus === 'idle' && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Account Label</Label>
                                <Input 
                                    placeholder="e.g. Sales Phone 1" 
                                    value={newSessionName}
                                    onChange={e => setNewSessionName(e.target.value)}
                                />
                            </div>
                            <Button onClick={handleConnect} disabled={!newSessionName.trim()} className="w-full">
                                Generate QR Code
                            </Button>
                        </div>
                    )}

                    {qrStatus === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Generating QR Code...</p>
                        </div>
                    )}

                    {qrStatus === 'waiting_scan' && qrCode && (
                        <div className="flex flex-col items-center justify-center py-4 space-y-4">
                            <div className="bg-white p-4 rounded-xl border">
                                <img src={qrCode} alt="WhatsApp QR Code" className="h-48 w-48" />
                            </div>
                            <p className="text-sm text-center text-muted-foreground">
                                Open WhatsApp on your phone<br/>
                                Go to Settings &gt; Linked Devices &gt; Link a Device<br/>
                                Point your camera at this screen
                            </p>
                        </div>
                    )}

                    {qrStatus === 'connected' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                                <Activity className="h-6 w-6 text-green-600" />
                            </div>
                            <p className="font-medium">Account Linked Successfully!</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* AI Config Dialog */}
            <Dialog open={!!aiConfigAccount} onOpenChange={(open) => !open && setAiConfigAccount(null)}>
                {aiConfigAccount && (
                    <AIConfigDialogContent 
                        account={aiConfigAccount} 
                        onClose={() => setAiConfigAccount(null)} 
                        updateAccountAI={updateAccountAI} 
                    />
                )}
            </Dialog>
        </div>
    );
}

// ─── AI Config Dialog Internal Component ─────────────────────────────────────
function AIConfigDialogContent({ account, onClose, updateAccountAI }: { account: any, onClose: () => void, updateAccountAI: any }) {
    const [aiEnabled, setAiEnabled] = useState(account.ai_enabled || false);
    const [aiGoal, setAiGoal] = useState(account.ai_goal || 'sales');
    const [aiKnowledgeBase, setAiKnowledgeBase] = useState(account.ai_knowledge_base || '');
    const [aiPrompt, setAiPrompt] = useState(account.ai_prompt || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isImprovising, setIsImprovising] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateAccountAI.mutateAsync({
                accountId: account.id,
                ai_enabled: aiEnabled,
                ai_goal: aiGoal,
                ai_prompt: aiPrompt,
                ai_knowledge_base: aiKnowledgeBase,
            });
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    const handleImprovise = async () => {
        setIsImprovising(true);
        try {
            // Calling server endpoint to hit Gemini and improvise the prompt
            const res = await fetch(`${import.meta.env.VITE_WHATSAPP_SERVER_URL || 'http://localhost:3001'}/api/ai/improvise-prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_WHATSAPP_API_KEY || '' },
                body: JSON.stringify({ companyId: account.company_id, currentPrompt: aiPrompt, goal: aiGoal })
            });
            
            if (!res.ok) throw new Error('Failed to improvise prompt. Ensure your Gemini Integration is active.');
            
            const data = await res.json();
            if (data.improvedPrompt) {
                setAiPrompt(data.improvedPrompt);
            }
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsImprovising(false);
        }
    };

    return (
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    Configure AI Agent
                </DialogTitle>
                <DialogDescription>
                    Set up an auto-responder for {account.display_name || account.phone_number}. 
                    The AI will magically read new chats and CRM Lead details to answer intelligently.
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto px-2">
                <div className="flex items-center justify-between border p-4 rounded-lg bg-muted/30">
                    <div className="space-y-0.5">
                        <Label className="text-base">Enable AI Responder</Label>
                        <p className="text-sm text-muted-foreground">Turn this on to let AI automatically reply to incoming messages.</p>
                    </div>
                    <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                </div>

                <div className="space-y-2">
                    <Label>End Goal</Label>
                    <Select value={aiGoal} onValueChange={setAiGoal}>
                        <SelectTrigger><SelectValue placeholder="Select business goal" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="sales">Sales & Qualification</SelectItem>
                            <SelectItem value="meeting_booking">Meeting Booking</SelectItem>
                            <SelectItem value="support">Customer Support</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Knowledge Base</Label>
                    <p className="text-xs text-muted-foreground">Paste your FAQs, product details, operating hours, prices, etc.</p>
                    <Textarea 
                        className="min-h-[120px]" 
                        placeholder="We are open 9am to 6pm. Our premium package costs $99/mo..."
                        value={aiKnowledgeBase}
                        onChange={e => setAiKnowledgeBase(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label>Core Instructions / Prompt</Label>
                        <Button variant="ghost" size="sm" className="h-8 text-primary group" onClick={handleImprovise} disabled={isImprovising || !aiPrompt.trim()}>
                            {isImprovising ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1 group-hover:text-primary transition-colors" />}
                            Improvise Prompt
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Tell the AI how to act, what tone to use, and how to respond.</p>
                    <Textarea 
                        className="min-h-[160px] font-mono whitespace-pre-wrap text-sm" 
                        placeholder="You are a helpful sales assistant for FastestCRM..."
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                    />
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Configuration
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}


// ─── Campaigns Tab ───────────────────────────────────────────────────────────
function CampaignsTab() {
    const { campaigns, isLoading, startCampaign, pauseCampaign, resumeCampaign, deleteCampaign, fetchLeads, leadColumns, createCampaign } = useWhatsAppCampaigns();
    const { accounts } = useWhatsAppAccounts();
    const { statuses } = useLeadStatuses();
    const [isCreating, setIsCreating] = useState(false);
    
    // Campaign Builder State
    const [name, setName] = useState('');
    const [messageTemplate, setMessageTemplate] = useState('');
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
    const [leadStatus, setLeadStatus] = useState('all');
    const [phoneField, setPhoneField] = useState('phone');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCreateCampaign = async () => {
        setIsSubmitting(true);
        try {
            const leads = await fetchLeads(leadStatus);
            if (leads.length === 0) {
                alert('No leads found for the selected status.');
                setIsSubmitting(false);
                return;
            }
            
            await createCampaign.mutateAsync({
                name,
                messageTemplate,
                accountIds: selectedAccounts,
                leads,
                phoneField
            });
            
            setIsCreating(false);
            // Reset
            setName('');
            setMessageTemplate('');
            setSelectedAccounts([]);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleAccount = (id: string) => {
        setSelectedAccounts(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    if (isLoading) return <div>Loading campaigns...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Your Campaigns</h3>
                    <p className="text-sm text-muted-foreground">Manage and track bulk message campaigns</p>
                </div>
                <Button onClick={() => setIsCreating(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Campaign
                </Button>
            </div>

            <div className="space-y-4">
                {campaigns.map(camp => (
                    <Card key={camp.id}>
                        <CardContent className="flex items-center justify-between p-6">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold">{camp.name}</h4>
                                    <Badge variant={camp.status === 'running' ? 'default' : 'secondary'}>
                                        {camp.status}
                                    </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {camp.recipient_count} recipients • Created {format(new Date(camp.created_at), 'PPP')}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                {camp.status === 'draft' && (
                                    <Button variant="outline" size="sm" onClick={() => startCampaign.mutate(camp.id)}>
                                        <Play className="mr-2 h-4 w-4" /> Start
                                    </Button>
                                )}
                                {camp.status === 'running' && (
                                    <Button variant="outline" size="sm" onClick={() => pauseCampaign.mutate(camp.id)}>
                                        <Pause className="mr-2 h-4 w-4" /> Pause
                                    </Button>
                                )}
                                {camp.status === 'paused' && (
                                    <Button variant="outline" size="sm" onClick={() => resumeCampaign.mutate(camp.id)}>
                                        <Play className="mr-2 h-4 w-4" /> Resume
                                    </Button>
                                )}
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteCampaign.mutate(camp.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isCreating} onOpenChange={setIsCreating}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create WhatsApp Campaign</DialogTitle>
                        <DialogDescription>
                            Configure your campaign, select sender accounts, and write your message.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto px-2">
                        <div className="space-y-2">
                            <Label>Campaign Name</Label>
                            <Input placeholder="e.g. March Promo" value={name} onChange={e => setName(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label>Sender Accounts</Label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {accounts.filter(a => a.status === 'connected').map(acc => (
                                    <div key={acc.id} className="flex items-center space-x-2 border p-2 rounded-md">
                                        <Checkbox 
                                            id={`acc-${acc.id}`} 
                                            checked={selectedAccounts.includes(acc.id)}
                                            onCheckedChange={() => toggleAccount(acc.id)}
                                        />
                                        <label htmlFor={`acc-${acc.id}`} className="text-sm cursor-pointer flex-1">
                                            {acc.display_name || acc.phone_number}
                                        </label>
                                    </div>
                                ))}
                                {accounts.filter(a => a.status === 'connected').length === 0 && (
                                    <div className="text-sm text-muted-foreground col-span-2">No connected accounts. Please link an account first.</div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Recipient CRM Leads</Label>
                                <Select value={leadStatus} onValueChange={setLeadStatus}>
                                    <SelectTrigger><SelectValue placeholder="Select segment" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Leads</SelectItem>
                                        {statuses.map(s => (
                                            <SelectItem key={s.value} value={s.value}>
                                                {s.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Phone Number Field</Label>
                                <Select value={phoneField} onValueChange={setPhoneField}>
                                    <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                                    <SelectContent>
                                        {leadColumns.map(col => (
                                            <SelectItem key={col} value={col}>{col}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Label>Message Template</Label>
                                <span className="text-xs text-muted-foreground">Supports Spintax: {'{Hi|Hello}'}</span>
                            </div>
                            <Textarea 
                                className="min-h-[150px] font-mono whitespace-pre-wrap"
                                placeholder="Hi %name%, we have an offer for you..."
                                value={messageTemplate}
                                onChange={e => setMessageTemplate(e.target.value)}
                            />
                            {leadColumns.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <span className="text-xs text-muted-foreground self-center">Insert:</span>
                                    {leadColumns.slice(0, 10).map(col => (
                                        <Badge 
                                            key={col} 
                                            variant="secondary" 
                                            className="cursor-pointer hover:bg-secondary/80"
                                            onClick={() => setMessageTemplate(prev => prev + `%${col}%`)}
                                        >
                                            %{col}%
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                        <Button 
                            onClick={handleCreateCampaign} 
                            disabled={isSubmitting || !name || !messageTemplate || selectedAccounts.length === 0}
                        >
                            {isSubmitting ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                            Create Campaign
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Logs Tab ────────────────────────────────────────────────────────────────
function LogsTab() {
    const { useMessageLogs } = useWhatsAppCampaigns();
    const { data: logs, isLoading } = useMessageLogs();

    if (isLoading) return <div>Loading logs...</div>;

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Message Logs</h3>
                <p className="text-sm text-muted-foreground">Recent messages sent by your accounts</p>
            </div>

            <Card>
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Recipient</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Message</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {logs?.map((log) => (
                                <tr key={log.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <td className="p-4 align-middle">{format(new Date(log.sent_at), 'PP p')}</td>
                                    <td className="p-4 align-middle">{log.recipient_phone}</td>
                                    <td className="p-4 align-middle">
                                        <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                                            {log.status}
                                        </Badge>
                                    </td>
                                    <td className="p-4 align-middle max-w-[300px] truncate" title={log.message_body}>
                                        {log.message_body}
                                    </td>
                                </tr>
                            ))}
                            {logs?.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-4 text-center text-muted-foreground">
                                        No messages found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function WhatsAppCampaign() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">WhatsApp Campaign</h2>
                <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Activity className="mr-1 h-3 w-3" />
                        Beta
                    </Badge>
                </div>
            </div>

            <Tabs defaultValue="accounts" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="accounts" className="gap-2">
                        <Users className="h-4 w-4" />
                        Accounts
                    </TabsTrigger>
                    <TabsTrigger value="campaigns" className="gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Campaigns
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="gap-2">
                        <Settings className="h-4 w-4" />
                        Logs
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="accounts" className="space-y-4">
                    <AccountsTab />
                </TabsContent>

                <TabsContent value="campaigns" className="space-y-4">
                    <CampaignsTab />
                </TabsContent>

                <TabsContent value="logs" className="space-y-4">
                    <LogsTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
