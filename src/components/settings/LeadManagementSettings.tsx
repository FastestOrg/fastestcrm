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
import { Loader2, Fingerprint, Merge, Phone, Mail, ShieldCheck, Info, CheckCircle2 } from 'lucide-react';

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
  } = useLeadDedup();

  const [showMergeDialog, setShowMergeDialog] = useState(false);

  const handleToggle = (attribute: string, currentValue: boolean) => {
    toggleUniqueIdentifier({ attribute, enabled: !currentValue });
  };

  const handleMerge = () => {
    mergeDuplicates();
    setShowMergeDialog(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const hasAnyIdentifier = isPhoneUnique || isEmailUnique;

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
                      <Loader2 className="h-4 w-4 animate-spin" />
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

              {mergeResult && (
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
    </div>
  );
}
