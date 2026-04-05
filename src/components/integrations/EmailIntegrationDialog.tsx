import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Mail, Loader2, Check, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface EmailIntegrationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailIntegrationDialog({ isOpen, onOpenChange }: EmailIntegrationDialogProps) {
  const { user } = useAuth();
  const { company, isCompanyAdmin } = useCompany();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const { data: integration, isLoading } = useQuery({
    queryKey: ['email-integration', company?.id],
    queryFn: async () => {
      if (!company?.id) return null;
      const { data } = await supabase
        .from('email_integrations' as any)
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!company?.id && isOpen,
  });

  // Listen for OAuth success message from popup
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'OUTLOOK_OAUTH_SUCCESS') {
        toast.success('Outlook connected successfully!');
        queryClient.invalidateQueries({ queryKey: ['email-integration'] });
        setConnecting(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [queryClient]);

  const handleConnectGmail = async () => {
    setConnecting(true);
    try {
      // Use the Google Client ID provided by user
      const clientId = '1033874890501-p253hb5at1qb077rcoitv6pjc9elf75n.apps.googleusercontent.com';
      
      const redirectUri = window.location.origin + '/google-oauth-callback';
      const scope = encodeURIComponent('https://mail.google.com/ https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');
      const state = encodeURIComponent(window.location.pathname);
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;
      
      // We can use a popup for consistency with Outlook or just redirect. Let's use redirect as in FastSend.
      window.location.href = authUrl;
    } catch (err: any) {
      toast.error(err.message || 'Connection failed');
      setConnecting(false);
    }
  };

  const handleConnectOutlook = async () => {
    setConnecting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { toast.error('Not authenticated'); setConnecting(false); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/outlook-oauth?action=authorize`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();

      if (data.url) {
        window.open(data.url, 'outlook-oauth', 'width=600,height=700,scrollbars=yes');
      } else {
        toast.error(data.error || 'Failed to get auth URL');
        setConnecting(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Connection failed');
      setConnecting(false);
    }
  };

  const handleToggleDashboard = async (enabled: boolean) => {
    if (!integration?.id) return;
    const { error } = await supabase
      .from('email_integrations' as any)
      .update({ email_dashboard_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', integration.id);

    if (error) { toast.error('Failed to update'); return; }
    toast.success(enabled ? 'Email Dashboard enabled for org' : 'Email Dashboard disabled');
    queryClient.invalidateQueries({ queryKey: ['email-integration'] });
  };

  const isConnected = integration?.is_active;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email Integration</DialogTitle>
          <DialogDescription>Connect your organization's email provider</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Gmail option */}
          <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-red-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Gmail</p>
              <p className="text-xs text-muted-foreground">
                {isConnected && integration?.provider === 'gmail' ? `Connected as ${integration?.admin_email}` : 'Google Workspace integration'}
              </p>
            </div>
            {isConnected && integration?.provider === 'gmail' ? (
              <Badge className="bg-green-500 hover:bg-green-600">
                <Check className="h-3 w-3 mr-1" /> Connected
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={handleConnectGmail}
                disabled={connecting || !isCompanyAdmin}
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ExternalLink className="h-4 w-4 mr-1" />}
                Connect
              </Button>
            )}
          </div>

          {/* Outlook option */}
          <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Outlook / Microsoft 365</p>
              <p className="text-xs text-muted-foreground">
                {isConnected ? `Connected as ${integration?.admin_email}` : 'Connect via Microsoft OAuth'}
              </p>
            </div>
            {isConnected ? (
              <Badge className="bg-green-500 hover:bg-green-600">
                <Check className="h-3 w-3 mr-1" /> Connected
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={handleConnectOutlook}
                disabled={connecting || !isCompanyAdmin}
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ExternalLink className="h-4 w-4 mr-1" />}
                Connect
              </Button>
            )}
          </div>

          {/* Dashboard toggle - only when connected */}
          {isConnected && isCompanyAdmin && (
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
              <div>
                <p className="text-sm font-medium text-foreground">Email Dashboard</p>
                <p className="text-xs text-muted-foreground">Enable in-app email for your whole team</p>
              </div>
              <Switch
                checked={integration?.email_dashboard_enabled || false}
                onCheckedChange={handleToggleDashboard}
              />
            </div>
          )}

          {!isCompanyAdmin && (
            <p className="text-xs text-muted-foreground text-center">Only company admins can manage email integrations</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
