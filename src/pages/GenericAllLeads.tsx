import { useState, useEffect } from 'react';
// DashboardLayout removed
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, LayoutGrid, Table2 } from 'lucide-react';

import { useLeads } from '@/hooks/useLeads';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { Constants } from '@/integrations/supabase/types';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { UploadLeadsDialog } from '@/components/leads/UploadLeadsDialog';
import { AssignLeadsDialog } from '@/components/leads/AssignLeadsDialog';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { SwipeableLeadCard } from '@/components/leads/SwipeableLeadCard';
import { MobileLeadsHeader } from '@/components/leads/MobileLeadsHeader';
import { FloatingAddButton } from '@/components/leads/FloatingAddButton';
import { useLeadsTable } from '@/hooks/useLeadsTable';
import { useCompany } from '@/hooks/useCompany';
import { useIsMobile } from '@/hooks/use-mobile';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { LeadDetailsDialog } from '@/components/leads/LeadDetailsDialog';
import { ColumnConfigDialog } from '@/components/leads/ColumnConfigDialog';
import { StatusReminderDialog } from '@/components/leads/StatusReminderDialog';
import { useLeadStatuses, CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { LeadsKanbanBoard } from '@/components/leads/LeadsKanbanBoard';
import { useCustomColumns } from '@/hooks/useCustomColumns';

import { useSearchParams } from 'react-router-dom';

export default function GenericAllLeads() {
    const { company } = useCompany();
    const isMobile = useIsMobile();
    const [searchParams, setSearchParams] = useSearchParams();
    const [addDialogOpen, setAddDialogOpen] = useState(false);

    // Get values from URL or defaults
    const searchQuery = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const selectedOwners = new Set(searchParams.getAll('owner'));
    const selectedStatuses = new Set(searchParams.getAll('status'));
    const selectedProducts = new Set(searchParams.getAll('product'));

    // Local state only for immediate input usage (debounced later)
    const [localSearch, setLocalSearch] = useState(searchQuery);
    const debouncedSearchQuery = useDebounce(localSearch, 500);

    const pageSize = parseInt(searchParams.get('pageSize') || '25');
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<any>(null);
    const [viewingLead, setViewingLead] = useState<any>(null);
    const { tableName } = useLeadsTable();
    const [configOpen, setConfigOpen] = useState(false);
    const { statuses } = useLeadStatuses();
    const [pendingStatus, setPendingStatus] = useState<{ leadId: string; status: CompanyLeadStatus } | null>(null);
    const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

    const { customColumns } = useCustomColumns();

    const defaultColumns = [
        { id: 'priority', label: 'Priority' },
        { id: 'name', label: 'Name' },
        { id: 'email', label: 'Email' },
        { id: 'phone', label: 'Phone Number' },
        { id: 'college', label: 'College' },
        { id: 'lead_source', label: 'Lead Source' },
        { id: 'status', label: 'Status' },
        { id: 'owner', label: 'Owner' },
        { id: 'created_at', label: 'Date' },
        { id: 'product_purchased', label: 'Product' },
        { id: 'payment_link', label: 'Payment Link' },
        { id: 'whatsapp', label: 'WhatsApp', defaultHidden: true },
        { id: 'updated_at', label: 'Last Updated', defaultHidden: true },
        { id: 'company_id', label: 'Company ID', defaultHidden: true },
        ...customColumns
    ];

    const columnConfig = (company as any)?.features?.table_configs?.['all_leads'];

    // Effect to sync debounced search to URL
    useEffect(() => {
        if (debouncedSearchQuery !== searchQuery) {
            setSearchParams(prev => {
                const newParams = new URLSearchParams(prev);
                if (debouncedSearchQuery) {
                    newParams.set('q', debouncedSearchQuery);
                } else {
                    newParams.delete('q');
                }
                newParams.set('page', '1');
                return newParams;
            });
        }
    }, [debouncedSearchQuery, setSearchParams, searchQuery]);

    // Update local search if URL changes externally
    useEffect(() => {
        if (searchQuery !== localSearch) {
            setLocalSearch(searchQuery);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);


    // Handlers for filters
    const handleSetOwners = (newOwners: Set<string>) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.delete('owner');
            newOwners.forEach(o => newParams.append('owner', o));
            newParams.set('page', '1');
            return newParams;
        });
    };

    const handleSetStatuses = (newStatuses: Set<string>) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.delete('status');
            newStatuses.forEach(s => newParams.append('status', s));
            newParams.set('page', '1');
            return newParams;
        });
    };

    const handleSetProducts = (newProducts: Set<string>) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.delete('product');
            newProducts.forEach(p => newParams.append('product', p));
            newParams.set('page', '1');
            return newParams;
        });
    };

    const handlePageChange = (newPage: number) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.set('page', newPage.toString());
            return newParams;
        });
    }

    const handlePageSizeChange = (newSize: string) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.set('pageSize', newSize);
            newParams.set('page', '1');
            return newParams;
        });
    };

    // Fetch filter options — all queries run in parallel via Promise.all
    const { data: filterOptions } = useQuery({
        queryKey: ['leadsFilterOptions', company?.id, tableName, JSON.stringify(columnConfig)],
        queryFn: async () => {
            if (!company?.id || !tableName) return null;

            const isPredefinedFilter = (id: string) => id === 'owner' || id === 'status' || id === 'product_purchased';
            const filterableCols = (columnConfig || defaultColumns)
                .filter((c: any) => c.filterable || (columnConfig ? false : isPredefinedFilter(c.id)))
                .map((c: any) => {
                    const def = defaultColumns.find(dc => dc.id === c.id);
                    return {
                        ...c,
                        label: def?.label || c.id
                    };
                });

            const dynamicColsToFetch = filterableCols.filter((c: any) => !isPredefinedFilter(c.id));

            // Fire all standard and dynamic queries at the same time
            const [ownersResult, productsResult, statusesResult, ...dynamicResults] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, full_name')
                    .eq('company_id', company.id)
                    .not('full_name', 'is', null),
                supabase
                    .from('products')
                    .select('name')
                    .eq('company_id', company.id)
                    .order('name'),
                supabase
                    .from('company_lead_statuses' as any)
                    .select('label, value, category, order_index')
                    .eq('company_id', company.id)
                    .order('order_index'),
                ...dynamicColsToFetch.map(async (c: any) => {
                    try {
                        const { data, error } = await supabase
                            .from(tableName as any)
                            .select(c.id)
                            .eq('company_id', company.id)
                            .not(c.id, 'is', null);
                        if (error) {
                            console.error(`Error fetching dynamic values for ${c.id}:`, error);
                            return { id: c.id, options: [] };
                        }
                        const uniqueVals = Array.from(new Set(
                            (data || []).map((r: any) => {
                                const val = r[c.id];
                                if (typeof val === 'boolean') return val ? 'true' : 'false';
                                return val;
                            })
                        )).filter((val: any) => val !== undefined && val !== null && val !== '')
                         .sort();
                        
                        return {
                            id: c.id,
                            options: uniqueVals.map((val: any) => ({
                                label: String(val).replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
                                value: String(val)
                            }))
                        };
                    } catch (err) {
                        console.error(`Error in dynamic filter fetch for ${c.id}:`, err);
                        return { id: c.id, options: [] };
                    }
                })
            ]);

            // Filter owners to only those with active role entries
            let activeOwners = ownersResult.data || [];
            if (activeOwners.length > 0) {
                const ownerIds = activeOwners.map(o => o.id);
                const { data: rolesData } = await supabase
                    .from('user_roles')
                    .select('user_id')
                    .in('user_id', ownerIds);
                const activeUserIds = new Set(rolesData?.map(r => r.user_id));
                activeOwners = activeOwners.filter(o => activeUserIds.has(o.id));
            }

            const products = productsResult.data;
            const statusesData = statusesResult.data as any[] | null;

            const statuses = statusesData && statusesData.length > 0
                ? statusesData.map((s: any) => ({
                    label: s.label,
                    value: s.value,
                    group: s.category
                }))
                : Constants.public.Enums.lead_status.map(s => ({ label: s.replace('_', ' '), value: s, group: 'System' }));

            const dynamicOptionsMap: Record<string, { label: string; value: string }[]> = {};
            dynamicResults.forEach((res: any) => {
                if (res) {
                    dynamicOptionsMap[res.id] = res.options;
                }
            });

            return {
                owners: [
                    { label: 'Unassigned', value: 'unassigned' },
                    ...activeOwners.map(o => ({ label: o.full_name || 'Unknown', value: o.id })),
                ],
                products: Array.from(new Set(((products as any[]) || []).map(p => p.name))).map(name => ({ label: name, value: name })),
                statuses: statuses,
                dynamic: dynamicOptionsMap
            };
        },
        enabled: !!company?.id && !!tableName,
        staleTime: 1000 * 60 * 5, // Cache filter options for 5 minutes
    });

    const isPredefinedFilter = (id: string) => id === 'owner' || id === 'status' || id === 'product_purchased';

    const filterableColumns = (columnConfig || defaultColumns)
        .filter((c: any) => c.filterable || (columnConfig ? false : isPredefinedFilter(c.id)))
        .map((c: any) => {
            const def = defaultColumns.find(dc => dc.id === c.id);
            return {
                ...c,
                label: def?.label || c.id
            };
        });

    // Construct dynamic filters object for useLeads/Kanban (excludes owner, status, product_purchased)
    const dynamicFilters: Record<string, string[]> = {};
    filterableColumns.forEach((col: any) => {
        if (!isPredefinedFilter(col.id)) {
            const vals = searchParams.getAll(col.id);
            if (vals.length > 0) {
                dynamicFilters[col.id] = vals;
            }
        }
    });

    // Create the activeFilters list for MobileLeadsHeader
    const activeFilters = filterableColumns.map((col: any) => {
        let options: { label: string; value: string; group?: string }[] = [];
        let selectedValues = new Set<string>();
        let onSelectionChange = (newValues: Set<string>) => {};

        if (col.id === 'owner') {
            options = filterOptions?.owners || [];
            selectedValues = selectedOwners;
            onSelectionChange = handleSetOwners;
        } else if (col.id === 'status') {
            options = filterOptions?.statuses || [];
            selectedValues = selectedStatuses;
            onSelectionChange = handleSetStatuses;
        } else if (col.id === 'product_purchased') {
            options = filterOptions?.products || [];
            selectedValues = selectedProducts;
            onSelectionChange = handleSetProducts;
        } else {
            options = filterOptions?.dynamic?.[col.id] || [];
            selectedValues = new Set(searchParams.getAll(col.id));
            onSelectionChange = (newValues: Set<string>) => {
                setSearchParams(prev => {
                    const newParams = new URLSearchParams(prev);
                    newParams.delete(col.id);
                    newValues.forEach(val => newParams.append(col.id, val));
                    newParams.set('page', '1');
                    return newParams;
                });
            };
        }

        return {
            id: col.id,
            label: col.label,
            options,
            selectedValues,
            onSelectionChange
        };
    });

    // Active owner IDs (excludes the 'unassigned' sentinel) — used by useLeads to build the
    // "deleted-user" filter: leads where sales_owner_id NOT IN (activeOwnerIds)
    const activeOwnerIds = (filterOptions?.owners ?? [])
        .filter(o => o.value !== 'unassigned')
        .map(o => o.value);

    const { data: leadsData, isLoading, refetch } = useLeads({
        search: searchQuery,
        statusFilter: selectedStatuses.size === 1 ? Array.from(selectedStatuses)[0] : undefined,
        ownerFilter: Array.from(selectedOwners),
        activeOwnerIds,
        productFilter: Array.from(selectedProducts),
        page,
        pageSize,
        dynamicFilters,
    });
    const leads = leadsData?.leads || [];
    const totalCount = leadsData?.count || 0;

    const totalPages = Math.ceil(totalCount / pageSize);
    const { user } = useAuth();
    const { data: userRole } = useUserRole();

    const handleDeleteLeads = async () => {
        if (!confirm('Are you sure you want to delete the selected leads? This action cannot be undone.')) {
            return;
        }

        try {
            const { error } = await supabase
                .from(tableName as any)
                .delete()
                .in('id', Array.from(selectedLeads));

            if (error) throw error;

            toast.success(`Successfully deleted ${selectedLeads.size} leads`);
            setSelectedLeads(new Set());
            await refetch();
        } catch (error) {
            console.error('Error deleting leads:', error);
            toast.error('Failed to delete leads');
        }
    };

    const handleStatusChange = async (leadId: string, newStatusValue: string, metadata?: Record<string, any>) => {
        const newStatus = statuses?.find(s => s.value === newStatusValue);

        // Check if status requires date/time input (Derived Status)
        if (newStatus && (newStatus.status_type === 'date_derived' || newStatus.status_type === 'time_derived') && !metadata) {
            setPendingStatus({ leadId, status: newStatus });
            setReminderDialogOpen(true);
            return;
        }

        try {
            const updates: any = { status: newStatusValue };
            if (metadata && metadata.reminder_at) {
                updates.reminder_at = metadata.reminder_at;
            } else if (newStatus && newStatus.status_type === 'simple') {
                updates.reminder_at = null;
            }
            // Re-enabled: only send if true to ensure pick-up by cron
            if (metadata && metadata.send_web_push === true) {
                updates.send_web_push = true;
                updates.last_notification_sent_at = null;
            }

            const { error } = await supabase
                .from(tableName as any)
                .update(updates)
                .eq('id', leadId);

            if (error) throw error;
            toast.success('Status updated successfully');
            await refetch();
        } catch (error) {
            console.error('Status update error:', error);
            toast.error('Failed to update status');
        }
    };

    const handleReminderConfirm = async (dateTime: Date | null, sendNotification: boolean) => {
        if (!pendingStatus) return;

        const metadata: Record<string, any> = {};
        if (dateTime) {
            metadata.reminder_at = dateTime.toISOString();
        }
        metadata.send_web_push = sendNotification;

        await handleStatusChange(pendingStatus.leadId, pendingStatus.status.value, metadata);
        setReminderDialogOpen(false);
        setPendingStatus(null);
    };

    const handleReminderCancel = () => {
        setReminderDialogOpen(false);
        setPendingStatus(null);
    };

    const toggleLead = (id: string) => {
        const newSelected = new Set(selectedLeads);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedLeads(newSelected);
    };

    // No full-screen blocking spinner — the table renders inline skeletons while loading

    const visibleColumns = defaultColumns.filter(col => {
        if (!columnConfig) return !col.defaultHidden;
        const configItem = columnConfig.find((c: any) => c.id === col.id);
        return configItem ? configItem.visible : !col.defaultHidden;
    }).sort((a, b) => {
        if (!columnConfig) return 0;
        const indexA = columnConfig.findIndex((c: any) => c.id === a.id);
        const indexB = columnConfig.findIndex((c: any) => c.id === b.id);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    }).map(col => ({ ...col, visible: true }));

    return (
        <>
            <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
                <MobileLeadsHeader
                    title="All Leads"
                    searchValue={localSearch}
                    onSearchChange={setLocalSearch}
                    activeFilters={activeFilters}
                    selectedCount={selectedLeads.size}
                    onDelete={handleDeleteLeads}
                    onAssign={() => setAssignDialogOpen(true)}
                    canDelete={userRole === 'company' || userRole === 'company_subadmin'}
                    uploadButton={<UploadLeadsDialog />}
                    addButton={!isMobile ? <AddLeadDialog /> : null}
                    onEditLayout={userRole === 'company' || userRole === 'company_subadmin' ? () => setConfigOpen(true) : undefined}
                />

                {/* View Mode Toggle (Desktop only) */}
                {!isMobile && (
                    <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 w-fit">
                        <Button
                            variant={viewMode === 'table' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 px-3 gap-1.5"
                            onClick={() => setViewMode('table')}
                        >
                            <Table2 className="h-4 w-4" />
                            Table
                        </Button>
                        <Button
                            variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 px-3 gap-1.5"
                            onClick={() => setViewMode('kanban')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                            Kanban
                        </Button>
                    </div>
                )}

                {/* Mobile Card View */}
                {isMobile ? (
                    <div className="space-y-3">
                        {leads.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <p>No leads found. Add your first lead to get started!</p>
                            </div>
                        ) : (
                            leads.map((lead) => (
                                <SwipeableLeadCard
                                    key={lead.id}
                                    lead={lead}
                                    isSelected={selectedLeads.has(lead.id)}
                                    onToggleSelect={() => toggleLead(lead.id)}
                                    onViewDetails={() => setViewingLead(lead)}
                                    onEdit={() => setEditingLead(lead)}
                                    onStatusChange={(status) => handleStatusChange(lead.id, status)}
                                    owners={filterOptions?.owners}
                                    variant="education"
                                    visibleAttributes={visibleColumns}
                                    maskLeads={company?.mask_leads}
                                />
                            ))
                        )}
                    </div>
                ) : viewMode === 'kanban' ? (
                    /* Kanban Board View */
                    <LeadsKanbanBoard
                        statuses={statuses}
                        loading={isLoading}
                        onStatusChange={(leadId, newStatus) => handleStatusChange(leadId, newStatus)}
                        onLeadClick={(lead) => setViewingLead(lead)}
                        owners={filterOptions?.owners}
                        searchQuery={searchQuery}
                        ownerFilter={Array.from(selectedOwners)}
                        activeOwnerIds={activeOwnerIds}
                        productFilter={Array.from(selectedProducts)}
                        dynamicFilters={dynamicFilters}
                    />
                ) : (
                    /* Desktop Table View */
                    <Card>
                        <CardContent className="pt-6">
                            <LeadsTable
                                leads={leads as any}
                                loading={isLoading}
                                selectedLeads={selectedLeads}
                                onSelectionChange={setSelectedLeads}
                                owners={filterOptions?.owners || []}
                                columnConfig={columnConfig}
                                maskLeads={company?.mask_leads}
                                customColumns={customColumns}
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Pagination (hide in kanban mode) */}
                {viewMode === 'table' && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Rows per page:</span>
                            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                                <SelectTrigger className="h-8 w-[80px] bg-background border-input">
                                    <SelectValue placeholder={pageSize.toString()} />
                                </SelectTrigger>
                                <SelectContent>
                                    {[25, 50, 100, 250, 500, 1000, 5000].map(size => (
                                        <SelectItem key={size} value={size.toString()}>
                                            {size}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(Math.max(1, page - 1))}
                            disabled={page === 1 || isLoading}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1">Previous</span>
                        </Button>
                        <div className="text-sm font-medium px-2">
                            {page} / {totalPages || 1}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                            disabled={page === totalPages || isLoading}
                        >
                            <span className="hidden sm:inline mr-1">Next</span>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                )}
            </div>

            <AssignLeadsDialog
                open={assignDialogOpen}
                onOpenChange={setAssignDialogOpen}
                selectedLeadIds={Array.from(selectedLeads)}
                onSuccess={() => setSelectedLeads(new Set())}
            />

            <EditLeadDialog
                open={!!editingLead}
                onOpenChange={(open) => !open && setEditingLead(null)}
                lead={editingLead}
            />

            <LeadDetailsDialog
                open={!!viewingLead}
                onOpenChange={(open) => !open && setViewingLead(null)}
                lead={viewingLead}
                owners={filterOptions?.owners || []}
                maskLeads={company?.mask_leads}
            />

            {/* Mobile Floating Action Button */}
            {isMobile && (
                <FloatingAddButton onClick={() => setAddDialogOpen(true)} />
            )}

            {/* Mobile Add Dialog */}
            <AddLeadDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
            />

            <ColumnConfigDialog
                open={configOpen}
                onOpenChange={setConfigOpen}
                tableId="all_leads"
                defaultColumns={defaultColumns}
            />

            {pendingStatus && (
                <StatusReminderDialog
                    open={reminderDialogOpen}
                    onOpenChange={setReminderDialogOpen}
                    status={pendingStatus.status}
                    onConfirm={handleReminderConfirm}
                    onCancel={handleReminderCancel}
                />
            )}
        </>
    );
}
