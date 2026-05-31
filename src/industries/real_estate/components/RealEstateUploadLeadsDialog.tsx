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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileUp, Download, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { Progress } from '@/components/ui/progress';
import { useQueryClient } from '@tanstack/react-query';
import { REAL_ESTATE_STATUSES, REAL_ESTATE_PROPERTY_TYPES, REAL_ESTATE_PURPOSES } from '../config';

const BATCH_SIZE = 100;

interface UploadProgress {
    total: number;
    processed: number;
    success: number;
    duplicates: number;
    errors: number;
}

export function RealEstateUploadLeadsDialog() {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<UploadProgress | null>(null);
    const { user } = useAuth();
    const { company } = useCompany();
    const queryClient = useQueryClient();
    const abortRef = useRef(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setProgress(null);
        }
    };

    const handleDownloadFormat = () => {
        const csvContent =
            'Name,Email,Phone,WhatsApp,Property Type,Budget Min,Budget Max,Preferred Location,Property Size,Purpose,Possession Timeline,Broker Name,Property Name,Unit Number,Status,Lead Source,Lead Owner\n' +
            'John Doe,john@example.com,9876543210,9876543210,Apartment/Flat,5000000,8000000,Mumbai,1200 sq ft,buy,3-6 months,Agent Name,Green Valley,A-101,new,Website,Jane Smith\n' +
            'Jane Smith,jane@test.com,9123456780,9123456780,Villa,10000000,15000000,Pune,2500 sq ft,invest,Ready to move,,Sunrise Heights,,contacted,Referral,John Doe';

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Real Estate Leads Upload Format.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const insertLeadWithRetry = async (lead: any): Promise<'success' | 'duplicate' | 'error'> => {
        try {
            const { error } = await supabase
                .from('leads_real_estate')
                .insert(lead);

            if (error) {
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
                .from('leads_real_estate')
                .insert(leads);

            if (error) {
                // Check if it's a unique constraint violation, if so fallback to individual inserts
                if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate') || error.message?.toLowerCase().includes('unique')) {
                    console.log('Duplicate key found in bulk insert. Falling back to individual inserts for this batch.');
                    const results = await Promise.all(leads.map(lead => insertLeadWithRetry(lead)));
                    return {
                        ...currentProgress,
                        processed: currentProgress.processed + leads.length,
                        success: currentProgress.success + results.filter(r => r === 'success').length,
                        duplicates: currentProgress.duplicates + results.filter(r => r === 'duplicate').length,
                        errors: currentProgress.errors + results.filter(r => r === 'error').length,
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


    const parseNumericValue = (value: string | undefined): number | null => {
        if (!value) return null;
        const cleaned = value.replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
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
                    const validStatuses = REAL_ESTATE_STATUSES.map(s => s.value);
                    const validPropertyTypes = REAL_ESTATE_PROPERTY_TYPES;
                    const validPurposes = REAL_ESTATE_PURPOSES.map(p => p.value);

                    const leads = results.data.map((row: any) => {
                        const status = row.Status || row.status || 'new';
                        const validStatus = validStatuses.includes(status.toLowerCase())
                            ? status.toLowerCase()
                            : 'new';

                        const propertyType = row['Property Type'] || row.property_type || null;
                        const validPropertyType = propertyType && validPropertyTypes.includes(propertyType)
                            ? propertyType
                            : null;

                        const purpose = row.Purpose || row.purpose || null;
                        const validPurpose = purpose && validPurposes.includes(purpose.toLowerCase())
                            ? purpose.toLowerCase()
                            : null;

                        return {
                            name: row.Name || row.name || 'Unknown',
                            email: row.Email || row.email || null,
                            phone: row.Phone || row.phone || null,
                            whatsapp: row.WhatsApp || row.whatsapp || row.Whatsapp || null,
                            property_type: validPropertyType,
                            budget_min: parseNumericValue(row['Budget Min'] || row.budget_min),
                            budget_max: parseNumericValue(row['Budget Max'] || row.budget_max),
                            preferred_location: row['Preferred Location'] || row.preferred_location || null,
                            property_size: row['Property Size'] || row.property_size || null,
                            purpose: validPurpose,
                            possession_timeline: row['Possession Timeline'] || row.possession_timeline || null,
                            broker_name: row['Broker Name'] || row.broker_name || null,
                            property_name: row['Property Name'] || row.property_name || null,
                            unit_number: row['Unit Number'] || row.unit_number || null,
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
                        toast.error('No valid leads found in CSV. Phone or Email is required.');
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

                    let currentProgress: UploadProgress = {
                        total: enrichedLeads.length,
                        processed: 0,
                        success: 0,
                        duplicates: 0,
                        errors: 0,
                    };
                    setProgress(currentProgress);

                    for (let i = 0; i < enrichedLeads.length; i += BATCH_SIZE) {
                        if (abortRef.current) {
                            toast.info('Upload cancelled');
                            break;
                        }

                        const batch = enrichedLeads.slice(i, i + BATCH_SIZE);
                        currentProgress = await processBatch(batch, currentProgress);
                        setProgress({ ...currentProgress });
                    }

                    queryClient.invalidateQueries({ queryKey: ['real-estate-leads'] });

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
                <Button variant="outline" size="sm" onClick={handleDownloadFormat}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Format
                </Button>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload CSV
                    </Button>
                </DialogTrigger>
            </div>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Upload Real Estate Leads CSV</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file with real estate lead data. Phone or Email is required. Duplicates will be skipped automatically.
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
