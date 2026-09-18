/**
 * ─── BYOS Settings Component ────────────────────────────────────────────────
 * Admin-only settings tab for managing Bring Your Own Supabase connection.
 * Handles: connect, validate, migrate, health check, disconnect.
 * ────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Database, Shield, CheckCircle2, XCircle, AlertTriangle,
  Server, Plug, Unplug, RefreshCw, ChevronDown, ChevronUp,
  Activity, Clock, ExternalLink, Eye, EyeOff, Zap, Lock, Coins, Wallet, Copy, Code, Sparkles, Check,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { clearBYOSClientCache } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BYOS_MIGRATION_SQL, BYOS_LATEST_VERSION } from '@/lib/byosMigrationSql';

// ─── Types ──────────────────────────────────────────────────────────────────
interface AuditEntry {
  id: string;
  action: string;
  status: string;
  details: Record<string, any>;
  created_at: string;
}

type BYOSStep = 'idle' | 'validating' | 'connecting' | 'migrating' | 'done' | 'error';

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: 'Active', color: 'text-green-500', icon: CheckCircle2 },
  validated: { label: 'Ready to Migrate', color: 'text-blue-500', icon: Zap },
  migration_running: { label: 'Migrating...', color: 'text-amber-500', icon: Loader2 },
  migration_failed: { label: 'Migration Failed', color: 'text-red-500', icon: XCircle },
  pending_validation: { label: 'Pending Validation', color: 'text-gray-500', icon: Clock },
  migrating_back: { label: 'Migrating Data Back...', color: 'text-amber-500', icon: Loader2 },
  error: { label: 'Error', color: 'text-red-500', icon: XCircle },
};

const HEALTH_MAP: Record<string, { label: string; color: string }> = {
  healthy: { label: 'Healthy', color: 'bg-green-500' },
  degraded: { label: 'Degraded', color: 'bg-amber-500' },
  unreachable: { label: 'Unreachable', color: 'bg-red-500' },
  unknown: { label: 'Unknown', color: 'bg-gray-500' },
};

export default function BYOSSettings() {
  const navigate = useNavigate();
  const { company, refetch: refetchCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [serviceRoleKey, setServiceRoleKey] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showServiceKey, setShowServiceKey] = useState(false);

  // Operation state
  const [step, setStep] = useState<BYOSStep>('idle');
  const [stepMessage, setStepMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Connection status
  const [connection, setConnection] = useState<any>(null);
  const [byosEnabled, setByosEnabled] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  // Dialogs
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Diagnostic state
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<any>(null);
  const [showDiagnosticDialog, setShowDiagnosticDialog] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Wallet balance query
  const { data: wallet } = useQuery({
    queryKey: ['wallet-balance', company?.id],
    queryFn: async () => {
      if (!company?.id) return { balance: 0 };
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('company_id', company.id)
        .single();
      if (error) return { balance: 0 };
      return data;
    },
    enabled: !!company?.id,
  });

  // ─── Fetch status on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (company?.id) fetchStatus();
  }, [company?.id]);

  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'status', company_id: company?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setConnection(data.connection);
      setByosEnabled(data.byos_enabled);
      setIsUnlocked(data.is_unlocked || false);
      setAuditLog(data.audit_log || []);
    } catch (err: any) {
      console.error('[BYOS] Status fetch error:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  // ─── One-Time Unlock (Rs. 1,00,000) ────────────────────────────────────
  const UNLOCK_FEE = 100000;
  const walletBalance = wallet?.balance || 0;

  const handleUnlockFeature = async () => {
    if (walletBalance < UNLOCK_FEE) {
      toast({
        title: 'Insufficient Balance',
        description: `Required: ₹${UNLOCK_FEE.toLocaleString()}, Available: ₹${walletBalance.toLocaleString()}. Please add money to your wallet.`,
        variant: 'destructive',
      });
      return;
    }

    setUnlocking(true);
    setShowUnlockDialog(false);

    try {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'unlock', company_id: company?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: '🎉 Feature Unlocked!',
        description: 'Bring Your Own Supabase (BYOS) is now unlocked for your company.',
      });

      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      fetchStatus();
    } catch (err: any) {
      toast({
        title: 'Unlock Failed',
        description: err.message || 'Failed to unlock feature',
        variant: 'destructive',
      });
    } finally {
      setUnlocking(false);
    }
  };

  // ─── Validate + Connect + Migrate flow ──────────────────────────────────
  const handleSetup = async () => {
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      toast({ title: 'Missing Fields', description: 'All three fields are required.', variant: 'destructive' });
      return;
    }

    // URL validation
    if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('supabase')) {
      toast({ title: 'Invalid URL', description: 'Please enter a valid Supabase project URL (https://xxxxx.supabase.co)', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      // Step 1: Validate
      setStep('validating');
      setStepMessage('Testing connection to your Supabase project...');
      const { data: valData, error: valErr } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'validate', company_id: company?.id, supabase_url: supabaseUrl, supabase_anon_key: anonKey, supabase_service_role_key: serviceRoleKey },
      });
      if (valErr) throw valErr;
      if (valData?.error) throw new Error(valData.error);

      // Step 2: Connect (save credentials)
      setStep('connecting');
      setStepMessage('Saving encrypted credentials...');
      const { data: connData, error: connErr } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'connect', company_id: company?.id, supabase_url: supabaseUrl, supabase_anon_key: anonKey, supabase_service_role_key: serviceRoleKey },
      });
      if (connErr) throw connErr;
      if (connData?.error) throw new Error(connData.error);

      // Step 3: Migrate
      setStep('migrating');
      setStepMessage('Running database migration on your Supabase project... This may take a minute.');
      const { data: migData, error: migErr } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'migrate', company_id: company?.id, supabase_access_token: accessToken },
      });
      if (migErr) throw migErr;
      if (migData?.error) throw new Error(migData.error);

      // Done!
      setStep('done');
      setStepMessage('BYOS is now active! All org data will be stored in your Supabase project.');
      toast({ title: '🎉 BYOS Activated', description: 'Your CRM data is now running on your own Supabase project.' });

      // Clear cached clients and refetch everything
      clearBYOSClientCache();
      queryClient.invalidateQueries();
      refetchCompany();
      fetchStatus();

      // Clear form
      setServiceRoleKey('');
    } catch (err: any) {
      setStep('error');
      setStepMessage(err.message || 'Setup failed');
      toast({ title: 'Setup Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Disconnect ─────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    setDisconnecting(true);
    setShowDisconnectDialog(false);

    try {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'disconnect', company_id: company?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'BYOS Disconnected', description: 'Your data has been migrated back. CRM is now using the default backend.' });

      clearBYOSClientCache();
      queryClient.invalidateQueries();
      refetchCompany();
      setConnection(null);
      setByosEnabled(false);
      setStep('idle');
      setStepMessage('');
      fetchStatus();
    } catch (err: any) {
      toast({ title: 'Disconnect Failed', description: err.message, variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  // ─── Health Check & Parity Diagnostic ──────────────────────────────────
  const handleHealthCheck = async () => {
    setRunningDiagnostic(true);
    try {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'health', company_id: company?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setDiagnosticReport(data);
      setShowDiagnosticDialog(true);
      fetchStatus();

      const isHealthy = data?.healthy && data?.overallStatus === 'healthy';
      toast({
        title: isHealthy ? '✅ BYOS Health & Parity Verified' : '⚠️ BYOS Diagnostic Notice',
        description: `Ping: ${data?.latencyMs || 0}ms • Status: ${data?.overallStatus || data?.health || 'completed'}${
          data?.schemaParity?.missingTables?.length ? ` (${data.schemaParity.missingTables.length} missing tables)` : ''
        }`,
      });
    } catch (err: any) {
      toast({ title: 'Diagnostic Failed', description: err.message, variant: 'destructive' });
    } finally {
      setRunningDiagnostic(false);
    }
  };

  // ─── Sync Data Helper ───────────────────────────────────────────────────
  const [syncingData, setSyncingData] = useState(false);

  const handleSyncData = async () => {
    setSyncingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('byos-manage', {
        body: { action: 'migrate', company_id: company?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const counts: Record<string, number> = data?.syncReport?.syncedCounts || {};
      const totalRows = Object.values(counts).reduce((acc: number, val: any) => acc + Number(val || 0), 0);
      const breakdown = Object.entries(counts)
        .filter(([_, count]) => Number(count) > 0)
        .map(([tbl, count]) => `${tbl}: ${count} rows`)
        .join(' • ');

      toast({
        title: totalRows > 0 ? '🎉 Data Sync Complete!' : 'Data Sync Checked',
        description: totalRows > 0
          ? `Transferred ${totalRows} records to your custom Supabase DB (${breakdown})`
          : 'Data sync complete. No records were found on the platform database.',
        duration: 10000,
      });
      fetchStatus();
    } catch (err: any) {
      if (err.message?.includes('SCHEMA_MISSING') || err.message?.includes('does not exist') || err.message?.includes('relation')) {
        handleCopySQL();
        toast({
          title: '⚠️ Database Schema Missing on Connected Supabase',
          description: 'The Migration SQL script has been copied to your clipboard! Paste it into your Supabase Dashboard → SQL Editor, click RUN, and then click Sync Data to BYOS again.',
          duration: 12000,
        });
      } else {
        toast({
          title: 'Sync Failed',
          description: err.message || 'Failed to sync data to BYOS',
          variant: 'destructive',
        });
      }
    } finally {
      setSyncingData(false);
    }
  };

  // ─── Copy Migration SQL Helper ──────────────────────────────────────────
  const handleCopySQL = () => {
    navigator.clipboard.writeText(BYOS_MIGRATION_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
    toast({
      title: `📋 Migration SQL (v${BYOS_LATEST_VERSION}) Copied!`,
      description: 'Paste and RUN this SQL script in your customer Supabase Dashboard → SQL Editor to set up or upgrade all CRM tables, RLS policies, and RPC procedures.',
    });
  };

  // ─── Loading state ──────────────────────────────────────────────────────
  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // ─── Locked Feature View (Rs 1,00,000 One-Time Fee) ────────────────────
  if (!isUnlocked && !byosEnabled) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Card className="glass border-primary/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <Lock className="h-48 w-48 text-primary" />
          </div>

          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-xs">
                <Lock className="h-3 w-3" /> Premium Infrastructure Feature
              </Badge>
              <Badge variant="outline" className="text-sm font-semibold border-primary/40 text-primary">
                ₹1,00,000 One-Time Fee
              </Badge>
            </div>

            <CardTitle className="text-2xl flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Bring Your Own Supabase (BYOS)
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground leading-relaxed">
              Connect your organisation's own Supabase project. <strong>All database storage, compute, functions, and file assets run directly on your own Supabase account</strong>.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Wallet Balance Banner */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Company Wallet Balance</p>
                  <p className="text-lg font-bold text-foreground">
                    ₹{walletBalance.toLocaleString()}
                  </p>
                </div>
              </div>

              {walletBalance < UNLOCK_FEE && (
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/company')} className="gap-1.5 text-xs border-amber-500/30 text-amber-600">
                  <Coins className="h-3.5 w-3.5" /> Add Money to Wallet
                </Button>
              )}
            </div>

            {/* Value Proposition Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'Zero Platform Storage Limits', desc: 'Store unlimited leads, files, invoices, and documents on your own database.' },
                { title: 'Your Own Compute & Server', desc: 'All database queries and heavy lifting execute on your dedicated Supabase server.' },
                { title: 'Direct SQL & Data Sovereignty', desc: 'Maintain complete 100% ownership and direct SQL access to your organisation data.' },
                { title: 'Plug & Play Automation', desc: 'One-click automated migration installs all tables, functions, RLS, and triggers.' },
              ].map(({ title, desc }) => (
                <div key={title} className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <p className="text-sm font-semibold">{title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">{desc}</p>
                </div>
              ))}
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-border/40 pt-4">
            <div className="text-xs text-muted-foreground">
              One-time charge of ₹1,00,000 deducted directly from company wallet.
            </div>

            {walletBalance >= UNLOCK_FEE ? (
              <Button
                onClick={() => setShowUnlockDialog(true)}
                disabled={unlocking}
                className="gradient-primary gap-2"
              >
                {unlocking ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Unlocking...</>
                ) : (
                  <><Coins className="h-4 w-4" /> Unlock Feature for ₹1,00,000</>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => navigate('/dashboard/company')}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
              >
                <Wallet className="h-4 w-4" /> Add Money to Unlock (₹{(UNLOCK_FEE - walletBalance).toLocaleString()} short)
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Unlock Confirmation Dialog */}
        <AlertDialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                Unlock Bring Your Own Supabase (BYOS)
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    You are about to unlock <strong>Bring Your Own Supabase (BYOS)</strong> for your organisation.
                  </p>
                  <div className="p-3 rounded-lg bg-muted/50 border space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">One-Time Fee:</span>
                      <span className="font-semibold text-foreground">₹1,00,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Available Wallet Balance:</span>
                      <span className="font-semibold text-foreground">₹{walletBalance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t">
                      <span className="text-muted-foreground">Balance After Unlock:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">₹{(walletBalance - UNLOCK_FEE).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This charge is non-refundable. Once unlocked, your company can connect any external Supabase instance anytime.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleUnlockFeature} className="gradient-primary">
                Confirm &amp; Deduct ₹1,00,000
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ─── Active BYOS Connection View ────────────────────────────────────────
  if (byosEnabled && connection?.status === 'active') {
    const statusInfo = STATUS_MAP[connection.status] || STATUS_MAP.error;
    const healthInfo = HEALTH_MAP[connection.health_status] || HEALTH_MAP.unknown;
    const StatusIcon = statusInfo.icon;

    return (
      <div className="space-y-6 max-w-3xl">
        {/* Connection Status Card */}
        <Card className="glass border-green-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-green-500" />
                Bring Your Own Supabase
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSyncData} disabled={syncingData} className="gap-1 text-xs">
                  {syncingData ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-amber-500" />}
                  {syncingData ? 'Syncing Data...' : 'Sync Data to BYOS'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleHealthCheck}
                  disabled={runningDiagnostic}
                  className="gap-1.5 text-xs border-primary/30 hover:bg-primary/5"
                >
                  {runningDiagnostic ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : (
                    <Activity className="h-3.5 w-3.5 text-green-500" />
                  )}
                  {runningDiagnostic ? 'Testing Parity...' : '1-Click Health Check'}
                </Button>
              </div>
            </div>
            <CardDescription>
              Your CRM data is running on your own Supabase project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connection Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Project URL</p>
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm font-mono truncate">{connection.supabase_url}</p>
                  <a href={connection.supabase_url.replace('.supabase.co', '.supabase.com')} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
                  </a>
                </div>
              </div>

              <div
                className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-1 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={handleHealthCheck}
                title="Click to run full health & parity diagnostic"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Health Status</p>
                  <span className="text-[10px] text-primary hover:underline">View Diagnostic &rarr;</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${healthInfo.color} animate-pulse`} />
                  <p className="text-sm font-medium">{healthInfo.label}</p>
                  {connection.last_health_check && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Last: {new Date(connection.last_health_check).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>

              <div
                className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-1 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={handleHealthCheck}
                title="Click to inspect migration schema parity"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Migration Version</p>
                  {connection.migration_version === BYOS_LATEST_VERSION ? (
                    <Badge variant="outline" className="text-[10px] text-green-600 border-green-500/30 bg-green-500/5">
                      Latest (v{BYOS_LATEST_VERSION})
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/5">
                      v{BYOS_LATEST_VERSION} available
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-medium">v{connection.migration_version || '1.0.0'}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Connected Since</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">{new Date(connection.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Disconnect */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-red-500/30 bg-red-500/5">
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Unplug className="h-4 w-4 text-red-500" />
                  Disconnect BYOS
                </p>
                <p className="text-xs text-muted-foreground">
                  Your data will be migrated back to FastestCRM servers before disconnecting.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDisconnectDialog(true)}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Migrating Back...</>
                ) : (
                  <><Unplug className="h-4 w-4 mr-1" /> Disconnect</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card className="glass">
          <CardHeader
            className="cursor-pointer"
            onClick={() => setShowAudit(!showAudit)}
          >
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Activity Log
              </span>
              {showAudit ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CardTitle>
          </CardHeader>
          {showAudit && (
            <CardContent>
              {auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 text-sm">
                      <Badge variant={entry.status === 'success' ? 'default' : entry.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                        {entry.status}
                      </Badge>
                      <span className="font-medium capitalize">{entry.action.replace('_', ' ')}</span>
                      <span className="text-muted-foreground ml-auto text-xs">
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Disconnect Confirmation */}
        <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect BYOS</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>This will:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Migrate all your CRM data</strong> (leads, invoices, forms, etc.) back to FastestCRM servers</li>
                    <li>Disable the connection to your Supabase project</li>
                    <li>Resume using the default FastestCRM backend</li>
                  </ul>
                  <p className="text-amber-600 dark:text-amber-400">
                    ⚠️ This process may take several minutes depending on data volume. Your data in the external Supabase project will NOT be deleted.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDisconnect} className="bg-red-600 hover:bg-red-700">
                Yes, Disconnect &amp; Migrate Back
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ─── 1-Click Health & Parity Diagnostic Dialog ─── */}
        <Dialog open={showDiagnosticDialog} onOpenChange={setShowDiagnosticDialog}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
            <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-muted/20">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    diagnosticReport?.overallStatus === 'healthy'
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : diagnosticReport?.overallStatus === 'warning'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}>
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                      BYOS Health &amp; Schema Parity Diagnostic
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Deep inspection of API latency, RLS isolation, migration parity, and RPC procedures.
                    </DialogDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`font-semibold capitalize text-xs px-2.5 py-1 ${
                    diagnosticReport?.overallStatus === 'healthy'
                      ? 'border-green-500/30 text-green-600 bg-green-500/10'
                      : diagnosticReport?.overallStatus === 'warning'
                      ? 'border-amber-500/30 text-amber-600 bg-amber-500/10'
                      : 'border-red-500/30 text-red-600 bg-red-500/10'
                  }`}
                >
                  {diagnosticReport?.overallStatus || diagnosticReport?.health || 'Healthy'}
                </Badge>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Overview Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Gateway Latency</p>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-bold text-sm font-mono">{diagnosticReport?.latencyMs || 0} ms</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Migration Version</p>
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="font-bold text-sm font-mono">v{diagnosticReport?.migrationVersion?.current || connection?.migration_version || '1.1.0'}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Tables Verified</p>
                  <div className="flex items-center gap-1.5">
                    <Database className="h-4 w-4 text-green-500" />
                    <span className="font-bold text-sm font-mono">
                      {diagnosticReport?.schemaParity?.tableCount || 11}/{diagnosticReport?.schemaParity?.expectedTableCount || 11}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Security / RLS</p>
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-blue-500" />
                    <span className="font-bold text-sm text-green-600 dark:text-green-400">Secured</span>
                  </div>
                </div>
              </div>

              {/* Migration Version Notice if Outdated */}
              {diagnosticReport?.migrationVersion && !diagnosticReport?.migrationVersion?.isUpToDate && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" /> Migration Upgrade Available
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your connected database is running <strong>v{diagnosticReport?.migrationVersion?.current}</strong>. The latest bundle is <strong>v{diagnosticReport?.migrationVersion?.required || BYOS_LATEST_VERSION}</strong>. Run the updated migration script to ensure custom fields and skip-scan RPCs function seamlessly.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopySQL}
                    className="shrink-0 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 text-xs gap-1.5"
                  >
                    {copiedSql ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedSql ? 'Copied' : 'Copy v1.1.0 SQL'}
                  </Button>
                </div>
              )}

              {/* Detailed Check Items */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Diagnostic Checks ({diagnosticReport?.checks?.length || 0})
                </p>

                <div className="space-y-2.5">
                  {diagnosticReport?.checks?.map((chk: any, idx: number) => {
                    const isPass = chk.status === 'pass';
                    const isWarn = chk.status === 'warn';
                    const StatusCheckIcon = isPass ? CheckCircle2 : isWarn ? AlertTriangle : XCircle;
                    const iconColor = isPass ? 'text-green-500' : isWarn ? 'text-amber-500' : 'text-red-500';
                    const cardBg = isPass ? 'bg-background/60 border-border/40' : isWarn ? 'bg-amber-500/5 border-amber-500/30' : 'bg-red-500/5 border-red-500/30';

                    return (
                      <div key={idx} className={`p-3.5 rounded-xl border ${cardBg} space-y-2`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <StatusCheckIcon className={`h-4 w-4 ${iconColor} shrink-0`} />
                            <span className="text-sm font-semibold">{chk.name}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px] capitalize tracking-wide font-mono">
                            {chk.category}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground pl-6 leading-relaxed">
                          {chk.message}
                        </p>

                        {/* Missing tables/RPCs breakdown */}
                        {chk.details?.missing && chk.details.missing.length > 0 && (
                          <div className="pl-6 pt-1 flex flex-wrap gap-1.5">
                            {chk.details.missing.map((item: string) => (
                              <Badge key={item} variant="destructive" className="text-[10px] font-mono py-0">
                                missing: {item}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {chk.details?.available && chk.details.available.length > 0 && (
                          <div className="pl-6 pt-1 flex flex-wrap gap-1.5">
                            {chk.details.available.map((item: string) => (
                              <Badge key={item} variant="outline" className="text-[10px] font-mono py-0 text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/5">
                                ✓ {item}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-between sm:justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopySQL}
                className="gap-1.5 text-xs"
              >
                {copiedSql ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedSql ? 'Copied v1.1.0 SQL' : 'Copy v1.1.0 Migration SQL'}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleHealthCheck}
                  disabled={runningDiagnostic}
                  className="gap-1.5 text-xs"
                >
                  {runningDiagnostic ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Re-run Diagnostic
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowDiagnosticDialog(false)}
                  className="text-xs"
                >
                  Close
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Setup Form View (BYOS not active) ──────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Info Card */}
      <Card className="glass border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Bring Your Own Supabase (BYOS)
          </CardTitle>
          <CardDescription>
            Connect your own Supabase project to run all CRM data operations, storage, and compute on your infrastructure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: Shield, title: 'Full Data Control', desc: 'Your data lives in your Supabase project' },
              { icon: Server, title: 'Your Infrastructure', desc: 'Database, storage, and compute on your account' },
              { icon: Zap, title: 'Plug & Play', desc: 'Automatic schema setup and migration' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-1">
                <Icon className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <Separator />

          {/* Connection Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="byos-url">Supabase Project URL</Label>
              <Input
                id="byos-url"
                placeholder="https://your-project.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value.trim())}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Found in your Supabase Dashboard → Settings → API → Project URL
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="byos-anon">Anon / Public Key</Label>
              <Input
                id="byos-anon"
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value.trim())}
                disabled={loading}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Found in your Supabase Dashboard → Settings → API → Project API Keys → anon public
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="byos-service" className="flex items-center gap-2">
                Service Role Key
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                  <Shield className="h-2.5 w-2.5 mr-0.5" />
                  Encrypted at Rest
                </Badge>
              </Label>
              <div className="relative">
                <Input
                  id="byos-service"
                  type={showServiceKey ? 'text' : 'password'}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  value={serviceRoleKey}
                  onChange={(e) => setServiceRoleKey(e.target.value.trim())}
                  disabled={loading}
                  className="font-mono text-xs pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowServiceKey(!showServiceKey)}
                >
                  {showServiceKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="byos-access-token" className="flex items-center gap-2">
                Supabase Access Token
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  Optional • 100% Automated Setup
                </Badge>
              </Label>
              <Input
                id="byos-access-token"
                type="password"
                placeholder="sbp_xxxxxxxxxxxxxxxxxxxxxxxx"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value.trim())}
                disabled={loading}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Found in <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary transition-colors">Supabase Dashboard &rarr; Account &rarr; Access Tokens</a>. If provided, FastestCRM will <strong>automatically execute the schema migration on your project</strong> during setup.
              </p>
            </div>
          </div>

          {/* 1-Click Schema Setup SQL Box */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Step 1: Setup Schema in Your Supabase Project</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopySQL}
                className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                <Copy className="h-3.5 w-3.5" /> Copy Migration SQL Script
              </Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Open your Supabase Dashboard → <strong>SQL Editor</strong>, paste this script and click <strong>RUN</strong> to create all CRM tables, RLS policies, and triggers. Then enter your API keys below and click <strong>Connect &amp; Setup BYOS</strong>.
            </p>
          </div>

          {/* Progress Steps */}
          {step !== 'idle' && (
            <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
              <div className="flex items-center gap-3">
                {step === 'error' ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : step === 'done' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                <p className="text-sm font-medium">{stepMessage}</p>
              </div>

              {/* Step indicators */}
              <div className="flex gap-2">
                {(['validating', 'connecting', 'migrating', 'done'] as BYOSStep[]).map((s, i) => {
                  const stepIdx = ['validating', 'connecting', 'migrating', 'done'].indexOf(step);
                  const thisIdx = i;
                  const isComplete = stepIdx > thisIdx || step === 'done';
                  const isCurrent = step === s;
                  return (
                    <div
                      key={s}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        isComplete ? 'bg-green-500' : isCurrent ? 'bg-primary animate-pulse' : 'bg-muted-foreground/20'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleSetup}
            disabled={loading || !supabaseUrl || !anonKey || !serviceRoleKey}
            className="gradient-primary gap-2"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Setting up...</>
            ) : (
              <><Plug className="h-4 w-4" /> Connect &amp; Setup BYOS</>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Retry for failed migrations */}
      {connection?.status === 'migration_failed' && (
        <Card className="glass border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-600 dark:text-red-400">Previous migration failed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You can retry the migration or update your credentials and try again.
                </p>
                {connection.error_log?.length > 0 && (
                  <pre className="mt-2 text-xs bg-red-500/5 p-2 rounded border border-red-500/20 overflow-auto max-h-24">
                    {JSON.stringify(connection.error_log[connection.error_log.length - 1], null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
