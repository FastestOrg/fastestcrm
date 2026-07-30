import { useState, useEffect } from 'react';
// DashboardLayout removed
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useOrgClient } from '@/hooks/useOrgClient';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Edit2, Trash2, GripVertical, Save, RefreshCw, AlertTriangle, Copy } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CompanyLeadStatus {
    id: string;
    company_id: string;
    label: string;
    value: string;
    color: string;
    category: 'new' | 'paid' | 'interested' | 'other';
    sub_statuses: string[];
    order_index: number;
    is_active: boolean;
    status_type: 'simple' | 'date_derived' | 'time_derived';
    web_push_enabled: boolean;
}

interface SortableRowProps {
    status: CompanyLeadStatus;
    handleOpenEdit: (status: CompanyLeadStatus) => void;
    handleDelete: (id: string) => void;
}

function SortableRow({ status, handleOpenEdit, handleDelete }: SortableRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: status.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
        position: isDragging ? 'relative' as const : undefined,
    };

    return (
        <TableRow ref={setNodeRef} style={style}>
            <TableCell>
                <div {...attributes} {...listeners} className="cursor-move touch-none">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
            </TableCell>
            <TableCell className="font-medium">
                <Badge variant="outline" style={{ borderColor: status.color, color: status.color }}>
                    {status.label}
                </Badge>
            </TableCell>
            <TableCell>
                <Badge variant="secondary" className="capitalize">
                    {status.category.replace('_', ' ')}
                </Badge>
            </TableCell>
            <TableCell>
                {status.status_type === 'date_derived' ? 'Date Derived' :
                    status.status_type === 'time_derived' ? 'Time Derived' : 'Simple'}
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="text-xs text-muted-foreground uppercase">{status.color}</span>
                </div>
            </TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(status)}>
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(status.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}

const missingTablesCache = new Set<string>();

