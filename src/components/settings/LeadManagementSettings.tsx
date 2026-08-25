import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLeadDedup } from '@/hooks/useLeadDedup';
import { useCompany } from '@/hooks/useCompany';
import { useOrgClient } from '@/hooks/useOrgClient';
import { useLeadsTable } from '@/hooks/useLeadsTable';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Fingerprint, Merge, Phone, Mail, ShieldCheck, Info, CheckCircle2, Trash2, AlertTriangle, Zap } from 'lucide-react';

export default function LeadManagementSettings() {
  const {
    isLoading,
    isPhoneUnique,
    isEmailUnique,
    toggleUniqueIdentifier,
    isToggling,
    mergeDuplicates,
    isMerging,
    mergeResult,
    progressMsg,
  } = useLeadDedup();

  const { company } = useCompany();
  const { orgClient } = useOrgClient();
  const { tableName, companyId } = useLeadsTable();
  const queryClient = useQueryClient();

  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState('Scanning database leads...');
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });

  const handleToggle = (attribute: string, currentValue: boolean) => {
    toggleUniqueIdentifier({ attribute, enabled: !currentValue });
  };

  const handleMerge = () => {
    mergeDuplicates();
    setShowMergeDialog(false);
  };

  const handleDeleteAllLeads = async () => {
    setShowDeleteDialog(false);
    const targetCompanyId = companyId || company?.id;

    setIsDeletingAll(true);
    setDeleteStatus('Executing database purge...');
    setDeleteProgress({ current: 0, total: 0 });

    try {
      const activeTable = tableName || 'leads';

      // ─── OPTIMIZATION 1: Try Direct Server-Side PL/pgSQL RPC Purge ─────────
      // Direct in-database PL/pgSQL loop executes sub-second with ZERO HTTP roundtrips!
      try {
        const { data: rpcCount, error: rpcErr } = await (orgClient as any).rpc('purge_company_leads', {
          p_company_id: targetCompanyId || null,
          p_table_name: activeTable,
        });

        if (!rpcErr && typeof rpcCount === 'number') {
          setDeleteProgress({ current: rpcCount, total: Math.max(1, rpcCount) });
          if (rpcCount === 0) {
            toast.info('No leads found to delete.');
          } else {
            toast.success(`Successfully purged all ${rpcCount.toLocaleString()} leads in sub-second database engine!`);
          }
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['travel-leads'] });
          queryClient.invalidateQueries({ queryKey: ['real-estate-leads'] });
          queryClient.invalidateQueries({ queryKey: ['saas-leads'] });
          queryClient.invalidateQueries({ queryKey: ['insurance-leads'] });
          queryClient.invalidateQueries({ queryKey: ['healthcare-leads'] });
          return;
        }
      } catch (err) {
        console.warn('[handleDeleteAllLeads] RPC purge fallback to parallel engine:', err);
      }

      // ─── OPTIMIZATION 2: Ultra-Fast High-Concurrency Worker Engine ─────────
      // 1. Check if company_id column exists on active table
      let hasCompanyIdCol = true;
      if (targetCompanyId) {
        const { error: colTestErr } = await orgClient
          .from(activeTable as any)
          .select('id')
          .eq('company_id', targetCompanyId)
          .limit(1);

        if (colTestErr) {
          hasCompanyIdCol = false;
        }
      } else {
        hasCompanyIdCol = false;
      }

      // 2. Fetch estimated total first to populate UI
      let countQuery = orgClient.from(activeTable as any).select('id', { count: 'exact', head: true });
      if (hasCompanyIdCol && targetCompanyId) {
        countQuery = countQuery.eq('company_id', targetCompanyId);
      }
      const { count: totalLeadsCount } = await countQuery;
      const estimatedTotal = totalLeadsCount || 0;
      setDeleteProgress({ current: 0, total: estimatedTotal });

      // 3. Parallel Fast Scanner (10 parallel workers fetching 1,000 IDs each = 10,000 IDs per round)
      setDeleteStatus(`Fast scanning ${estimatedTotal.toLocaleString()} leads...`);
      let allIds: string[] = [];
      const FETCH_PAGE_SIZE = 1000;
      const PARALLEL_FETCH_WORKERS = 10;
      let pageOffset = 0;
      let keepScanning = true;

      while (keepScanning) {
        const fetchPromises = [];
        for (let w = 0; w < PARALLEL_FETCH_WORKERS; w++) {
          const pageIndex = pageOffset + w;
          let query = orgClient.from(activeTable as any).select('id');
          if (hasCompanyIdCol && targetCompanyId) {
            query = query.eq('company_id', targetCompanyId);
          }
          fetchPromises.push(query.range(pageIndex * FETCH_PAGE_SIZE, (pageIndex + 1) * FETCH_PAGE_SIZE - 1));
        }

        const pageResults = await Promise.all(fetchPromises);
        let batchFetchedCount = 0;

        for (const res of pageResults) {
          if (res.error) throw res.error;
          if (res.data && res.data.length > 0) {
            allIds.push(...res.data.map((item: any) => item.id));
            batchFetchedCount += res.data.length;
            if (res.data.length < FETCH_PAGE_SIZE) {
              keepScanning = false;
            }
          } else {
            keepScanning = false;
          }
        }

        pageOffset += PARALLEL_FETCH_WORKERS;
        setDeleteProgress({ current: 0, total: Math.max(estimatedTotal, allIds.length) });
        if (batchFetchedCount === 0) keepScanning = false;
      }

      if (allIds.length === 0) {
        toast.info('No leads found to delete.');
        setIsDeletingAll(false);
        return;
      }

      // 4. Ultra-Fast Parallel Deletion Engine
      // CHUNK_SIZE = 1,000 IDs per DELETE query (~15ms DB execution)
      // CONCURRENCY = 25 parallel workers = 25,000 leads deleted per iteration!
      setDeleteStatus(`Deleting ${allIds.length.toLocaleString()} leads ultra-fast...`);
      setDeleteProgress({ current: 0, total: allIds.length });

      const CHUNK_SIZE = 1000;
      const CONCURRENCY = 25;
      const chunks: string[][] = [];

      for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
        chunks.push(allIds.slice(i, i + CHUNK_SIZE));
      }

      let processedCount = 0;

      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const currentBatch = chunks.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          currentBatch.map(chunk =>
            orgClient
              .from(activeTable as any)
              .delete()
              .in('id', chunk)
          )
        );

        const failedResult = results.find(res => res.error);
        if (failedResult?.error) {
          throw failedResult.error;
        }

        const batchSize = currentBatch.reduce((sum, chunk) => sum + chunk.length, 0);
        processedCount += batchSize;
        setDeleteProgress({ current: Math.min(allIds.length, processedCount), total: allIds.length });
      }

      toast.success(`Successfully deleted all ${allIds.length.toLocaleString()} leads!`);

      // 5. Invalidate React Query caches
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['travel-leads'] });
      queryClient.invalidateQueries({ queryKey: ['real-estate-leads'] });
      queryClient.invalidateQueries({ queryKey: ['saas-leads'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-leads'] });
      queryClient.invalidateQueries({ queryKey: ['healthcare-leads'] });
    } catch (error: any) {
      console.error('Error deleting all leads:', error);
      toast.error('Failed to delete leads: ' + (error.message || 'Unknown error'));
    } finally {
      setIsDeletingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const hasAnyIdentifier = isPhoneUnique || isEmailUnique;
  const progressPercent = deleteProgress.total > 0 
    ? Math.min(100, Math.round((deleteProgress.current / deleteProgress.total) * 100))
    : 0;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Unique Identifier Selection */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            Unique Lead Identifier
          </CardTitle>
          <CardDescription>
            Choose which field(s) to use as unique identifiers. When a new lead is added (via CSV, form, or manually), if a lead with the same identifier already exists, they will be <strong>automatically merged</strong> — filling blank fields with new data to retain the most information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Phone Number Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${isPhoneUnique ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <Label className="text-base font-medium cursor-pointer">Phone Number</Label>
                <p className="text-sm text-muted-foreground">
                  Leads with the same phone number will be automatically merged
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isPhoneUnique && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
              <Switch
                checked={isPhoneUnique}
                onCheckedChange={() => handleToggle('phone', isPhoneUnique)}
                disabled={isToggling}
              />
            </div>
          </div>

          {/* Email Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${isEmailUnique ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <Label className="text-base font-medium cursor-pointer">Email Address</Label>
                <p className="text-sm text-muted-foreground">
                  Leads with the same email will be automatically merged
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isEmailUnique && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
              <Switch
                checked={isEmailUnique}
                onCheckedChange={() => handleToggle('email', isEmailUnique)}
                disabled={isToggling}
              />
            </div>
          </div>

          {isToggling && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating configuration and merging existing duplicates...
            </div>
          )}

          {/* Info Box */}
          <div className="flex gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>How Smart Merge works:</strong></p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>When a duplicate is detected, newer data overwrites older data</li>
                <li>If the new record has blank fields, existing values are preserved</li>
                <li>The most complete lead record is retained automatically</li>
                <li>Works for CSV uploads, form submissions, and manual lead entry</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Merge Existing Duplicates */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5 text-primary" />
            Merge Duplicate Leads
          </CardTitle>
          <CardDescription>
            Scan your existing leads for duplicates and merge them automatically. This uses your selected unique identifier(s) to find duplicates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasAnyIdentifier ? (
            <div className="flex gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <ShieldCheck className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">No unique identifier configured</p>
                <p className="text-muted-foreground">Please enable at least one unique identifier (Phone or Email) above before merging duplicates.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setShowMergeDialog(true)}
                  disabled={isMerging}
                  variant="outline"
                  className="gap-2"
                >
                  {isMerging ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Merging Duplicates...
                    </>
                  ) : (
                    <>
                      <Merge className="h-4 w-4" />
                      Merge Duplicate Leads
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground">
                  This will find and merge all leads with duplicate {isPhoneUnique && isEmailUnique ? 'phone numbers or emails' : isPhoneUnique ? 'phone numbers' : 'emails'}.
                </p>
              </div>

              {isMerging && progressMsg && (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0 text-blue-500" />
                  <span>{progressMsg}</span>
                </div>
              )}

              {!isMerging && mergeResult && (
                <div className="flex gap-3 p-4 rounded-xl border border-green-500/20 bg-green-500/5">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-green-700 dark:text-green-400">Merge Complete</p>
                    <p className="text-muted-foreground">
                      {mergeResult.merged_groups > 0
                        ? `Merged ${mergeResult.merged_groups} duplicate group(s), removed ${mergeResult.deleted_records} duplicate record(s).`
                        : 'No duplicates found — your leads are clean!'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone: Delete All Leads */}
      <Card className="border-red-500/30 glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete All Leads
          </CardTitle>
          <CardDescription>
            Bulk delete all leads belonging to your company account using direct database RPC purge or high-speed 25-worker parallel engine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeletingAll}
              variant="destructive"
              className="gap-2"
            >
              {isDeletingAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting Leads...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Delete All Leads Ultra-Fast
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              Permanently purge all leads in your database.
            </p>
          </div>

          {/* Progress Display */}
          {isDeletingAll && (
            <div className="space-y-2.5 p-4 rounded-xl border border-red-500/30 bg-red-500/10">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0 text-red-500" />
                  {deleteStatus}
                </span>
                <span className="text-sm font-mono font-semibold text-red-600 dark:text-red-400">
                  {deleteProgress.current.toLocaleString()} / {deleteProgress.total.toLocaleString()} ({progressPercent}%)
                </span>
              </div>
              <div className="w-full h-3 bg-red-950/40 rounded-full overflow-hidden border border-red-500/30">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-150 ease-out rounded-full shadow-lg"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Merge Confirmation Dialog */}
      <AlertDialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge Duplicate Leads</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will scan all your leads and merge duplicates based on: <strong>{[isPhoneUnique && 'Phone Number', isEmailUnique && 'Email Address'].filter(Boolean).join(' and ')}</strong>.
                </p>
                <p>
                  For each group of duplicates:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>The <strong>newest lead</strong> is kept as the primary record</li>
                  <li>Data from older leads fills in any <strong>blank fields</strong></li>
                  <li>Older duplicate records are <strong>permanently deleted</strong></li>
                </ul>
                <p className="text-amber-600 dark:text-amber-400">
                  ⚠️ This action cannot be undone. Are you sure?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMerge}>
              Yes, Merge Duplicates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Leads Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Permanently Delete All Leads?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to <strong>permanently delete ALL leads</strong> in your company account.
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>All lead records, contact info, and custom field values will be purged.</li>
                  <li>Associated activities, call logs, and tasks will be removed.</li>
                  <li>High-speed server RPC / 25-worker parallel engine purges up to 25,000 leads per round with live progress.</li>
                </ul>
                <p className="text-red-600 dark:text-red-400 font-semibold">
                  ⚠️ This action CANNOT be undone. Are you absolutely sure?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllLeads}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Yes, Delete All Leads
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
