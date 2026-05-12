import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Loader2, Settings, Inbox, Play, Activity, AlertCircle } from 'lucide-react';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { toast } from 'sonner';

interface EmailAccountAddDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (accountId: string) => void;
}

export function EmailAccountAddDialog({ isOpen, onOpenChange, onSuccess }: EmailAccountAddDialogProps) {
  const { createAccount, testConnection, sendTestEmail } = useEmailAccounts();
  const [provider, setProvider] = useState('gmail');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  
  // Advanced SMTP state
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUser, setSmtpUser] = useState('');
  
  // IMAP State
  const [protocol, setProtocol] = useState<'smtp_only' | 'imap_smtp'>('smtp_only');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [imapUser, setImapUser] = useState('');
  const [imapPassword, setImapPassword] = useState('');
  
  const [testRecipient, setTestRecipient] = useState('');
  const [dailyLimit, setDailyLimit] = useState(50);
  const [warmupEnabled, setWarmupEnabled] = useState(true);

  // Auto-fill defaults
  useEffect(() => {
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
      const result = await createAccount.mutateAsync({
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
      
      toast.success('Email account connected!');
      if (onSuccess && result.id) onSuccess(result.id);
      onOpenChange(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message || 'Failed to connect');
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setSmtpUser('');
    setImapUser('');
    setImapPassword('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-white/10 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Connect Email Sender
          </DialogTitle>
          <DialogDescription>
            Add an email account to send AI-powered campaigns and outreach.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 px-1">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gmail">Gmail (OAuth)</SelectItem>
                <SelectItem value="outlook">Outlook / Office 365</SelectItem>
                <SelectItem value="zoho">Zoho Mail</SelectItem>
                <SelectItem value="custom">Custom SMTP / IMAP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Connection Mode</Label>
            <Select value={protocol} onValueChange={(val: any) => setProtocol(val)}>
              <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="smtp_only">Send Only (SMTP)</SelectItem>
                <SelectItem value="imap_smtp">Send & Receive (SMTP + IMAP)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground uppercase font-bold px-1">
              {protocol === 'imap_smtp' ? 'Enables two-way AI communication' : 'Optimized for outbound only'}
            </p>
          </div>

          {provider !== 'gmail' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input placeholder="you@company.com" type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-white/5 border-white/10" />
              </div>

              <div className="space-y-2">
                <Label>Display Name (From Name)</Label>
                <Input placeholder="e.g. Sarah from Sales" value={displayName} onChange={e => setDisplayName(e.target.value)} className="bg-white/5 border-white/10" />
              </div>

              <div className="space-y-2">
                <Label>Password / App Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="bg-white/5 border-white/10" />
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Use an App Password if 2FA is enabled on your account.
                </p>
              </div>

              <div className="border-t border-white/5 pt-4 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" /> SMTP Settings
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">SMTP Host</Label>
                    <Input placeholder="smtp.example.com" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} className="bg-white/5 border-white/10 h-8 text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Port</Label>
                    <Input type="number" value={smtpPort} onChange={e => setSmtpPort(Number(e.target.value))} className="bg-white/5 border-white/10 h-8 text-xs" />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="secure" checked={smtpSecure} onCheckedChange={setSmtpSecure} />
                  <Label htmlFor="secure" className="text-xs">Use SSL/TLS</Label>
                </div>
              </div>

              {protocol === 'imap_smtp' && (
                <div className="border-t border-white/5 pt-4 space-y-4 animate-in slide-in-from-top-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Inbox className="w-3.5 h-3.5" /> IMAP Settings
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">IMAP Host</Label>
                      <Input placeholder="imap.example.com" value={imapHost} onChange={e => setImapHost(e.target.value)} className="bg-white/5 border-white/10 h-8 text-xs" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Port</Label>
                      <Input type="number" value={imapPort} onChange={e => setImapPort(Number(e.target.value))} className="bg-white/5 border-white/10 h-8 text-xs" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5 mt-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Daily Send Limit</Label>
              <Input type="number" value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))} min={1} max={2000} className="bg-white/5 border-white/10" />
            </div>
            <div className="space-y-2 flex flex-col justify-end pb-1">
              <div className="flex items-center space-x-2">
                <Checkbox id="warmup" checked={warmupEnabled} onCheckedChange={(val) => setWarmupEnabled(!!val)} />
                <Label htmlFor="warmup" className="text-xs cursor-pointer">Enable Warm-up</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-white/5 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={createAccount.isPending}>
            Cancel
          </Button>
          <Button 
            className="gradient-primary"
            onClick={handleConnect} 
            disabled={createAccount.isPending || (provider !== 'gmail' && (!email || !password))}
          >
            {createAccount.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {provider === 'gmail' ? 'Connect via Google' : 'Connect Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