export default function ManageStatuses() {
    const { company, isCompanyAdmin } = useCompany();
    const { user } = useAuth();
    const { orgClient, isBYOSLoading } = useOrgClient();
    const queryClient = useQueryClient();

    const [isaddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingStatus, setEditingStatus] = useState<CompanyLeadStatus | null>(null);
    const [saving, setSaving] = useState(false);
    const [localStatuses, setLocalStatuses] = useState<CompanyLeadStatus[]>([]);
    const [isTableMissing, setIsTableMissing] = useState(false);

    // Copy SQL Helper
    const handleCopySQL = () => {
        const sql = `-- FastestCRM — BYOS Migration Bundle
CREATE TABLE IF NOT EXISTS public.company_lead_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  color TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  status_type TEXT DEFAULT 'simple',
  web_push_enabled BOOLEAN DEFAULT false,
  sub_statuses TEXT[] DEFAULT ARRAY[]::TEXT[],
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_lead_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "byos_company_lead_statuses_all" ON public.company_lead_statuses;
CREATE POLICY "byos_company_lead_statuses_all" ON public.company_lead_statuses FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_company_lead_statuses_company_id ON public.company_lead_statuses(company_id);
NOTIFY pgrst, 'reload schema';
`;
        navigator.clipboard.writeText(sql);
        toast.success('Migration SQL copied to clipboard! Paste into your Supabase Dashboard -> SQL Editor and click RUN.');
    };

    // Form State
    const [formData, setFormData] = useState({
        label: '',
        color: '#3B82F6',
        category: 'interested',
        status_type: 'simple',
        web_push_enabled: false,
    });

    const { data: statuses, isLoading, refetch } = useQuery({
        queryKey: ['lead-statuses', (orgClient as any)?.supabaseUrl || 'default', company?.id],
        queryFn: async (): Promise<CompanyLeadStatus[]> => {
            if (!company?.id) return [];

            const targetUrl = (orgClient as any)?.supabaseUrl || 'default';
            const isDefaultHost = targetUrl.includes('api.fastestcrm.com') || targetUrl.includes('uykdyqdeyilpulaqlqip');

            const primaryTable = isDefaultHost ? 'company_lead_statuses' : 'lead_statuses';
            const fallbackTable = isDefaultHost ? 'lead_statuses' : 'company_lead_statuses';

            const cacheKeyMissingPrimary = `${targetUrl}_missing_${primaryTable}`;

            try {
                if (!missingTablesCache.has(cacheKeyMissingPrimary)) {
                    const { data, error } = await orgClient
                        .from(primaryTable as any)
                        .select('*')
                        .eq('company_id', company.id)
                        .order(primaryTable === 'company_lead_statuses' ? 'order_index' : 'sort_order', { ascending: true });

                    if (!error && data && data.length > 0) {
                        setIsTableMissing(false);
                        return data.map((s: any) => ({
                            id: s.id,
                            company_id: s.company_id,
                            label: s.label || s.name || 'Status',
                            value: s.value || (s.name || s.label || 'status').toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                            color: s.color || '#3B82F6',
                            category: s.category || s.status_type || 'other',
                            sub_statuses: s.sub_statuses || [],
                            order_index: s.order_index ?? s.sort_order ?? 0,
                            is_active: s.is_active !== undefined ? s.is_active : true,
                            status_type: s.status_type || 'simple',
                            web_push_enabled: s.web_push_enabled || false
                        }));
                    }
                    if (error) {
                        missingTablesCache.add(cacheKeyMissingPrimary);
                    }
                }

                // Fallback table
                const { data: fbData, error: fbErr } = await orgClient
                    .from(fallbackTable as any)
                    .select('*')
                    .eq('company_id', company.id)
                    .order(fallbackTable === 'company_lead_statuses' ? 'order_index' : 'sort_order', { ascending: true });

                if (!fbErr && fbData) {
                    setIsTableMissing(false);
                    return fbData.map((s: any) => ({
                        id: s.id,
                        company_id: s.company_id,
                        label: s.label || s.name || 'Status',
                        value: s.value || (s.name || s.label || 'status').toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                        color: s.color || '#3B82F6',
                        category: s.category || s.status_type || 'other',
                        sub_statuses: s.sub_statuses || [],
                        order_index: s.order_index ?? s.sort_order ?? 0,
                        is_active: s.is_active !== undefined ? s.is_active : true,
                        status_type: s.status_type || 'simple',
                        web_push_enabled: s.web_push_enabled || false
                    }));
                }

                setIsTableMissing(true);
                return [];
            } catch (e) {
                setIsTableMissing(true);
                return [];
            }
        },
        enabled: !!company?.id && !isBYOSLoading
    });

    useEffect(() => {
        if (statuses) {
            setLocalStatuses(statuses);
        }
    }, [statuses]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setLocalStatuses((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                const updates = newItems.map((item, index) => ({
                    id: item.id,
                    order_index: index,
                }));

                updateOrder(updates);

                return newItems;
            });
        }
    };

    const updateOrder = async (updates: { id: string, order_index: number }[]) => {
        try {
            // Standard Primary: lead_statuses
            await Promise.all(updates.map(update =>
                orgClient
                    .from('lead_statuses' as any)
                    .update({ sort_order: update.order_index })
                    .eq('id', update.id)
            ));

            queryClient.invalidateQueries({ queryKey: ['lead-statuses'] });
            toast.success('Order updated');

        } catch (error) {
            try {
                // Legacy Fallback: company_lead_statuses
                await Promise.all(updates.map(update =>
                    orgClient
                        .from('company_lead_statuses' as any)
                        .update({ order_index: update.order_index })
                        .eq('id', update.id)
                ));
                queryClient.invalidateQueries({ queryKey: ['lead-statuses'] });
                toast.success('Order updated');
            } catch (fbError) {
                console.error('Failed to update order', fbError);
                toast.error('Failed to save new order');
                refetch();
            }
        }
    };


    const handleOpenAdd = () => {
        setEditingStatus(null);
        setFormData({
            label: '',
            color: '#3B82F6',
            category: 'interested',
            status_type: 'simple',
            web_push_enabled: false
        });
        setIsAddDialogOpen(true);
    };

    const handleOpenEdit = (status: CompanyLeadStatus) => {
        setEditingStatus(status);
        setFormData({
            label: status.label,
            color: status.color,
            category: status.category as any,
            status_type: status.status_type || 'simple',
            web_push_enabled: status.web_push_enabled || false,
        });
        setIsAddDialogOpen(true);
    };

    const handleSave = async () => {
        if (!company || !user) return;
        if (!formData.label.trim()) {
            toast.error('Label is required');
            return;
        }

        setSaving(true);
        try {
            const value = formData.label.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

            // Standard Primary Payload for lead_statuses
            const primaryPayload = {
                company_id: company.id,
                name: formData.label.trim(),
                color: formData.color,
                sort_order: editingStatus ? editingStatus.order_index : (statuses?.length || 0),
                status_type: formData.status_type,
            };

            let saveErr: any = null;
            if (editingStatus) {
                const { error } = await orgClient
                    .from('lead_statuses' as any)
                    .update({
                        name: primaryPayload.name,
                        color: primaryPayload.color,
                        sort_order: primaryPayload.sort_order,
                        status_type: primaryPayload.status_type
                    })
                    .eq('id', editingStatus.id);
                saveErr = error;
            } else {
                const { error } = await orgClient
                    .from('lead_statuses' as any)
                    .insert(primaryPayload);
                saveErr = error;
            }

            // Legacy Fallback to company_lead_statuses if lead_statuses failed
            if (saveErr) {
                const fbPayload = {
                    company_id: company.id,
                    label: formData.label.trim(),
                    value: editingStatus ? editingStatus.value : value,
                    color: formData.color,
                    category: formData.category,
                    status_type: formData.status_type,
                    web_push_enabled: formData.web_push_enabled,
                    order_index: editingStatus ? editingStatus.order_index : (statuses?.length || 0),
                };

                if (editingStatus) {
                    const { error: fbErr } = await orgClient
                        .from('company_lead_statuses' as any)
                        .update(fbPayload)
                        .eq('id', editingStatus.id);
                    if (fbErr) throw saveErr;
                } else {
                    const { error: fbErr } = await orgClient
                        .from('company_lead_statuses' as any)
                        .insert(fbPayload);
                    if (fbErr) throw saveErr;
                }
            }

            toast.success(editingStatus ? 'Status updated' : 'Status created');
            setIsAddDialogOpen(false);
            setIsTableMissing(false);
            refetch();
        } catch (error: any) {
            if (error?.code === 'PGRST205' || error?.message?.includes('schema cache') || error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
                setIsTableMissing(true);
                handleCopySQL();
                toast.error(
                    '⚠️ lead_statuses table missing on your BYOS Supabase! The Migration SQL script has been copied to your clipboard. Paste into your Supabase SQL Editor and click RUN.',
                    { duration: 12000 }
                );
            } else {
                toast.error('Failed to save: ' + error.message);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? leads with this status might display incorrectly if not migrated.')) return;
        try {
            const { error } = await orgClient.from('lead_statuses' as any).delete().eq('id', id);
            if (error) {
                const { error: fbErr } = await orgClient.from('company_lead_statuses' as any).delete().eq('id', id);
                if (fbErr) throw error;
            }
            toast.success('Status deleted');
            refetch();
        } catch (error: any) {
            toast.error('Error: ' + error.message);
        }
    };

    if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
    if (!isCompanyAdmin) return <div className="p-8 text-center text-red-500">Access Restricted</div>;

    return (
        <>
            <div className="space-y-6 max-w-5xl mx-auto pb-10">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Lead Statuses</h1>
                        <p className="text-muted-foreground">Customize the stages of your sales pipeline.</p>
                    </div>
                    <Button onClick={handleOpenAdd}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Status
                    </Button>
                </div>

                {isTableMissing && (
                    <Card className="border-amber-500/40 bg-amber-500/10">
                        <CardContent className="pt-4 flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
                                <div>
                                    <p className="font-semibold text-sm text-foreground">BYOS Setup Action Required: Table Missing</p>
                                    <p className="text-xs text-muted-foreground">Your connected Supabase database is missing the <code className="bg-muted px-1 rounded text-foreground">company_lead_statuses</code> table. Paste the migration SQL script into your Supabase SQL Editor to enable custom statuses.</p>
                                </div>
                            </div>
                            <Button size="sm" onClick={handleCopySQL} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs">
                                <Copy className="h-4 w-4" /> Copy Migration SQL Script
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Pipeline Stages</CardTitle>
                        <CardDescription>
                            Define statuses and map them to system categories (New, Paid, etc.) for reporting.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]"></TableHead>
                                        <TableHead>Label</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Color</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <SortableContext
                                        items={localStatuses.map(s => s.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {localStatuses.map((status) => (
                                            <SortableRow
                                                key={status.id}
                                                status={status}
                                                handleOpenEdit={handleOpenEdit}
                                                handleDelete={handleDelete}
                                            />
                                        ))}
                                    </SortableContext>
                                    {localStatuses.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                No statuses defined.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </DndContext>
                    </CardContent>
                </Card>

                <Dialog open={isaddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingStatus ? 'Edit Status' : 'Add New Status'}</DialogTitle>
                            <DialogDescription>
                                Configure the display label and behavior of this status.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Label</Label>
                                <Input
                                    placeholder="e.g. Meeting Scheduled"
                                    value={formData.label}
                                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>System Category</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(val) => setFormData({ ...formData, category: val as any })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="new">New (Fresh Leads)</SelectItem>
                                        <SelectItem value="interested">Interested (In Progress)</SelectItem>
                                        <SelectItem value="paid">Paid (Closed Won)</SelectItem>
                                        <SelectItem value="other">Other (Closed Lost / Archive)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Determines how this status is counted in analytics.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Status Type</Label>
                                <Select
                                    value={formData.status_type}
                                    onValueChange={(val) => setFormData({ ...formData, status_type: val as any })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="simple">Simple (No extra action)</SelectItem>
                                        <SelectItem value="date_derived">Date Derived (Set Date)</SelectItem>
                                        <SelectItem value="time_derived">Time Derived (Set Timer)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.status_type !== 'simple' && (
                                <div className="flex items-center space-x-2 border p-3 rounded-md">
                                    <Switch
                                        id="web-push"
                                        checked={formData.web_push_enabled}
                                        onCheckedChange={(checked) => setFormData({ ...formData, web_push_enabled: checked })}
                                    />
                                    <Label htmlFor="web-push">Enable Web Push Notification</Label>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        className="w-12 h-10 p-1 cursor-pointer"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    />
                                    <Input
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="uppercase font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Save Status
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
