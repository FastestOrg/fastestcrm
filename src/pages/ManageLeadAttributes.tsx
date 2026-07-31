import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/hooks/useCompany';
import { useOrgClient } from '@/hooks/useOrgClient';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Lock, Unlock, AlertTriangle, ShieldCheck, Check, Fingerprint, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ColumnDef {
    column_name: string;
    data_type: string;
    is_nullable: string;
}

export default function ManageLeadAttributes() {
    const navigate = useNavigate();
    const { company, loading: companyLoading, refetch: refetchCompany } = useCompany();
    const { user } = useAuth();
    const [unlocking, setUnlocking] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newAttributeName, setNewAttributeName] = useState('');
    const [addingAttribute, setAddingAttribute] = useState(false);

    // Requirement: Company Admin only
    const isCompanyAdmin = company?.admin_id === user?.id;

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
        enabled: !!company?.id
    });

    const isUnlocked = !!company?.custom_leads_table;

    // Fetch unique constraints
    const { data: uniqueConstraints, refetch: refetchConstraints, isLoading: constraintsLoading } = useQuery({
        queryKey: ['lead-unique-constraints', company?.id],
        queryFn: async () => {
            if (!company?.id || !isUnlocked) return [];
            const { data, error } = await supabase.rpc('get_lead_unique_constraints' as any, {
                input_company_id: company.id
            });
            if (error) {
                console.error('Error fetching constraints:', error);
                return [];
            }
            return (data as any) as string[];
        },
        enabled: !!company?.id && isUnlocked
    });

    // Fetch dynamic columns
    const { orgClient, isBYOSLoading } = useOrgClient();
    const { data: dbColumns, refetch: refetchColumns, isLoading: columnsLoading } = useQuery({
        queryKey: ['lead-columns', (orgClient as any)?.supabaseUrl || 'default', company?.id, company?.custom_leads_table],
        queryFn: async () => {
            if (!company?.id) return [];
            try {
                // Primary: Fetch schema columns directly from PostgreSQL via get_company_lead_columns RPC
                let { data: rpcData, error: rpcError } = await (orgClient as any).rpc('get_company_lead_columns', {
                    input_company_id: company.id
                });

                // Fallback to main Supabase client if orgClient (BYOS) fails or misses the function
                if ((rpcError || !rpcData || !Array.isArray(rpcData) || rpcData.length === 0) && orgClient !== supabase) {
                    const mainRes = await supabase.rpc('get_company_lead_columns' as any, {
                        input_company_id: company.id
                    });
                    if (!mainRes.error && mainRes.data && Array.isArray(mainRes.data) && mainRes.data.length > 0) {
                        rpcData = mainRes.data;
                        rpcError = null;
                    }
                }

                if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
                    return rpcData as ColumnDef[];
                }

                // Fallback: Query target custom_leads_table or 'leads' if RPC yields no results
                const targetTable = company.custom_leads_table || 'leads';
                const { data, error } = await orgClient
                    .from(targetTable as any)
                    .select('*')
                    .limit(5);

                if (!error && data && data.length > 0) {
                    const keysSet = new Set<string>();
                    data.forEach((row: any) => {
                        Object.keys(row).forEach((k) => keysSet.add(k));
                        if (row.custom_data && typeof row.custom_data === 'object') {
                            Object.keys(row.custom_data).forEach((ck) => keysSet.add(ck));
                        }
                    });

                    return Array.from(keysSet).map((k) => ({
                        column_name: k,
                        data_type: 'text',
                        is_nullable: 'YES'
                    })) as ColumnDef[];
                }

                return [];
            } catch (e) {
                console.error('Error fetching lead columns:', e);
                return [];
            }
        },
        enabled: !!company?.id && !isBYOSLoading
    });

    // System columns we want to hide or show specifically
    const hiddenColumns = ['id', 'company_id', 'created_by_id', 'pre_sales_owner_id', 'sales_owner_id', 'post_sales_owner_id', 'embedding'];
    const systemColumns = [
        'id', 'created_at', 'updated_at', 'company_id', 'created_by_id', 'name', 'email', 'phone', 
        'status', 'sales_owner_id', 'pre_sales_owner_id', 'post_sales_owner_id', 'notes', 'lead_source', 
        'next_follow_up', 'lead_score', 'custom_data', 'archived', 'payment_link', 'whatsapp', 'college', 
        'graduating_year', 'branch', 'domain', 'cgpa', 'state', 'preferred_language', 'company', 'ca_name', 
        'revenue_received', 'revenue_projected', 'total_recovered', 'product_purchased', 'batch_month'
    ];

    const handleUnlock = async () => {
        if (!company) return;

        const PRICE = 100000;
        const balance = wallet?.balance || 0;

        if (balance < PRICE) {
            toast.error(`Insufficient wallet balance. Required: ₹${PRICE.toLocaleString()}. Available: ₹${balance.toLocaleString()}`);
            if (confirm("You don't have enough credits. Go to dashboard to add money?")) {
                navigate('/dashboard/company');
            }
            return;
        }

        if (!confirm(`Unlock Custom Attributes for ₹${PRICE.toLocaleString()}?`)) return;

        setUnlocking(true);
        try {
            const { data, error } = await supabase.functions.invoke('unlock-lead-attributes');

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast.success('Attributes unlocked! Leads migrated.');
            await refetchCompany();
        } catch (error: any) {
            toast.error('Failed: ' + (error.message || 'Unknown error'));
        } finally {
            setUnlocking(false);
        }
    };

    const handleToggleUnique = async (attribute: string, currentValue: boolean) => {
        try {
            const { data, error } = await supabase.rpc('toggle_lead_unique_constraint' as any, {
                input_company_id: company?.id,
                attribute_name: attribute,
                is_unique: !currentValue
            });
            if (error) throw error;
            const res = data as any;
            if (!res.success) throw new Error(res.message);

            toast.success(res.message);
            refetchConstraints();
        } catch (error: any) {
            toast.error('Failed: ' + error.message);
        }
    };

    const handleAddAttribute = async () => {
        if (!newAttributeName.trim()) return;
        // Basic validation: alphanumeric + underscore, lowercase
        const formattedName = newAttributeName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

        setAddingAttribute(true);
        try {
            const { data, error } = await supabase.rpc('add_lead_attribute' as any, {
                input_company_id: company?.id,
                attribute_name: formattedName,
                attribute_type: 'text' // Default to text for now
            });

            if (error) throw error;
            const res = data as any;
            if (!res.success) throw new Error(res.message);

            toast.success(`Attribute '${formattedName}' added successfully`);
            setNewAttributeName('');
            setIsAddDialogOpen(false);
            refetchColumns();
        } catch (error: any) {
            toast.error('Failed to add attribute: ' + error.message);
        } finally {
            setAddingAttribute(false);
        }
    };

    const handleDeleteAttribute = async (attributeName: string) => {
        if (!confirm(`Are you sure you want to delete '${attributeName}'? ALL DATA in this column will be lost forever.`)) return;

        try {
            const { data, error } = await supabase.rpc('remove_lead_attribute' as any, {
                input_company_id: company?.id,
                attribute_name: attributeName
            });

            if (error) throw error;
            const res = data as any;
            if (!res.success) throw new Error(res.message);

            toast.success(`Attribute '${attributeName}' removed`);
            refetchColumns();
            refetchConstraints(); // Might have removed a unique constraint
        } catch (error: any) {
            toast.error('Failed to remove attribute: ' + error.message);
        }
    };

    if (companyLoading) return <div><Loader2 className="animate-spin" /></div>;
    if (!isCompanyAdmin) return <div>Access Denied</div>;

    // Merge DB columns with Metadata for display
    const attributesList = (dbColumns || [])
        .filter(col => !hiddenColumns.includes(col.column_name))
        .map(col => {
            const isSystem = systemColumns.includes(col.column_name);
            return {
                name: col.column_name,
                label: col.column_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                type: col.data_type,
                system: isSystem,
                canUnique: ['email', 'phone'].includes(col.column_name) // Currently limiting unique toggle key fields
            };
        });

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h2 className="text-2xl font-bold">Lead Attributes</h2>
                <p className="text-muted-foreground">Customize your lead schema.</p>
            </div>

            {/* Removed License Check */}
            {!isUnlocked ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Lock className="h-5 w-5" /> Unlock Custom Attributes
                        </CardTitle>
                        <CardDescription>
                            Gain full control over your lead schema. Add custom fields, unique constraints, and more.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-muted p-4 rounded-lg border flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-lg">One-time Unlock Fee</p>
                                <p className="text-sm text-muted-foreground">Unlock unlimited custom attributes forever.</p>
                            </div>
                            <div className="text-2xl font-bold font-mono">
                                ₹1,00,000
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Current Wallet Balance: <span className={wallet?.balance && wallet.balance >= 100000 ? "text-green-600 font-bold" : "text-destructive font-bold"}>₹{wallet?.balance?.toLocaleString() || 0}</span>
                            </p>
                            <Button onClick={handleUnlock} disabled={unlocking} size="lg">
                                {unlocking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : 'Pay & Unlock'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Unlock className="h-5 w-5 text-green-500" /> Custom Attributes Active
                            </CardTitle>
                            <CardDescription>Table: {company.custom_leads_table}</CardDescription>
                        </div>
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add Attribute</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add New Attribute</DialogTitle>
                                    <DialogDescription>Add a new text field to your leads table.</DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Label>Attribute Name</Label>
                                    <Input
                                        value={newAttributeName}
                                        onChange={e => setNewAttributeName(e.target.value)}
                                        placeholder="e.g. LinkedIn URL"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Will be converted to snake_case (e.g. linkedin_url)</p>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleAddAttribute} disabled={addingAttribute}>
                                        {addingAttribute ? <Loader2 className="animate-spin" /> : 'Add Attribute'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Attribute Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Properties</TableHead>
                                    <TableHead>Unique Constraint</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {columnsLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-6">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : attributesList.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                            No attributes found for table {company.custom_leads_table || 'leads'}.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    attributesList.map((attr) => {
                                        const isUnique = uniqueConstraints?.includes(attr.name) || false;
                                        return (
                                            <TableRow key={attr.name}>
                                                <TableCell className="font-medium">{attr.label}</TableCell>
                                                <TableCell><Badge variant="outline">{attr.type}</Badge></TableCell>
                                                <TableCell>
                                                    {attr.system ? <Badge variant="secondary">System</Badge> : <Badge>Custom</Badge>}
                                                </TableCell>
                                                <TableCell>
                                                    {attr.canUnique ? (
                                                        <div className="flex items-center gap-2">
                                                            <Switch
                                                                checked={isUnique}
                                                                onCheckedChange={() => handleToggleUnique(attr.name, isUnique)}
                                                                disabled={constraintsLoading}
                                                            />
                                                            {isUnique && <span className="text-xs text-green-600 flex gap-1"><Fingerprint className="h-3 w-3" /> Unique</span>}
                                                        </div>
                                                    ) : <span className="text-muted-foreground text-xs">Not applicable</span>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {!attr.system && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDeleteAttribute(attr.name)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
