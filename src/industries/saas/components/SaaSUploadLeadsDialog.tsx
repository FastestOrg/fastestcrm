import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileUp, Download, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { Progress } from '@/components/ui/progress';
import { useQueryClient } from '@tanstack/react-query';
import { SAAS_STATUSES, PLAN_TYPES, COMPANY_SIZES } from '../config';

const BATCH_SIZE = 100;

interface UploadProgress {
  total: number;
  processed: number;
  success: number;
  duplicates: number;
  errors: number;
}

export function SaaSUploadLeadsDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const { user } = useAuth();
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const abortRef = useRef(false);

  const insertLeadWithRetry = async (lead: any): Promise<'success' | 'duplicate' | 'error'> => {
    try {
      const { error } = await supabase.from('leads_saas' as any).insert(lead);
      if (error) {
        if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate') || error.message?.toLowerCase().includes('unique')) {
          return 'duplicate';
        }
        return 'error';
      }
      return 'success';
    } catch {
      return 'error';
    }
  };

  const processBatch = async (leads: any[], currentProgress: UploadProgress): Promise<UploadProgress> => {
    try {
      const { error } = await supabase.from('leads_saas' as any).insert(leads);
      if (error) {
        // Fallback to individual if unique constraint or similar error
        if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate') || error.message?.toLowerCase().includes('unique')) {
          const results = await Promise.all(leads.map(lead => insertLeadWithRetry(lead)));
          return {
            ...currentProgress,
            processed: currentProgress.processed + leads.length,
            success: currentProgress.success + results.filter(r => r === 'success').length,
            duplicates: currentProgress.duplicates + results.filter(r => r === 'duplicate').length,
            errors: currentProgress.errors + results.filter(r => r === 'error').length,
          };
        }
        // If it's a completely different error, mark all as errors
        return {
          ...currentProgress,
          processed: currentProgress.processed + leads.length,
          errors: currentProgress.errors + leads.length,
        };
      }
      // If bulk insert is fully successful
      return {
        ...currentProgress,
        processed: currentProgress.processed + leads.length,
        success: currentProgress.success + leads.length,
      };
    } catch (err) {
      // Complete fallback
      const results = await Promise.all(leads.map(lead => insertLeadWithRetry(lead)));
      return {
        ...currentProgress,
        processed: currentProgress.processed + leads.length,
        success: currentProgress.success + results.filter(r => r === 'success').length,
        duplicates: currentProgress.duplicates + results.filter(r => r === 'duplicate').length,
        errors: currentProgress.errors + results.filter(r => r === 'error').length,
      };
    }
  };

  const handleDownloadFormat = () => {
    const csvContent =
      'Name,Email,Phone,WhatsApp,Company Name,Company Size,Company Website,Job Title,Product Interest,Plan Type,Seats,MRR,Deal Stage,Current Solution,Status,Lead Source,Lead Owner\n' +
      'John Doe,john@acme.com,9876543210,9876543210,Acme Corp,51-200,https://acme.com,CTO,Enterprise Plan,Professional,25,50000,demo,Competitor X,new,Website,Jane Smith\n' +
      'Jane Smith,jane@startup.io,9123456780,,StartupIO,11-50,https://startup.io,VP Engineering,Starter,Starter,5,15000,discovery,,mql,LinkedIn,John Doe';

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SaaS Leads Upload Format.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const parseNumericValue = (value: string | undefined): number | null => {
    if (!value) return null;
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const handleUpload = async () => {
    if (!file || !user || !company) return;

    setUploading(true);
    abortRef.current = false;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const validStatuses = SAAS_STATUSES.map(s => s.value);

          const leads = results.data.map((row: any) => {
            const status = row.Status || row.status || 'new';
            const validStatus = validStatuses.includes(status.toLowerCase()) ? status.toLowerCase() : 'new';

            const mrr = parseNumericValue(row.MRR || row.mrr || row.monthly_value);

            return {
              name: row.Name || row.name || 'Unknown',
              email: row.Email || row.email || null,
              phone: row.Phone || row.phone || null,
              whatsapp: row.WhatsApp || row.whatsapp || null,
              company_name: row['Company Name'] || row.company_name || null,
              company_size: row['Company Size'] || row.company_size || null,
              company_website: row['Company Website'] || row.company_website || null,
              job_title: row['Job Title'] || row.job_title || null,
              product_interest: row['Product Interest'] || row.product_interest || null,
              plan_type: row['Plan Type'] || row.plan_type || null,
              seats: parseNumericValue(row.Seats || row.seats) ? Math.round(parseNumericValue(row.Seats || row.seats)!) : null,
              monthly_value: mrr,
              annual_value: mrr ? mrr * 12 : null,
              deal_stage: row['Deal Stage'] || row.deal_stage || null,
              current_solution: row['Current Solution'] || row.current_solution || null,
              lead_source: row['Lead Source'] || row.lead_source || null,
              status: validStatus,
              created_by_id: user.id,
              pre_sales_owner_id: user.id, // Will be overridden if mapping exists
              sales_owner_id: user.id, // Will be overridden if mapping exists
              company_id: company.id,
              _lead_owner_name: row['Lead Owner'] || row.lead_owner || null,
            };
          }).filter((lead: any) => lead.phone || lead.email);

          if (leads.length === 0) {
            toast.error('No valid leads found. Phone or Email required.');
            setUploading(false);
            return;
          }

          // Fetch user profiles to map Lead Owner names to IDs
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('company_id', company.id);

          const profileMap = new Map<string, string>();
          if (profilesData) {
            profilesData.forEach(p => {
              if (p.full_name) {
                profileMap.set(p.full_name.toLowerCase().trim(), p.id);
              }
            });
          }

          const enrichedLeads = leads.map((lead: any) => {
            const { _lead_owner_name, ...rest } = lead;
            let ownerId = user.id;

            if (_lead_owner_name) {
              const foundId = profileMap.get(_lead_owner_name.toLowerCase().trim());
              if (foundId) {
                ownerId = foundId;
              } else {
                console.warn(`Could not find user with name "${_lead_owner_name}". Defaulting to current user.`);
              }
            }

            return {
              ...rest,
              pre_sales_owner_id: ownerId,
              sales_owner_id: ownerId,
            };
          });

          let currentProgress: UploadProgress = { total: enrichedLeads.length, processed: 0, success: 0, duplicates: 0, errors: 0 };
          setProgress(currentProgress);

          for (let i = 0; i < enrichedLeads.length; i += BATCH_SIZE) {
            if (abortRef.current) break;
            const batch = enrichedLeads.slice(i, i + BATCH_SIZE);
            currentProgress = await processBatch(batch, currentProgress);
            setProgress({ ...currentProgress });
          }

          queryClient.invalidateQueries({ queryKey: ['saas-leads'] });
          toast.success(`Upload complete: ${currentProgress.success} added, ${currentProgress.duplicates} duplicates, ${currentProgress.errors} errors`);
        } catch (error) {
          console.error('Upload error:', error);
          toast.error('Upload failed');
        } finally {
          setUploading(false);
        }
      },
      error: () => {
        toast.error('Failed to parse CSV');
        setUploading(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" /> Upload CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload SaaS Leads</DialogTitle>
          <DialogDescription>Upload a CSV file with your SaaS prospect data.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={handleDownloadFormat} className="w-full">
            <Download className="h-4 w-4 mr-2" /> Download CSV Template
          </Button>

          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <Input type="file" accept=".csv" onChange={(e) => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setProgress(null); } }} className="mt-2" />
            {file && <p className="text-sm text-muted-foreground mt-2">{file.name}</p>}
          </div>

          {progress && (
            <div className="space-y-2">
              <Progress value={(progress.processed / progress.total) * 100} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.processed}/{progress.total} processed</span>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" />{progress.success}</span>
                  <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-yellow-500" />{progress.duplicates} dup</span>
                  <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-red-500" />{progress.errors} err</span>
                </span>
              </div>
            </div>
          )}

          <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
            {uploading ? 'Uploading...' : 'Upload Leads'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
