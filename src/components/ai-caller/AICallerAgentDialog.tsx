import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Bot, Mic, Globe, Phone, Clock, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAICallerAgents, AICallerAgent, CreateAgentParams } from '@/hooks/useAICallerAgents';

const GEMINI_VOICES = [
    { id: 'Aoede', label: 'Aoede', desc: 'Warm & natural' },
    { id: 'Charon', label: 'Charon', desc: 'Deep & authoritative' },
    { id: 'Fenrir', label: 'Fenrir', desc: 'Clear & professional' },
    { id: 'Kore', label: 'Kore', desc: 'Bright & energetic' },
    { id: 'Puck', label: 'Puck', desc: 'Friendly & casual' },
    { id: 'Leda', label: 'Leda', desc: 'Calm & reassuring' },
];

const LANGUAGES = [
    { code: 'en-US', label: 'English (US)' },
    { code: 'en-IN', label: 'English (India)' },
    { code: 'hi-IN', label: 'Hindi' },
    { code: 'ta-IN', label: 'Tamil' },
    { code: 'te-IN', label: 'Telugu' },
    { code: 'mr-IN', label: 'Marathi' },
    { code: 'bn-IN', label: 'Bengali' },
    { code: 'gu-IN', label: 'Gujarati' },
    { code: 'kn-IN', label: 'Kannada' },
    { code: 'ml-IN', label: 'Malayalam' },
    { code: 'ar-XA', label: 'Arabic' },
    { code: 'es-ES', label: 'Spanish' },
    { code: 'fr-FR', label: 'French' },
    { code: 'de-DE', label: 'German' },
    { code: 'pt-BR', label: 'Portuguese (Brazil)' },
];

interface AICallerAgentDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    editAgent?: AICallerAgent | null;
    vobizPhoneNumber?: string;
    tataSmartfloPhoneNumber?: string;
    vobizConnected?: boolean;
    smartfloConnected?: boolean;
}

const DEFAULT_PROMPT = `You are a friendly and professional sales representative. Your goal is to:
1. Greet the prospect warmly and introduce yourself
2. Ask open-ended questions to understand their needs
3. Share relevant benefits of our product/service
4. Address objections confidently
5. Try to schedule a follow-up meeting or demo

Keep responses concise and conversational. Always be respectful of their time.`;

