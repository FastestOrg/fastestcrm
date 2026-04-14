import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Facebook, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useQueryClient } from '@tanstack/react-query';

interface MetaAdsSetupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  existingIntegration?: {
    id: string;
    page_name: string | null;
    default_lead_status: string | null;
    webhook_verify_token: string | null;
  } | null;
}

type Step = 'connect' | 'select-page' | 'success';

interface FacebookPage {
  id: string;
  name: string;
}

// Meta App ID - this is public/publishable
const META_APP_ID = '1222309222740033';

// Use the already-deployed edge function URL as redirect_uri.
const META_OAUTH_REDIRECT_URI = `https://api.fastestcrm.com/functions/v1/meta-oauth-callback`;

// Only accept postMessage events from our callback origins.
const META_OAUTH_ALLOWED_ORIGINS = new Set([
  'https://api.fastestcrm.com',
  'https://fastestcrm.com',
  'https://www.fastestcrm.com',
]);

// Timeout for OAuth flow (5 minutes)
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

export function MetaAdsSetupDialog({
  isOpen,
  onOpenChange,
  onComplete,
  existingIntegration,
}: MetaAdsSetupDialogProps) {
  const { toast } = useToast();
  const { company } = useCompany();
  const { statuses } = useLeadStatuses();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('connect');
  const [isLoading, setIsLoading] = useState(false);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [defaultStatus, setDefaultStatus] = useState(
    existingIntegration?.default_lead_status || 'new'
  );
  const [connectedPage, setConnectedPage] = useState(existingIntegration?.page_name || '');

  // Refs for cleanup
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isProcessingRef.current = false;
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (existingIntegration?.page_name) {
        setStep('success');
        setConnectedPage(existingIntegration.page_name);
      } else {
        setStep('connect');
      }
      setPages([]);
      setSelectedPageId('');
      cleanup();
    } else {
      cleanup();
    }
  }, [isOpen, existingIntegration, cleanup]);

  // Handle OAuth callback - memoized to use in effects
  const handleOAuthCallback = useCallback(async (code: string) => {
    if (!company?.id || isProcessingRef.current) return;

    isProcessingRef.current = true;
    cleanup();

    try {
      const redirectUri = META_OAUTH_REDIRECT_URI;

      const { data, error } = await supabase.functions.invoke('meta-oauth-callback', {
        body: {
          code,
          redirectUri,
          companyId: company.id,
          defaultStatus,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.pages && data.pages.length > 0) {
        setPages(data.pages);
        setStep('select-page');
        toast({
          title: 'Connected!',
          description: 'Now select a Facebook Page to receive leads from.',
        });
      } else {
        toast({
          title: 'No Pages Found',
          description: 'You need a Facebook Page with Lead Ads to continue.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      console.error('OAuth callback error:', err);
      toast({ title: 'Connection Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  }, [company?.id, defaultStatus, toast, cleanup]);

  // Listen for OAuth callback message via postMessage
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type !== 'META_OAUTH_CALLBACK') return;

      // Accept messages from allowed origins only
      if (!META_OAUTH_ALLOWED_ORIGINS.has(event.origin)) {
        console.warn('Ignored postMessage from unexpected origin:', event.origin);
        return;
      }

      if (event.data?.code) {
        // Clear localStorage if present to prevent double processing
        localStorage.removeItem('meta_oauth_code');
        localStorage.removeItem('meta_oauth_timestamp');
        await handleOAuthCallback(event.data.code);
        return;
      }

      if (event.data?.error) {
        setIsLoading(false);
        cleanup();
        toast({
          title: 'Facebook Login Failed',
          description: event.data.error,
          variant: 'destructive',
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleOAuthCallback, toast, cleanup]);

  // Poll localStorage as fallback for cross-origin popup communication
  useEffect(() => {
    if (!isLoading || step !== 'connect') return;

    pollIntervalRef.current = setInterval(() => {
      const storedCode = localStorage.getItem('meta_oauth_code');
      const timestamp = localStorage.getItem('meta_oauth_timestamp');

      if (storedCode && timestamp) {
        const codeAge = Date.now() - parseInt(timestamp, 10);

        // Only accept codes less than 5 minutes old
        if (codeAge < OAUTH_TIMEOUT_MS) {
          localStorage.removeItem('meta_oauth_code');
          localStorage.removeItem('meta_oauth_timestamp');
          handleOAuthCallback(storedCode);
        } else {
          // Code is too old, clean it up
          localStorage.removeItem('meta_oauth_code');
          localStorage.removeItem('meta_oauth_timestamp');
        }
      }
    }, 1000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isLoading, step, handleOAuthCallback]);

  const handleFacebookLogin = () => {
    if (!company?.id) {
      toast({ title: 'Error', description: 'Company not found', variant: 'destructive' });
      return;
    }

    // Clear any stale OAuth data
    localStorage.removeItem('meta_oauth_code');
    localStorage.removeItem('meta_oauth_timestamp');

    const redirectUri = META_OAUTH_REDIRECT_URI;
    const scope = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_metadata',
      'pages_manage_ads',
      'leads_retrieval',
      'ads_management',
      'business_management',
    ].join(',');

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${scope}&response_type=code&state=${company.id}`;

    // Open popup for OAuth
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(authUrl, 'meta-oauth', `width=${width},height=${height},left=${left},top=${top}`);

    setIsLoading(true);

    // Set timeout to prevent infinite loading state
    timeoutRef.current = setTimeout(() => {
      if (isLoading && step === 'connect') {
        setIsLoading(false);
        toast({
          title: 'Connection Timeout',
          description: 'The Facebook login took too long. Please try again.',
          variant: 'destructive',
        });
      }
    }, OAUTH_TIMEOUT_MS);
  };

  const handleSelectPage = async () => {
    if (!selectedPageId || !company?.id) return;

    const selectedPage = pages.find((p) => p.id === selectedPageId);
    if (!selectedPage) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-select-page', {
        body: {
          companyId: company.id,
          pageId: selectedPageId,
          pageName: selectedPage.name,
        },
      });

      if (error) {
        console.error('Edge function invocation error:', error);
        throw error;
      }
      if (data?.error) {
        console.error('Edge function returned error:', data.error);
        throw new Error(data.error);
      }

      setConnectedPage(selectedPage.name);
      setStep('success');

      // Invalidate queries to refresh integration status
      queryClient.invalidateQueries({ queryKey: ['performance-marketing-integrations'] });

      toast({ title: 'Success!', description: data?.message || 'Page connected successfully!' });
      onComplete?.();
    } catch (err: any) {
      console.error('Select page error:', err);
      toast({ title: 'Error', description: err.message || 'Failed to connect page', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!existingIntegration?.id) return;

    // Simple confirm
    if (!confirm('Are you sure you want to disconnect Meta Ads? This will stop lead syncing immediately.')) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('performance_marketing_integrations' as any)
        .delete()
        .eq('id', existingIntegration.id);

      if (error) throw error;

      toast({
        title: 'Disconnected',
        description: 'Meta Ads integration has been removed.',
      });

      onComplete?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Disconnect error:', err);
      toast({
        title: 'Error',
        description: 'Failed to disconnect integration',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            Connect Meta Lead Ads
          </DialogTitle>
          <DialogDescription>
            {step === 'connect' && 'Login with Facebook to connect your Lead Ad forms.'}
            {step === 'select-page' && 'Select the Facebook Page to receive leads from.'}
            {step === 'success' && 'Your Meta Lead Ads are now connected!'}
          </DialogDescription>
        </DialogHeader>

        {step === 'connect' && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Default Lead Status</Label>
              <Select value={defaultStatus} onValueChange={setDefaultStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status for new leads" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leads from Meta will be created with this status.
              </p>
            </div>

            <Button
              onClick={handleFacebookLogin}
              disabled={isLoading}
              className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Facebook className="mr-2 h-4 w-4" />
                  Continue with Facebook
                </>
              )}
            </Button>

            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium">We'll request access to:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Your Facebook Pages</li>
                <li>Lead Ads forms & submissions</li>
                <li>Page engagement data</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'select-page' && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Select Facebook Page</Label>
              <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a page" />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Lead form submissions from this page will sync to your CRM.
              </p>
            </div>

            <Button
              onClick={handleSelectPage}
              disabled={!selectedPageId || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting Page...
                </>
              ) : (
                'Connect Page'
              )}
            </Button>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-6 py-4 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Connected Successfully!</h3>
              <p className="text-muted-foreground">
                Leads from <span className="font-medium text-foreground">{connectedPage}</span> will now appear in your CRM automatically.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-left space-y-2">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium">Webhook Configuration Required</p>
                  <p className="mt-1">To receive leads in real-time, configure this webhook in your Meta App Dashboard:</p>
                </div>
              </div>
              <div className="bg-white rounded p-2 space-y-1 text-xs font-mono">
                <div>
                  <p className="text-gray-600">URL:</p>
                  <p className="text-gray-900 break-all">https://api.fastestcrm.com/functions/v1/meta-lead-webhook</p>
                </div>
                <div>
                  <p className="text-gray-600">Verify Token:</p>
                  <p className="text-gray-900">fastestcrm_meta_verify_2024</p>
                </div>
                <div>
                  <p className="text-gray-600">Field to Subscribe:</p>
                  <p className="text-gray-900">leadgen</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Done
              </Button>

              <Button
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 w-full"
                onClick={handleDisconnect}
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Disconnect Integration
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
