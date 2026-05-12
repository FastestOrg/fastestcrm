import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface AddIntegrationDialogProps {
    serviceName: string;
    displayName: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddIntegrationDialog({ serviceName, displayName, isOpen, onOpenChange }: AddIntegrationDialogProps) {
    const [apiKey, setApiKey] = useState('');
    const [keyId, setKeyId] = useState('');
    const [keySecret, setKeySecret] = useState('');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();
    const { company } = useCompany();
    const queryClient = useQueryClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalApiKey = apiKey;

        if (serviceName === 'razorpay') {
            if (!keyId.trim() || !keySecret.trim()) return;
            finalApiKey = JSON.stringify({ key_id: keyId, key_secret: keySecret });
        } else {
            if (!apiKey.trim()) return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('integration_api_keys')
                .insert({
                    user_id: user?.id,
                    company_id: company?.id,
                    service_name: serviceName,
                    api_key: finalApiKey,
                    is_active: true
                } as any);

            if (error) throw error;

            toast({
                title: 'Integration Connected',
                description: `Successfully connected to ${displayName}`,
            });

            queryClient.invalidateQueries({ queryKey: ['integration-keys'] });
            onOpenChange(false);
            setApiKey('');
            setKeyId('');
            setKeySecret('');
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Connect {displayName}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {serviceName === 'razorpay' ? (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="keyId">API Key ID</Label>
                                <Input
                                    id="keyId"
                                    value={keyId}
                                    onChange={(e) => setKeyId(e.target.value)}
                                    placeholder="Enter Razorpay Key ID"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="keySecret">API Key Secret</Label>
                                <Input
                                    id="keySecret"
                                    type="password"
                                    value={keySecret}
                                    onChange={(e) => setKeySecret(e.target.value)}
                                    placeholder="Enter Razorpay Key Secret"
                                    required
                                />
                            </div>
                        </>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="apiKey">API Key</Label>
                            <Input
                                id="apiKey"
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={`Enter your ${displayName} API Key`}
                                required
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Connect
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