export function AICallerAgentDialog({ isOpen, onOpenChange, editAgent, vobizPhoneNumber, tataSmartfloPhoneNumber, vobizConnected, smartfloConnected }: AICallerAgentDialogProps) {
    const { createAgent, updateAgent, isCreating, isUpdating } = useAICallerAgents();
    const { toast } = useToast();

    const [form, setForm] = useState<CreateAgentParams>({
        name: '',
        system_prompt: DEFAULT_PROMPT,
        voice: 'Aoede',
        language: 'en-IN',
        phone_number: vobizPhoneNumber ?? tataSmartfloPhoneNumber ?? '',
        max_duration_minutes: 10,
        is_active: true,
        telephony_provider: vobizConnected ? 'vobiz' : smartfloConnected ? 'tata_smartflo' : 'vobiz',
    });

    useEffect(() => {
        if (editAgent) {
            setForm({
                name: editAgent.name,
                system_prompt: editAgent.system_prompt,
                voice: editAgent.voice,
                language: editAgent.language,
                phone_number: editAgent.phone_number,
                max_duration_minutes: editAgent.max_duration_minutes,
                is_active: editAgent.is_active,
                telephony_provider: editAgent.telephony_provider ?? 'vobiz',
            });
        } else {
            const defaultProvider = vobizConnected ? 'vobiz' : smartfloConnected ? 'tata_smartflo' : 'vobiz';
            const defaultPhone = defaultProvider === 'vobiz' ? (vobizPhoneNumber ?? '') : (tataSmartfloPhoneNumber ?? '');
            setForm({
                name: '',
                system_prompt: DEFAULT_PROMPT,
                voice: 'Aoede',
                language: 'en-IN',
                phone_number: defaultPhone,
                max_duration_minutes: 10,
                is_active: true,
                telephony_provider: defaultProvider,
            });
        }
    }, [editAgent, vobizPhoneNumber, tataSmartfloPhoneNumber, vobizConnected, smartfloConnected, isOpen]);

    const handleSubmit = async () => {
        if (!form.name.trim()) {
            toast({ title: 'Name required', description: 'Please give your agent a name.', variant: 'destructive' });
            return;
        }
        if (!form.system_prompt.trim()) {
            toast({ title: 'Prompt required', description: 'Add a system prompt for your AI agent.', variant: 'destructive' });
            return;
        }
        try {
            if (editAgent) {
                await updateAgent({ id: editAgent.id, params: form });
                toast({ title: '✓ Agent Updated', description: `"${form.name}" has been updated.` });
            } else {
                await createAgent(form);
                toast({ title: '🤖 Agent Created!', description: `"${form.name}" is ready to make calls.` });
            }
            onOpenChange(false);
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    const isSaving = isCreating || isUpdating;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary" />
                        </div>
                        {editAgent ? 'Edit AI Caller Agent' : 'Create AI Caller Agent'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="agent-name" className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            Agent Name
                        </Label>
                        <Input
                            id="agent-name"
                            placeholder='e.g. "Sales Agent – Mumbai", "Follow-up Bot"'
                            value={form.name}
                            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                        />
                    </div>

                    {/* System Prompt */}
                    <div className="space-y-2">
                        <Label htmlFor="agent-prompt" className="flex items-center gap-1.5">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                            System Prompt (Agent Instructions)
                        </Label>
                        <Textarea
                            id="agent-prompt"
                            rows={8}
                            placeholder="Describe your agent's persona, goals, and how to handle common situations..."
                            value={form.system_prompt}
                            onChange={(e) => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                            className="font-mono text-sm resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                            This prompt shapes your AI agent's personality and behavior during calls. Be specific about tone, goals, and handling objections.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Voice */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5">
                                <Mic className="h-3.5 w-3.5 text-primary" />
                                Voice
                            </Label>
                            <Select value={form.voice} onValueChange={(v) => setForm(f => ({ ...f, voice: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {GEMINI_VOICES.map(v => (
                                        <SelectItem key={v.id} value={v.id}>
                                            <div className="flex flex-col">
                                                <span>{v.label}</span>
                                                <span className="text-xs text-muted-foreground">{v.desc}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Language */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5 text-primary" />
                                Language
                            </Label>
                            <Select value={form.language} onValueChange={(v) => setForm(f => ({ ...f, language: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LANGUAGES.map(l => (
                                        <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Telephony Provider */}
                    <div className="space-y-3">
                        <Label className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-primary" />
                            Telephony Provider
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Vobiz option */}
                            <button
                                type="button"
                                onClick={() => {
                                    setForm(f => ({
                                        ...f,
                                        telephony_provider: 'vobiz',
                                        phone_number: vobizPhoneNumber ?? f.phone_number,
                                    }));
                                }}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                    form.telephony_provider === 'vobiz'
                                        ? 'border-orange-500 bg-orange-500/5'
                                        : 'border-border hover:border-border/80'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-sm">Vobiz AI Telephony</span>
                                    {vobizConnected && (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">AI voice calling via Vobiz SIP</p>
                                {!vobizConnected && (
                                    <p className="text-xs text-orange-500 mt-1">Not connected</p>
                                )}
                            </button>

                            {/* Tata Smartflo option */}
                            <button
                                type="button"
                                onClick={() => {
                                    setForm(f => ({
                                        ...f,
                                        telephony_provider: 'tata_smartflo',
                                        phone_number: tataSmartfloPhoneNumber ?? f.phone_number,
                                    }));
                                }}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                    form.telephony_provider === 'tata_smartflo'
                                        ? 'border-blue-600 bg-blue-600/5'
                                        : 'border-border hover:border-border/80'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-sm">Tata Tele Smartflo</span>
                                    {smartfloConnected && (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">AI voice calling via Smartflo</p>
                                {!smartfloConnected && (
                                    <p className="text-xs text-blue-600 mt-1">Not connected</p>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-2">
                        <Label htmlFor="agent-phone" className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-primary" />
                            Caller ID ({form.telephony_provider === 'vobiz' ? 'Vobiz' : 'Smartflo'} Phone Number)
                        </Label>
                        <Input
                            id="agent-phone"
                            placeholder="+91 9876543210"
                            value={form.phone_number}
                            onChange={(e) => setForm(f => ({ ...f, phone_number: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            The DID number from your {form.telephony_provider === 'vobiz' ? 'Vobiz' : 'Tata Smartflo'} account that this agent will call from.
                        </p>
                    </div>

                    {/* Max Duration */}
                    <div className="space-y-3">
                        <Label className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            Max Call Duration: <strong className="ml-1">{form.max_duration_minutes} minutes</strong>
                        </Label>
                        <Slider
                            min={1}
                            max={30}
                            step={1}
                            value={[form.max_duration_minutes]}
                            onValueChange={([v]) => setForm(f => ({ ...f, max_duration_minutes: v }))}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>1 min</span>
                            <span>30 min</span>
                        </div>
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                        <div>
                            <p className="font-medium text-sm">Agent Status</p>
                            <p className="text-xs text-muted-foreground">Inactive agents cannot be triggered by automations</p>
                        </div>
                        <Switch
                            checked={form.is_active}
                            onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))}
                        />
                    </div>

                    {/* Info banner */}
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-2 text-sm">
                        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                            <p className="font-medium">Powered by FastAI STS Latest</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Ultra-low latency speech-to-speech AI with ~20ms round-trip via {form.telephony_provider === 'vobiz' ? 'Vobiz SIP' : 'Tata Smartflo'}.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSaving} className="gradient-primary min-w-[100px]">
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editAgent ? 'Save Changes' : 'Create Agent'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
