import React, { useState } from 'react';
import { Plus, Activity, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { EmailAccountAddDialog } from '@/components/integrations/EmailAccountAddDialog';

export function AccountsTab() {
    const { accounts, isLoading, deleteAccount, updateAccount, sendTestEmail } = useEmailAccounts();
    const [isConnecting, setIsConnecting] = useState(false);
    
    // Testing existing account state
    const [isTestingExisting, setIsTestingExisting] = useState(false);
    const [testingAccountId, setTestingAccountId] = useState<string | null>(null);
    const [testRecipient, setTestRecipient] = useState('');

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

            <EmailAccountAddDialog 
                isOpen={isConnecting} 
                onOpenChange={setIsConnecting} 
            />

        </div>
    );
}
