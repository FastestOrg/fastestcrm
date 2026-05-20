import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileUp, Download, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { Progress } from '@/components/ui/progress';
import { useQueryClient } from '@tanstack/react-query';
import { TRAVEL_STATUSES } from '../config';

const BATCH_SIZE = 100;

export function TravelUploadLeadsDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ total: number; processed: number; success: number; duplicates: number; errors: number } | null>(null);
  const { user } = useAuth();
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const abortRef = useRef(false);

  const handleDownloadFormat = () => {
    const csv = 'Name,Email,Phone,WhatsApp,Destination,Travel Date,Return Date,Travelers,Trip Type,Package Type,Budget,Hotel,Special Requests,Status,Lead Source,Lead Owner\n' +
      'John Doe,john@email.com,9876543210,9876543210,Goa,2026-04-15,2026-04-20,2,Family,Premium,75000,Taj Hotel,Sea-facing room,new,Website,Jane Smith\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Travel Leads Upload Format.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const parseNum = (v: string | undefined): number | null => {
    if (!v) return null;
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? null : n;
  };

  const handleUpload = async () => {
    if (!file || !user || !company) return;
    setUploading(true); abortRef.current = false;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        try {
          const validStatuses = TRAVEL_STATUSES.map(s => s.value);
          const leads = results.data.map((row: any) => {
            const status = row.Status || row.status || 'new';
            return {
              name: row.Name || row.name || 'Unknown',
              email: row.Email || row.email || null,
              phone: row.Phone || row.phone || null,
              whatsapp: row.WhatsApp || row.whatsapp || null,
              destination: row.Destination || row.destination || null,
              travel_date: row['Travel Date'] || row.travel_date || null,
              return_date: row['Return Date'] || row.return_date || null,
              travelers_count: parseNum(row.Travelers || row.travelers_count) ? Math.round(parseNum(row.Travelers || row.travelers_count)!) : null,
              trip_type: row['Trip Type'] || row.trip_type || null,
              package_type: row['Package Type'] || row.package_type || null,
              budget: parseNum(row.Budget || row.budget),
              hotel_name: row.Hotel || row.hotel_name || null,
              special_requests: row['Special Requests'] || row.special_requests || null,
              lead_source: row['Lead Source'] || row.lead_source || null,
              status: validStatuses.includes(status.toLowerCase()) ? status.toLowerCase() : 'new',
              created_by_id: user.id, 
              pre_sales_owner_id: user.id, // Will be overridden if mapping exists
              sales_owner_id: user.id, // Will be overridden if mapping exists
              company_id: company.id,
              _lead_owner_name: row['Lead Owner'] || row.lead_owner || null,
            };
          }).filter((l: any) => l.phone || l.email);

          if (leads.length === 0) { toast.error('No valid leads found.'); setUploading(false); return; }

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

          let cp = { total: enrichedLeads.length, processed: 0, success: 0, duplicates: 0, errors: 0 };
          setProgress(cp);

          for (let i = 0; i < enrichedLeads.length; i += BATCH_SIZE) {
            if (abortRef.current) break;
            const batch = enrichedLeads.slice(i, i + BATCH_SIZE);

            try {
              // Try bulk insert first
              const { error } = await supabase.from('leads_travel' as any).insert(batch);

              if (error && error.code === '23505') {
                // Fallback to individual inserts if unique constraint (duplicate) error occurs
                const results = await Promise.all(batch.map(async (lead: any) => {
                  try {
                    const { error: indError } = await supabase.from('leads_travel' as any).insert(lead);
                    if (indError) return indError.code === '23505' ? 'duplicate' : 'error';
                    return 'success';
                  } catch { return 'error'; }
                }));
                cp = { ...cp, processed: cp.processed + batch.length, success: cp.success + results.filter(r => r === 'success').length, duplicates: cp.duplicates + results.filter(r => r === 'duplicate').length, errors: cp.errors + results.filter(r => r === 'error').length };
              } else if (error) {
                // Other bulk error
                cp = { ...cp, processed: cp.processed + batch.length, errors: cp.errors + batch.length };
              } else {
                // Bulk success
                cp = { ...cp, processed: cp.processed + batch.length, success: cp.success + batch.length };
              }
            } catch {
              // Network or other catastrophic error
              cp = { ...cp, processed: cp.processed + batch.length, errors: cp.errors + batch.length };
            }

            setProgress({ ...cp });
          }
          queryClient.invalidateQueries({ queryKey: ['travel-leads'] });
          toast.success(`Upload complete: ${cp.success} added, ${cp.duplicates} duplicates, ${cp.errors} errors`);
        } catch { toast.error('Upload failed'); } finally { setUploading(false); }
      },
      error: () => { toast.error('Failed to parse CSV'); setUploading(false); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Upload className="h-4 w-4 mr-2" /> Upload CSV</Button></DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader><DialogTitle>Upload Travel Leads</DialogTitle><DialogDescription>Upload a CSV file with your travel lead data.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={handleDownloadFormat} className="w-full"><Download className="h-4 w-4 mr-2" /> Download CSV Template</Button>
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
          <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">{uploading ? 'Uploading...' : 'Upload Leads'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
