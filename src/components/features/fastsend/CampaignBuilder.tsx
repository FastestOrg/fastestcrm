import React, { useState } from 'react';
import { Plus, Loader2, Bot, Wand2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCompany } from '@/hooks/useCompany';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useEmailCampaigns } from '@/hooks/useEmailCampaigns';
import { generateFullDripCampaign } from '@/services/emailAIService';
import { EmailAccountAddDialog } from '@/components/integrations/EmailAccountAddDialog';

// Utils
function stripHtml(html: string) {
    if (typeof window === 'undefined') return html;
    let doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
}

export function CampaignBuilder({ onCancel, initialData, initialSequences }: { onCancel: () => void; initialData?: EmailCampaign; initialSequences?: any[] }) {
    const { company } = useCompany();
    const { accounts } = useEmailAccounts();
    const { statuses } = useLeadStatuses();
    const { leadColumns, fetchLeads, createCampaign, updateCampaign, useCampaignSequences } = useEmailCampaigns();

    // Fetch existing sequences if editing
    const { data: existingSequences, isLoading: isLoadingSequences } = useCampaignSequences(initialData?.id || null);

    // Setup state
    const [name, setName] = useState(initialData?.name || '');
    const [goal, setGoal] = useState(initialData?.campaign_goal || 'meeting_booking');
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>(initialData?.account_ids || []);
    
    // Audience state
    const [leadStatus, setLeadStatus] = useState('all');
    const [emailField, setEmailField] = useState('email');
    
    // AI Generation state
    const [perspective, setPerspective] = useState(initialData?.ai_perspective || '');
    const [productInfo, setProductInfo] = useState(initialData?.product_info || '');
    const [stepsCount, setStepsCount] = useState(initialData?.id ? existingSequences?.length || 4 : 4);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [autopilotEnabled, setAutopilotEnabled] = useState((initialData as any)?.ai_auto_reply_enabled || false);
    
    // Sequences state
    const [sequences, setSequences] = useState<any[]>(initialSequences || []);
    
    // Settings state
    const [delayMs, setDelayMs] = useState(initialData?.delay_between_emails_ms || 60000); // 1 min between emails
    const [isEmailAddOpen, setIsEmailAddOpen] = useState(false);

    // Initialize sequences and steps count when they load from DB
    React.useEffect(() => {
        if (existingSequences && existingSequences.length > 0 && sequences.length === 0) {
            setSequences(existingSequences);
            setStepsCount(existingSequences.length);
        }
    }, [existingSequences]);

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
            // Mark each step as AI generated
            const aiEmailsWithFlag = aiEmails.map(email => ({
                ...email,
                ai_generated: true
            }));
            setSequences(aiEmailsWithFlag);
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

        setIsSaving(true);
        toast.info(initialData ? 'Saving campaign changes...' : 'Preparing leads and creating campaign...');
        try {
            if (initialData) {
                // UPDATE logic
                await updateCampaign.mutateAsync({
                    id: initialData.id,
                    name,
                    campaignGoal: goal,
                    accountIds: selectedAccounts,
                    delayBetweenEmailsMs: delayMs,
                    aiPerspective: perspective,
                    productInfo,
                    aiAutoReplyEnabled: autopilotEnabled,
                    aiAutoReplyGoal: goal,
                    aiAutoReplyPerspective: perspective,
                    sequences,
                });
            } else {
                // CREATE logic
                const leads = await fetchLeads(leadStatus);
                if (leads.length === 0) {
                    toast.error('No leads found for chosen segment');
                    setIsSaving(false);
                    return;
                }

                await createCampaign.mutateAsync({
                    name,
                    campaignGoal: goal,
                    campaignMode: 'agentic',
                    accountIds: selectedAccounts,
                    delayBetweenEmailsMs: delayMs,
                    aiGenerated: sequences.some(s => s.ai_generated || false),
                    aiPerspective: perspective,
                    productInfo,
                    aiAutoReplyEnabled: autopilotEnabled,
                    aiAutoReplyGoal: goal,
                    aiAutoReplyPerspective: perspective,
                    sequences,
                    leadStatusFilter: leadStatus,
                    emailField,
                });
            }
            onCancel(); // Go back to list
        } catch (e) {
            // Handled in mutate
            setIsSaving(false);
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
                    <h2 className="text-2xl font-bold tracking-tight">{initialData ? 'Edit Campaign' : 'Email Campaign Builder'}</h2>
                    <p className="text-muted-foreground">{initialData ? 'Update your campaign settings and sequence' : 'Create manual campaigns or generate drip sequences with AI'}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                        if (sequences.length > 0) {
                            if (confirm('Discard unsaved changes?')) onCancel();
                        } else {
                            onCancel();
                        }
                    }}>Cancel</Button>
                    <Button onClick={handleSaveCampaign} disabled={isSaving || createCampaign.isPending || updateCampaign.isPending || !name || selectedAccounts.length === 0 || sequences.length === 0}>
                        {(isSaving || createCampaign.isPending || updateCampaign.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? 'Save Changes' : 'Create & Save Campaign'}
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
                                <Label>Select Senders (Rotation)</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {selectedAccounts.map(id => {
                                        const acc = accounts.find(a => a.id === id);
                                        return (
                                            <Badge key={id} variant="secondary" className="gap-1 pl-2 pr-1">
                                                {acc?.email_address}
                                                <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full" onClick={() => setSelectedAccounts(selectedAccounts.filter(a => a !== id))}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </Badge>
                                        );
                                    })}
                                </div>
                                <Select 
                                    value="none" 
                                    onValueChange={(val) => {
                                        if (val === 'add_new') {
                                            setIsEmailAddOpen(true);
                                        } else if (val !== 'none' && !selectedAccounts.includes(val)) {
                                            setSelectedAccounts([...selectedAccounts, val]);
                                        }
                                    }}
                                >
                                    <SelectTrigger><SelectValue placeholder="Add sender..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none" disabled>Choose email account</SelectItem>
                                        {accounts.filter(a => (a.status === 'connected' || a.status === 'error') && !selectedAccounts.includes(a.id)).map(acc => (
                                            <SelectItem key={acc.id} value={acc.id}>{acc.email_address}</SelectItem>
                                        ))}
                                        <SelectItem value="add_new" className="text-primary font-bold border-t border-border mt-1">
                                            <Plus className="h-3 w-3 mr-2" /> Add New Account...
                                        </SelectItem>
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
                                <div className="text-center py-8 border-2 border-dashed bg-muted/10 rounded-lg p-6">
                                    <Wand2 className="mx-auto h-8 w-8 text-primary mb-3" />
                                    <p className="font-medium">Use the AI panel to generate your sequence</p>
                                    <p className="text-sm text-muted-foreground mt-1 mb-4 text-balance">
                                        Describe your goals on the right, and Gemini will instantly write a full multi-step drip campaign.
                                    </p>
                                    <div className="flex justify-center gap-3">
                                        <Button variant="outline" onClick={() => {
                                            setSequences([{
                                                step_number: 1,
                                                subject: '',
                                                body_html: '',
                                                body_text: '',
                                                delay_after_ms: 0,
                                                send_condition: 'always',
                                                ai_generated: false
                                            }]);
                                        }}>
                                            <Plus className="mr-2 h-4 w-4" /> Start from Scratch (Manual)
                                        </Button>
                                    </div>
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
                                                {idx > 0 && (
                                                    <div className="grid grid-cols-2 gap-4 bg-muted/30 p-2.5 rounded-md border border-muted/50 mb-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-[11px] font-medium text-muted-foreground">Send Condition</Label>
                                                            <Select 
                                                                value={seq.send_condition} 
                                                                onValueChange={(val) => updateSequence(idx, 'send_condition', val)}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs bg-background">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="always" className="text-xs">Always Send</SelectItem>
                                                                    <SelectItem value="if_no_reply" className="text-xs">If No Reply</SelectItem>
                                                                    <SelectItem value="if_no_open" className="text-xs">If Not Opened</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[11px] font-medium text-muted-foreground">Delay (Hours)</Label>
                                                            <Input 
                                                                type="number" 
                                                                min="0"
                                                                className="h-8 text-xs bg-background" 
                                                                value={seq.delay_after_ms ? Math.round(seq.delay_after_ms / 3600000) : 0}
                                                                onChange={(e) => {
                                                                    const hours = Math.max(0, parseInt(e.target.value) || 0);
                                                                    updateSequence(idx, 'delay_after_ms', hours * 3600000);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
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
                                            send_condition: 'if_no_reply',
                                            ai_generated: false
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

            <EmailAccountAddDialog 
                isOpen={isEmailAddOpen} 
                onOpenChange={setIsEmailAddOpen}
                onSuccess={(id) => setSelectedAccounts([...selectedAccounts, id])}
            />
        </div>
    );
}
