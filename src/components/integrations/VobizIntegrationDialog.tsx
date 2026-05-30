import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Phone, CheckCircle2, ArrowRight, Zap, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VobizIntegrationDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

type Step = 1 | 2 | 3;

export function VobizIntegrationDialog({ isOpen, onOpenChange }: VobizIntegrationDialogProps) {
    const [step, setStep] = useState<Step>(1);
    const [authId, setAuthId] = useState('');
    const [authToken, setAuthToken] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [trunkId, setTrunkId] = useState('');
    const [testing, setTesting] = useState(false);
    const [testPassed, setTestPassed] = useState(false);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();
    const { company } = useCompany();
    const queryClient = useQueryClient();

    const handleTestConnection = async () => {
        if (!authId.trim() || !authToken.trim()) {
            toast({ title: 'Missing credentials', description: 'Please enter your Auth ID and Auth Token.', variant: 'destructive' });
            return;
        }
        setTesting(true);
        setTestPassed(false);

        // Client-side 15-second timeout so the spinner always resolves
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15_000);

        try {
            // Route through our edge function to avoid browser CORS restrictions on api.vobiz.ai
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vobiz-test-connection`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                    },
                    body: JSON.stringify({ auth_id: authId, auth_token: authToken }),
                    signal: controller.signal,
                },
            );
            clearTimeout(timeoutId);

            const result = await res.json();

            if (result.success) {
                setTestPassed(true);
                toast({ title: '✓ Connection Successful', description: 'Your Vobiz credentials are valid.' });
                setStep(2);
            } else if (result.timeout) {
                // Vobiz API was unreachable but credentials format looks valid — let user continue
                toast({
                    title: '⚠ Vobiz API Unreachable',
                    description: 'Could not verify online, but you can still proceed. Your credentials will be validated when the first call is made.',
                });
                setTestPassed(true);
                setStep(2);
            } else {
                throw new Error(result.error || 'Invalid credentials');
            }
        } catch (err: any) {
            clearTimeout(timeoutId);
            const isAbort = err.name === 'AbortError';
            toast({
                title: isAbort ? 'Request Timed Out' : 'Connection Failed',
                description: isAbort
                    ? 'The request took too long. Check your internet connection or try again.'
                    : (err.message || 'Could not connect to Vobiz.'),
                variant: 'destructive',
            });
        } finally {
            setTesting(false);
        }
    };


    const handleSave = async () => {
        if (!phoneNumber.trim()) {
            toast({ title: 'Phone number required', description: 'Enter a Vobiz DID phone number.', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            const config = JSON.stringify({
                auth_id: authId,
                auth_token: authToken,
                phone_number: phoneNumber,
                trunk_id: trunkId,
                sip_domain: trunkId ? `${trunkId}.sip.vobiz.ai` : null,
            });

            // Check if integration exists already
            const { data: existing } = await supabase
                .from('integration_api_keys')
                .select('id')
                .eq('user_id', user?.id)
                .eq('service_name', 'vobiz')
                .maybeSingle() as any;

            if (existing?.id) {
                await supabase
                    .from('integration_api_keys')
                    .update({ api_key: config, is_active: true } as any)
                    .eq('id', existing.id);
            } else {
                const { error } = await supabase
                    .from('integration_api_keys')
                    .insert({
                        user_id: user?.id,
                        company_id: company?.id,
                        service_name: 'vobiz',
                        api_key: config,
                        is_active: true,
                    } as any);
                if (error) throw error;
            }

            queryClient.invalidateQueries({ queryKey: ['integration-keys'] });
            toast({ title: '🎉 Vobiz Connected!', description: 'AI Caller is now ready. Configure your agents in FastEngage → AI Caller.' });
            setStep(3);
        } catch (err: any) {
            toast({ title: 'Error saving', description: err.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        if (step !== 3) {
            // Reset on close if not completed
        }
        setStep(1);
        setAuthId('');
        setAuthToken('');
        setPhoneNumber('');
        setTrunkId('');
        setTestPassed(false);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                            <Phone className="h-4 w-4 text-orange-500" />
                        </div>
                        Connect Vobiz AI Telephony
                    </DialogTitle>
                </DialogHeader>

                {/* Step indicator */}
                <div className="flex items-center gap-2 py-2">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                                step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
                            </div>
                            {s < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                        </div>
                    ))}
                    <span className="ml-2 text-xs text-muted-foreground">
                        {step === 1 && 'API Credentials'}
                        {step === 2 && 'Phone Number'}
                        {step === 3 && 'Done!'}
                    </span>
                </div>

                {/* Step 1: Credentials */}
                {step === 1 && (
                    <div className="space-y-5">
                        <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1 flex items-center gap-2">
                                <Shield className="h-4 w-4 text-orange-500" />
                                Where to find your Vobiz credentials
                            </p>
                            <p>Go to <strong>console.vobiz.ai</strong> → Account Settings → API Keys to copy your <em>Auth ID</em> and <em>Auth Token</em>.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="vobiz-auth-id">Auth ID (X-Auth-ID)</Label>
                            <Input
                                id="vobiz-auth-id"
                                placeholder="e.g. MXXXXXXXXXXXXXXXXXXXXXX"
                                value={authId}
                                onChange={(e) => setAuthId(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vobiz-auth-token">Auth Token (X-Auth-Token)</Label>
                            <Input
                                id="vobiz-auth-token"
                                type="password"
                                placeholder="Your secret auth token"
                                value={authToken}
                                onChange={(e) => setAuthToken(e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={handleClose}>Cancel</Button>
                            <Button
                                onClick={handleTestConnection}
                                disabled={testing || !authId || !authToken}
                                className="gradient-primary"
                            >
                                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                                {testing ? 'Testing...' : 'Test & Continue'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 2: Phone Number + Trunk */}
                {step === 2 && (
                    <div className="space-y-5">
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4" />
                            Credentials verified successfully!
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="vobiz-phone">Outbound DID Phone Number</Label>
                            <Input
                                id="vobiz-phone"
                                placeholder="+91 9876543210"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">The phone number your AI agent will call from. Find your DIDs in Vobiz Console → Phone Numbers.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="vobiz-trunk">
                                SIP Trunk ID <Badge variant="outline" className="ml-1 text-[10px]">Optional</Badge>
                            </Label>
                            <Input
                                id="vobiz-trunk"
                                placeholder="e.g. trunk_abc123"
                                value={trunkId}
                                onChange={(e) => setTrunkId(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Used to generate your SIP domain: <code className="bg-muted px-1 rounded">[trunk_id].sip.vobiz.ai</code>. Leave blank if not using SIP.</p>
                        </div>

                        <div className="flex justify-between gap-2">
                            <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                            <Button
                                onClick={handleSave}
                                disabled={saving || !phoneNumber}
                                className="gradient-primary"
                            >
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save & Connect
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Success */}
                {step === 3 && (
                    <div className="space-y-5 text-center py-4">
                        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Vobiz Connected!</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Your AI Caller is ready. Go to <strong>FastEngage → AI Caller</strong> to create your first AI agent.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-left p-4 rounded-lg bg-muted/30 border text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span>Phone number: <strong>{phoneNumber}</strong></span>
                            </div>
                            {trunkId && (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span>SIP Domain: <strong>{trunkId}.sip.vobiz.ai</strong></span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span>AI Model: <strong>Gemini 3.1 Flash Live</strong></span>
                            </div>
                        </div>
                        <Button className="gradient-primary w-full" onClick={handleClose}>
                            Done
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
