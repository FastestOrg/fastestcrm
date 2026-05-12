import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, QrCode, Activity } from 'lucide-react';
import { useWhatsAppAccounts } from '@/hooks/useWhatsAppAccounts';
import { toast } from 'sonner';

interface WhatsAppAccountAddDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (accountId: string) => void;
}

export function WhatsAppAccountAddDialog({ isOpen, onOpenChange, onSuccess }: WhatsAppAccountAddDialogProps) {
  const { createSession, pollQR } = useWhatsAppAccounts();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [qrStatus, setQrStatus] = useState<'idle' | 'loading' | 'waiting_scan' | 'connected'>('idle');
  const pollInterval = useRef<any>(null);

  useEffect(() => {
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
        toast.success('WhatsApp account connected successfully!');
        if (onSuccess && res.accountId) onSuccess(res.accountId);
        setTimeout(() => onOpenChange(false), 2000);
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
            toast.success('WhatsApp account connected successfully!');
            // After connection, we might need a small delay to ensure the account is in the DB
            setTimeout(() => {
              onOpenChange(false);
              setQrCode(null);
              setNewSessionName('');
              setQrStatus('idle');
              // We need to find the account ID from the list since the poll result might not have it
              // But the parent will refetch via react-query
              if (onSuccess) onSuccess(sessionId); // sessionId can be a temporary identifier or we fetch the ID later
            }, 2000);
          } else if (statusRes.qr && statusRes.qr !== qrCode) {
            setQrCode(statusRes.qr);
          }
        }, 3000);
      }
    } catch (e: any) {
      setQrStatus('idle');
      toast.error(e.message || 'Failed to generate QR code');
    }
  };

  const handleClose = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      if (pollInterval.current) clearInterval(pollInterval.current);
      setQrCode(null);
      setQrStatus('idle');
      setNewSessionName('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="glass border-white/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Link WhatsApp Account
          </DialogTitle>
          <DialogDescription>
            Scan the QR code with your WhatsApp app to link this account to FastestAI.
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
                className="bg-white/5 border-white/10"
              />
            </div>
            <Button onClick={handleConnect} disabled={!newSessionName.trim() || createSession.isPending} className="w-full gradient-primary">
              {createSession.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generate QR Code
            </Button>
          </div>
        )}

        {qrStatus === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generating QR Code...</p>
          </div>
        )}

        {qrStatus === 'waiting_scan' && qrCode && (
          <div className="flex flex-col items-center justify-center py-6 space-y-6">
            <div className="bg-white p-4 rounded-2xl border-4 border-primary/20 shadow-2xl">
              <img src={qrCode} alt="WhatsApp QR Code" className="h-52 w-52" />
            </div>
            <div className="space-y-3 text-center">
              <p className="text-sm font-medium text-foreground">
                Point your WhatsApp camera at this screen
              </p>
              <div className="text-[11px] text-muted-foreground space-y-1">
                <p>1. Open WhatsApp on your phone</p>
                <p>2. Tap Menu ( ⋮ or ⚙️ ) &gt; Linked Devices</p>
                <p>3. Tap Link a Device</p>
              </div>
            </div>
          </div>
        )}

        {qrStatus === 'connected' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
              <Activity className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">Account Linked!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your AI agent can now send messages from this number.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-center border-t border-white/5 pt-4">
          <Button variant="ghost" onClick={() => handleClose(false)} className="text-muted-foreground hover:text-foreground">
            {qrStatus === 'connected' ? 'Close' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
