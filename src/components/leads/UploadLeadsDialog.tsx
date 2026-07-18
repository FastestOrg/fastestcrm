import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useLeadsTable } from '@/hooks/useLeadsTable';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileUp, Download, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { Progress } from '@/components/ui/progress';
import { useQueryClient } from '@tanstack/react-query';
import { useCustomColumns } from '@/hooks/useCustomColumns';

const BATCH_SIZE = 100; // Process 100 leads at a time

interface UploadProgress {
    total: number;
    processed: number;
    success: number;
    duplicates: number;
    errors: number;
}

export function UploadLeadsDialog() {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<UploadProgress | null>(null);
    const { user } = useAuth();
    const { company } = useCompany();
    const { tableName } = useLeadsTable();
    const { statuses } = useLeadStatuses();
    const queryClient = useQueryClient();
    const abortRef = useRef(false);
    const { customColumns } = useCustomColumns();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setProgress(null);
        }
    };

    const handleDownloadFormat = () => {
        let headers = ['Name', 'Email', 'Phone', 'College', 'Status', 'Lead Source', 'Lead Owner'];
        let row1 = ['John Doe', 'john@example.com', '9876543210', 'Example University', 'new', 'Website', 'Jane Smith'];
        let row2 = ['Jane Smith', 'jane@test.com', '9123456780', 'Tech Institute', 'interested', 'Referral', 'John Doe'];

        if (customColumns && customColumns.length > 0) {
            customColumns.forEach(col => {
                headers.push(col.label);
                row1.push('');
                row2.push('');
            });
        }

        const csvContent = [
            headers.join(','),
            row1.join(','),
            row2.join(',')
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'CRM Data Upload.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const insertLeadWithRetry = async (lead: any): Promise<'success' | 'duplicate' | 'error'> => {
        try {
            const { error } = await supabase
                .from(tableName as any)
                .insert(lead);

            if (error) {
                // Check for duplicate/unique constraint violations
                if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate') || error.message?.toLowerCase().includes('unique')) {
                    return 'duplicate';
                }
                console.error('Insert error:', error);
                return 'error';
            }
            return 'success';
        } catch (err) {
            console.error('Insert exception:', err);
            return 'error';
        }
    };

    const processBatch = async (
        leads: any[],
        currentProgress: UploadProgress
    ): Promise<UploadProgress> => {
        try {
            const { error } = await supabase
                .from(tableName as any)
                .insert(leads);

            if (error) {
                // Check if it's a unique constraint violation, if so fallback to individual inserts
                if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate') || error.message?.toLowerCase().includes('unique')) {
                    console.log('Duplicate key found in bulk insert. Falling back to individual inserts for this batch.');
                    const results = await Promise.all(leads.map(lead => insertLeadWithRetry(lead)));
                    return {
                        ...currentProgress,
                        processed: currentProgress.processed + leads.length,
                        success: currentProgress.success + results.filter(r === 'success').length,
                        duplicates: currentProgress.duplicates + results.filter(r === 'duplicate').length,
                        errors: currentProgress.errors + results.filter(r === 'error').length,
                    };
                }
                
                console.error('Bulk insert database error:', error);
                return {
                    ...currentProgress,
                    processed: currentProgress.processed + leads.length,
                    errors: currentProgress.errors + leads.length,
                };
            }

            return {
                ...currentProgress,
                processed: currentProgress.processed + leads.length,
                success: currentProgress.success + leads.length,
            };
        } catch (err) {
            console.error('Bulk insert exception:', err);
            return {
                ...currentProgress,
                processed: currentProgress.processed + leads.length,
                errors: currentProgress.errors + leads.length,
            };
        }
    };


    const handleUpload = async () => {
        if (!file || !user || !company) {
            if (!company) toast.error("Company information missing");
            return;
        }

        setUploading(true);
        abortRef.current = false;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const leads = results.data.map((row: any) => {
                        const status = row.Status || row.status || 'new';
                        const validStatus = statuses.some(s => s.value === status.toLowerCase())
                            ? status.toLowerCase()
                            : 'new';

                        const leadObj: any = {
                            name: row.Name || row.name || 'Unknown',
                            email: row.Email || row.email || null,
                            phone: row.Phone || row.phone || null,
                            college: row.College || row.college || null,
                            lead_source: row['Lead Source'] || row['lead source'] || row.lead_source || null,
                            status: validStatus,
                            created_by_id: user.id,
                            sales_owner_id: user.id,
                            company_id: company.id,
                            _lead_owner_name: row['Lead Owner'] || row.lead_owner || null,
                        };

                        // Dynamically map custom columns from CSV row
                        if (customColumns && customColumns.length > 0) {
                            customColumns.forEach(col => {
                                const rowKey = Object.keys(row).find(key => 
                                    key.toLowerCase().trim() === col.label.toLowerCase().trim() ||
                                    key.toLowerCase().trim() === col.id.toLowerCase().trim()
                                );
                                if (rowKey) {
                                    leadObj[col.id] = row[rowKey] || null;
                                }
                            });
                        }

                        return leadObj;
                    }).filter((lead: any) => lead.phone);

                    if (leads.length === 0) {
                        toast.error('No valid leads found in CSV. Phone Number is mandatory.');
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

                        // NOTE: If this schema also has pre_sales_owner_id / post_sales_owner_id, we would map them here. 
                        // Right now generic leads mostly rely on sales_owner_id. Let's map it safely.
                        return {
                            ...rest,
                            sales_owner_id: ownerId,
                        };
                    });

                    let currentProgress: UploadProgress = {
                        total: enrichedLeads.length,
                        processed: 0,
                        success: 0,
                        duplicates: 0,
                        errors: 0,
                    };
                    setProgress(currentProgress);

                    // Process in batches
                    for (let i = 0; i < enrichedLeads.length; i += BATCH_SIZE) {
                        if (abortRef.current) {
                            toast.info('Upload cancelled');
                            break;
                        }

                        const batch = enrichedLeads.slice(i, i + BATCH_SIZE);
                        currentProgress = await processBatch(batch, currentProgress);
                        setProgress({ ...currentProgress });
                    }

                    // Invalidate queries to refresh the leads list
                    queryClient.invalidateQueries({ queryKey: ['leads'] });

                    // Show final summary
                    if (currentProgress.success > 0) {
                        toast.success(
                            `Uploaded ${currentProgress.success} leads successfully` +
                            (currentProgress.duplicates > 0 ? `, ${currentProgress.duplicates} duplicates skipped` : '') +
                            (currentProgress.errors > 0 ? `, ${currentProgress.errors} failed` : '')
                        );
                    } else if (currentProgress.duplicates > 0) {
                        toast.warning(`All ${currentProgress.duplicates} leads were duplicates`);
                    } else {
                        toast.error('Failed to upload leads');
                    }

                    if (!abortRef.current && currentProgress.errors === 0) {
                        setOpen(false);
                        setFile(null);
                        setProgress(null);
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    toast.error('Failed to process CSV file');
                } finally {
                    setUploading(false);
                }
            },
            error: (error) => {
                console.error('CSV Parse error:', error);
                toast.error('Failed to parse CSV file');
                setUploading(false);
            }
        });
    };

    const handleCancel = () => {
        abortRef.current = true;
    };

    const progressPercent = progress ? Math.round((progress.processed / progress.total) * 100) : 0;

    return (
        <Dialog open={open} onOpenChange={(newOpen) => {
            if (!uploading) {
                setOpen(newOpen);
                if (!newOpen) {
                    setFile(null);
                    setProgress(null);
                }
            }
        }}>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleDownloadFormat}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Format
                </Button>
                <DialogTrigger asChild>
                    <Button variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload CSV
                    </Button>
                </DialogTrigger>
            </div>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Upload Leads CSV</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file with columns: Name, Email, Phone, College, Status, Lead Source. Phone is mandatory. Duplicates will be skipped.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center gap-4">
                        <Input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="cursor-pointer"
                            disabled={uploading}
                        />
                    </div>
                    {file && !uploading && (
                        <div className="text-sm text-muted-foreground">
                            Selected: {file.name}
                        </div>
                    )}

                    {progress && (
                        <div className="space-y-3">
                            <Progress value={progressPercent} className="h-2" />
                            <div className="text-sm space-y-1">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Processing...</span>
                                    <span>{progress.processed} / {progress.total}</span>
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs">
                                    <span className="flex items-center gap-1 text-green-600">
                                        <CheckCircle className="h-3 w-3" />
                                        {progress.success} uploaded
                                    </span>
                                    {progress.duplicates > 0 && (
                                        <span className="flex items-center gap-1 text-yellow-600">
                                            <AlertCircle className="h-3 w-3" />
                                            {progress.duplicates} duplicates
                                        </span>
                                    )}
                                    {progress.errors > 0 && (
                                        <span className="flex items-center gap-1 text-red-600">
                                            <AlertCircle className="h-3 w-3" />
                                            {progress.errors} errors
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2">
                        {uploading ? (
                            <Button onClick={handleCancel} variant="destructive" className="w-full">
                                Cancel Upload
                            </Button>
                        ) : (
                            <Button onClick={handleUpload} disabled={!file} className="w-full">
                                <FileUp className="mr-2 h-4 w-4" />
                                Upload Leads
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
