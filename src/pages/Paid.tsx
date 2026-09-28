import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLeadStatuses, CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { useCompany } from '@/hooks/useCompany';
import { useOrgClient } from '@/hooks/useOrgClient';
import { Tables } from '@/integrations/supabase/types';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { RealEstateLeadsTable } from '@/industries/real_estate/components/RealEstateLeadsTable';
import { useRealEstateLeads } from '@/industries/real_estate/hooks/useRealEstateLeads';
import { RealEstateAssignLeadsDialog } from '@/industries/real_estate/components/RealEstateAssignLeadsDialog';
import { AssignLeadsDialog } from '@/components/leads/AssignLeadsDialog';
import { SwipeableLeadCard } from '@/components/leads/SwipeableLeadCard';
import { MobileLeadsHeader } from '@/components/leads/MobileLeadsHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { LeadDetailsDialog } from '@/components/leads/LeadDetailsDialog';
import { RealEstateEditLeadDialog } from '@/industries/real_estate/components/RealEstateEditLeadDialog';
import { RealEstateLeadDetailsDialog } from '@/industries/real_estate/components/RealEstateLeadDetailsDialog';
import { OmnichannelLeadDrawer } from '@/components/leads/OmnichannelLeadDrawer';
import { StatusReminderDialog } from '@/components/leads/StatusReminderDialog';
import { toast } from 'sonner';
import { useLeadsTable } from '@/hooks/useLeadsTable';
import { ColumnConfigDialog } from '@/components/leads/ColumnConfigDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { useCustomColumns } from '@/hooks/useCustomColumns';
import { useDebounce } from '@/hooks/useDebounce';
import { useHierarchy } from '@/hooks/useHierarchy';
import { useFacetedFilterOptions } from '@/hooks/useFacetedFilterOptions';
import { executeInChunks } from '@/lib/batchUtils';
import { REAL_ESTATE_PROPERTY_TYPES } from '@/industries/real_estate/config';

type Lead = Tables<'leads'> & {
    sales_owner?: {
        full_name: string | null;
    } | null;
};

export default function Paid() {
    const { company } = useCompany();
    const isMobile = useIsMobile();
    const { accessibleUserIds, canViewAll, loading: hierarchyLoading } = useHierarchy();
    const [searchParams, setSearchParams] = useSearchParams();

    // URL-synced search & pagination params
    const searchQuery = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
    const selectedOwners = useMemo(() => new Set(searchParams.getAll('owner')), [searchParams]);
    const selectedStatuses = useMemo(() => new Set(searchParams.getAll('status')), [searchParams]);
    const selectedProducts = useMemo(() => new Set(searchParams.getAll('product')), [searchParams]);
    const selectedPropertyTypes = useMemo(() => new Set(searchParams.getAll('property_type')), [searchParams]);

    // Local state for debounced search input
    const [localSearch, setLocalSearch] = useState(searchQuery);
    const debouncedSearchQuery = useDebounce(localSearch, 500);

    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<any>(null);
    const [viewingLead, setViewingLead] = useState<any>(null);
    const [chatLead, setChatLead] = useState<any>(null);
    const { tableName } = useLeadsTable();
    const { data: userRole } = useUserRole();
    const [configOpen, setConfigOpen] = useState(false);
    const { customColumns } = useCustomColumns();
    const { statuses: allStatuses } = useLeadStatuses();
    const [pendingStatus, setPendingStatus] = useState<{ leadId: string; status: CompanyLeadStatus } | null>(null);
    const [reminderDialogOpen, setReminderDialogOpen] = useState(false);

    // Sync debounced search to URL
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
    }, [searchQuery]);

    const isRealEstate = company?.industry === 'real_estate' && !company?.custom_leads_table;

    const genericDefaultColumns = [
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

    const realEstateDefaultColumns = [
        { id: 'name', label: 'Name' },
        { id: 'contact', label: 'Contact' },
        { id: 'property_name', label: 'Property Name' },
        { id: 'lead_source', label: 'Lead Source' },
        { id: 'property_type', label: 'Property Type' },
        { id: 'budget', label: 'Budget' },
        { id: 'location', label: 'Location' },
        { id: 'lead_profile', label: 'Lead Profile' },
        { id: 'status', label: 'Status' },
        { id: 'pre_sales_owner', label: 'Pre-Sales' },
        { id: 'sales_owner', label: 'Sales' },
        { id: 'post_sales_owner', label: 'Post-Sales' },
        { id: 'notes', label: 'Notes' },
        { id: 'created_at', label: 'Date' },
        { id: 'site_visit', label: 'Site Visit' },
        // Hidden by default
        { id: 'email', label: 'Email', defaultHidden: true },
        { id: 'phone', label: 'Phone', defaultHidden: true },
        { id: 'whatsapp', label: 'WhatsApp', defaultHidden: true },
        { id: 'budget_min', label: 'Min Budget', defaultHidden: true },
        { id: 'budget_max', label: 'Max Budget', defaultHidden: true },
        { id: 'property_size', label: 'Property Size', defaultHidden: true },
        { id: 'possession_timeline', label: 'Possession', defaultHidden: true },
        { id: 'broker_name', label: 'Broker Name', defaultHidden: true },
        { id: 'unit_number', label: 'Unit No.', defaultHidden: true },
        { id: 'deal_value', label: 'Deal Value', defaultHidden: true },
        { id: 'commission_percentage', label: 'Commission %', defaultHidden: true },
        { id: 'commission_amount', label: 'Commission Amount', defaultHidden: true },
        { id: 'revenue_projected', label: 'Revenue Projected', defaultHidden: true },
        { id: 'revenue_received', label: 'Revenue Received', defaultHidden: true },
        { id: 'updated_at', label: 'Last Updated', defaultHidden: true },
        { id: 'purpose', label: 'Purpose', defaultHidden: true }
    ];

    const defaultColumns = isRealEstate ? realEstateDefaultColumns : genericDefaultColumns;
    const columnConfig = (company as any)?.features?.table_configs?.['paid_leads'];

    // Base paid statuses (category = paid or type = paid)
    const basePaidStatuses = useMemo(() => {
        const matched = allStatuses
            .filter(s => s.category === 'paid' || s.status_type === 'paid' || s.value.includes('paid'))
            .map(s => s.value);
        return matched.length > 0 ? matched : ['paid'];
    }, [allStatuses]);

    // Effective status filter: user selection if any, otherwise all paid statuses
    const effectiveStatusFilter = useMemo(() => {
        if (selectedStatuses.size > 0) {
            return Array.from(selectedStatuses);
        }
        return basePaidStatuses;
    }, [selectedStatuses, basePaidStatuses]);

    // Handlers for filters
    const handleSetOwners = useCallback((newOwners: Set<string>) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.delete('owner');
            newOwners.forEach(o => newParams.append('owner', o));
            newParams.set('page', '1');
            return newParams;
        });
    }, [setSearchParams]);

    const handleSetStatuses = useCallback((newStatuses: Set<string>) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.delete('status');
            newStatuses.forEach(s => newParams.append('status', s));
            newParams.set('page', '1');
            return newParams;
        });
    }, [setSearchParams]);

    const handleSetProducts = useCallback((newProducts: Set<string>) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.delete('product');
            newProducts.forEach(p => newParams.append('product', p));
            newParams.set('page', '1');
            return newParams;
        });
    }, [setSearchParams]);

    const handleSetPropertyTypes = useCallback((newTypes: Set<string>) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.delete('property_type');
            newTypes.forEach(t => newParams.append('property_type', t));
            newParams.set('page', '1');
            return newParams;
        });
    }, [setSearchParams]);

    const handlePageChange = (newPage: number) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.set('page', newPage.toString());
            return newParams;
        });
    };

    const handlePageSizeChange = (newSize: string) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.set('pageSize', newSize);
            newParams.set('page', '1');
            return newParams;
        });
    };

    const handleResetFilters = () => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.delete('owner');
            newParams.delete('status');
            newParams.delete('product');
            newParams.delete('property_type');
            Array.from(newParams.keys()).forEach(key => {
                if (key !== 'q' && key !== 'page' && key !== 'pageSize') {
                    newParams.delete(key);
                }
            });
            newParams.set('page', '1');
            return newParams;
        });
    };

    const { orgClient } = useOrgClient();

    const isPredefinedFilter = (id: string) =>
        id === 'owner' || id === 'status' || id === 'product_purchased' || id === 'property_type';

    const filterableColumns = useMemo(() => {
        return (columnConfig || defaultColumns)
            .filter((c: any) => c.filterable || (columnConfig ? false : isPredefinedFilter(c.id)))
            .map((c: any) => {
                const def = defaultColumns.find(dc => dc.id === c.id);
                return {
                    ...c,
                    label: def?.label || c.id
                };
            });
    }, [columnConfig, defaultColumns]);

    // Dynamic filters (non-standard columns)
    const dynamicFilters: Record<string, string[]> = useMemo(() => {
        const filters: Record<string, string[]> = {};
        filterableColumns.forEach((col: any) => {
            if (!isPredefinedFilter(col.id)) {
                const vals = searchParams.getAll(col.id);
                if (vals.length > 0) {
                    filters[col.id] = vals;
                }
            }
        });
        return filters;
    }, [filterableColumns, searchParams]);

    // Fetch filter options (owners, products, dynamic column values)
    const { data: filterOptions } = useQuery({
        queryKey: ['leadsFilterOptions', (orgClient as any)?.supabaseUrl || 'default', company?.id, tableName, JSON.stringify(columnConfig), canViewAll, canViewAll ? 'all' : accessibleUserIds.slice().sort().join(','), hierarchyLoading],
        queryFn: async () => {
            if (!company?.id || !tableName) return null;

            const dynamicColsToFetch = filterableColumns.filter((c: any) => !isPredefinedFilter(c.id));

            const [ownersResult, productsResult, ...dynamicResults] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, full_name')
                    .eq('company_id', company.id)
                    .not('full_name', 'is', null),
                orgClient
                    .from('products')
                    .select('name')
                    .eq('company_id', company.id)
                    .order('name'),
                ...dynamicColsToFetch.map(async (c: any) => {
                    try {
                        let uniqueVals: string[] = [];
                        const { data: rpcData, error: rpcError } = await (orgClient as any).rpc('get_distinct_column_values', {
                            p_table_name: tableName,
                            p_column_name: c.id,
                            p_company_id: company.id
                        });

                        if (!rpcError && Array.isArray(rpcData)) {
                            uniqueVals = rpcData;
                        } else {
                            const { data, error } = await orgClient
                                .from(tableName as any)
                                .select(c.id)
                                .eq('company_id', company.id)
                                .not(c.id, 'is', null)
                                .limit(250);

                            if (error) {
                                return { id: c.id, options: [] };
                            }
                            uniqueVals = Array.from(new Set(
                                (data || []).map((r: any) => {
                                    const val = r[c.id];
                                    if (typeof val === 'boolean') return val ? 'true' : 'false';
                                    return val;
                                })
                            )).filter((val: any) => val !== undefined && val !== null && val !== '')
                             .sort();
                        }

                        return {
                            id: c.id,
                            options: uniqueVals.map((val: any) => ({
                                label: String(val).replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
                                value: String(val)
                            }))
                        };
                    } catch (err) {
                        return { id: c.id, options: [] };
                    }
                })
            ]);

            // Filter owners with active roles & within user hierarchy
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

            if (!hierarchyLoading && !canViewAll && accessibleUserIds.length > 0) {
                const accessibleSet = new Set(accessibleUserIds);
                activeOwners = activeOwners.filter(o => accessibleSet.has(o.id));
            }

            const dynamicOptionsMap: Record<string, { label: string; value: string }[]> = {};
            dynamicResults.forEach((res: any) => {
                if (res) {
                    dynamicOptionsMap[res.id] = res.options;
                }
            });

            return {
                owners: [
                    ...(canViewAll ? [{ label: 'Unassigned', value: 'unassigned' }] : []),
                    ...activeOwners.map(o => ({ label: o.full_name || 'Unknown', value: o.id })),
                ],
                products: Array.from(new Set(((productsResult.data as any[]) || []).map(p => p.name))).map(name => ({ label: name, value: name })),
                dynamic: dynamicOptionsMap
            };
        },
        enabled: !!company?.id && !!tableName && !hierarchyLoading,
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60,
        refetchOnWindowFocus: false,
    });

    const activeOwnerIds = useMemo(() => {
        return (filterOptions?.owners ?? [])
            .filter(o => o.value !== 'unassigned')
            .map(o => o.value);
    }, [filterOptions?.owners]);

    // Active filters mapped to database column names for faceted filtering
    const activeDbFilters: Record<string, string[]> = useMemo(() => {
        const filters: Record<string, string[]> = {};
        if (selectedOwners.size > 0) {
            filters['sales_owner_id'] = Array.from(selectedOwners);
        }
        if (selectedStatuses.size > 0) {
            filters['status'] = Array.from(selectedStatuses);
        }
        if (selectedProducts.size > 0) {
            filters['product_purchased'] = Array.from(selectedProducts);
        }
        if (selectedPropertyTypes.size > 0) {
            filters['property_type'] = Array.from(selectedPropertyTypes);
        }
        Object.entries(dynamicFilters).forEach(([colId, vals]) => {
            if (vals && vals.length > 0) {
                filters[colId] = vals;
            }
        });
        return filters;
    }, [selectedOwners, selectedStatuses, selectedProducts, selectedPropertyTypes, dynamicFilters]);

    const targetDbColumns = useMemo(() => {
        return filterableColumns.map((col: any) => {
            if (col.id === 'owner') return 'sales_owner_id';
            if (col.id === 'product_purchased') return 'product_purchased';
            return col.id;
        });
    }, [filterableColumns]);

    const { data: facetedOptions } = useFacetedFilterOptions({
        orgClient,
        tableName,
        companyId: company?.id,
        targetColumns: targetDbColumns,
        activeFilters: activeDbFilters,
        activeOwnerIds,
        accessibleUserIds,
        canViewAll,
        enabled: !!company?.id && !!tableName && !hierarchyLoading
    });

    // Scoped statuses for dropdown (only paid stage statuses)
    const stageStatuses = useMemo(() => {
        return allStatuses
            .filter(s => basePaidStatuses.includes(s.value))
            .map(s => ({
                label: s.label || s.name || s.value,
                value: s.value,
                group: s.category || s.status_type || 'Custom'
            }));
    }, [allStatuses, basePaidStatuses]);

    // Active filters for MobileLeadsHeader
    const activeFilters = useMemo(() => {
        return filterableColumns
            .filter((col: any) => {
                if (col.id === 'status' && stageStatuses.length <= 1) return false;
                if (col.id === 'property_type' && !isRealEstate) return false;
                if (col.id === 'product_purchased' && isRealEstate) return false;
                return true;
            })
            .map((col: any) => {
                let baseOptions: { label: string; value: string; group?: string }[] = [];
                let selectedValues = new Set<string>();
                let onSelectionChange = (newValues: Set<string>) => {};
                let dbColName = col.id;

                if (col.id === 'owner') {
                    baseOptions = filterOptions?.owners || [];
                    selectedValues = selectedOwners;
                    onSelectionChange = handleSetOwners;
                    dbColName = 'sales_owner_id';
                } else if (col.id === 'status') {
                    baseOptions = stageStatuses;
                    selectedValues = selectedStatuses;
                    onSelectionChange = handleSetStatuses;
                    dbColName = 'status';
                } else if (col.id === 'product_purchased') {
                    baseOptions = filterOptions?.products || [];
                    selectedValues = selectedProducts;
                    onSelectionChange = handleSetProducts;
                    dbColName = 'product_purchased';
                } else if (col.id === 'property_type') {
                    baseOptions = REAL_ESTATE_PROPERTY_TYPES.map(t => ({ label: t, value: t }));
                    selectedValues = selectedPropertyTypes;
                    onSelectionChange = handleSetPropertyTypes;
                    dbColName = 'property_type';
                } else {
                    baseOptions = filterOptions?.dynamic?.[col.id] || [];
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

                let options = baseOptions;
                const allowedValues = facetedOptions?.[dbColName];
                if (allowedValues && Array.isArray(allowedValues) && allowedValues.length > 0) {
                    const norm = (v: any) => String(v || '').toLowerCase().trim().replace(/[_\s-]+/g, '');
                    const allowedNormSet = new Set(allowedValues.map(v => norm(v)));
                    const filtered = baseOptions.filter(opt =>
                        allowedNormSet.has(norm(opt.value)) ||
                        allowedNormSet.has(norm(opt.label)) ||
                        selectedValues.has(opt.value)
                    );
                    if (filtered.length > 0) {
                        options = filtered;
                    }
                }

                return {
                    id: col.id,
                    label: col.label,
                    options,
                    selectedValues,
                    onSelectionChange
                };
            });
    }, [
        filterableColumns,
        filterOptions,
        stageStatuses,
        selectedOwners,
        selectedStatuses,
        selectedProducts,
        selectedPropertyTypes,
        searchParams,
        facetedOptions,
        isRealEstate,
        handleSetOwners,
        handleSetStatuses,
        handleSetProducts,
        handleSetPropertyTypes,
        setSearchParams
    ]);

    // Data queries with server-side pagination & filters
    const genericLeadsQuery = useLeads({
        search: searchQuery,
        statusFilter: effectiveStatusFilter,
        ownerFilter: Array.from(selectedOwners),
        activeOwnerIds,
        productFilter: Array.from(selectedProducts),
        page,
        pageSize,
        dynamicFilters,
        excludeHistory: true,
        accessibleUserIds,
        canViewAll,
        enabled: !isRealEstate
    });

    const realEstateLeadsQuery = useRealEstateLeads({
        search: searchQuery,
        statusFilter: effectiveStatusFilter,
        ownerFilter: Array.from(selectedOwners),
        activeOwnerIds,
        propertyTypeFilter: Array.from(selectedPropertyTypes),
        page,
        pageSize,
        accessibleUserIds,
        canViewAll,
        enabled: isRealEstate
    });

    const isLoading = isRealEstate ? realEstateLeadsQuery.isLoading : genericLeadsQuery.isLoading;
    const isTableLoading = isLoading || hierarchyLoading;
    const refetch = isRealEstate ? realEstateLeadsQuery.refetch : genericLeadsQuery.refetch;
    const leads = isRealEstate
        ? (realEstateLeadsQuery.data?.leads || [])
        : (genericLeadsQuery.data?.leads || []);
    const totalCount = isRealEstate
        ? (realEstateLeadsQuery.data?.count || 0)
        : (genericLeadsQuery.data?.count || 0);
    const totalPages = Math.ceil(totalCount / pageSize);

    const toggleLead = (id: string) => {
        const newSelected = new Set(selectedLeads);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedLeads(newSelected);
    };

    const handleDeleteLeads = async () => {
        if (!confirm('Are you sure you want to delete the selected leads? This action cannot be undone.')) {
            return;
        }

        try {
            const leadIds = Array.from(selectedLeads);
            const { error } = await executeInChunks(leadIds, (chunk) =>
                supabase
                    .from(tableName as any)
                    .delete()
                    .in('id', chunk)
            );

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
        const newStatus = allStatuses?.find(s => s.value === newStatusValue);

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

    const visibleColumns = defaultColumns.filter(col => {
        if (!columnConfig) return !col.defaultHidden;
        const configItem = columnConfig.find((c: any) => c.id === col.id);
        return configItem ? configItem.visible : !col.defaultHidden;
    }).sort((a, b) => {
        if (!columnConfig) return 0;
        const indexA = columnConfig.findIndex((c: any) => c.id === a.id);
        const indexB = columnConfig.findIndex((c: any) => c.id === b.id);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    return (
        <>
            <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
                <MobileLeadsHeader
                    title="Paid Leads"
                    searchValue={localSearch}
                    onSearchChange={setLocalSearch}
                    activeFilters={activeFilters}
                    onResetFilters={handleResetFilters}
                    selectedCount={selectedLeads.size}
                    onDelete={handleDeleteLeads}
                    onAssign={() => setAssignDialogOpen(true)}
                    canDelete={userRole === 'company' || userRole === 'company_subadmin'}
                    onEditLayout={userRole === 'company' || userRole === 'company_subadmin' ? () => setConfigOpen(true) : undefined}
                />

                {/* Mobile Card View */}
                {isMobile ? (
                    <div className="space-y-3">
                        {leads.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <p>No paid leads found.</p>
                            </div>
                        ) : (
                            leads.map((lead: any) => (
                                <SwipeableLeadCard
                                    key={lead.id}
                                    lead={lead}
                                    isSelected={selectedLeads.has(lead.id)}
                                    onToggleSelect={() => toggleLead(lead.id)}
                                    onViewDetails={() => setViewingLead(lead)}
                                    onEdit={() => setEditingLead(lead)}
                                    onChat={() => setChatLead(lead)}
                                    onStatusChange={(status) => handleStatusChange(lead.id, status)}
                                    owners={filterOptions?.owners}
                                    variant={isRealEstate ? 'real_estate' : 'education'}
                                    visibleAttributes={visibleColumns}
                                    maskLeads={company?.mask_leads}
                                />
                            ))
                        )}
                    </div>
                ) : (
                    /* Desktop Table View */
                    <Card>
                        <CardContent className="pt-6">
                            {isRealEstate ? (
                                <RealEstateLeadsTable
                                    leads={leads as any}
                                    loading={isTableLoading}
                                    selectedLeads={selectedLeads}
                                    onSelectionChange={setSelectedLeads}
                                    owners={filterOptions?.owners}
                                    onRefetch={refetch}
                                    columnConfig={columnConfig}
                                    maskLeads={company?.mask_leads}
                                />
                            ) : (
                                <LeadsTable
                                    leads={leads as any}
                                    loading={isTableLoading}
                                    selectedLeads={selectedLeads}
                                    onSelectionChange={setSelectedLeads}
                                    owners={filterOptions?.owners || []}
                                    columnConfig={columnConfig}
                                    maskLeads={company?.mask_leads}
                                    customColumns={customColumns}
                                />
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div>
                            Showing {totalCount > 0 ? ((page - 1) * pageSize) + 1 : 0} to {Math.min(page * pageSize, totalCount)} of {totalCount} leads
                        </div>
                        <div className="flex items-center gap-2">
                            <span>Per page:</span>
                            <Select
                                value={pageSize.toString()}
                                onValueChange={handlePageSizeChange}
                            >
                                <SelectTrigger className="h-8 w-[70px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[25, 50, 100, 250, 500, 1000].map(size => (
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
                            disabled={page === 1 || isTableLoading}
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
                            disabled={page >= totalPages || totalPages === 0 || isTableLoading}
                        >
                            <span className="hidden sm:inline mr-1">Next</span>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <OmnichannelLeadDrawer
                open={!!chatLead}
                onOpenChange={(open) => !open && setChatLead(null)}
                lead={chatLead}
                onViewDetails={(lead) => setViewingLead(lead)}
            />

            {isRealEstate ? (
                <>
                    <RealEstateAssignLeadsDialog
                        open={assignDialogOpen}
                        onOpenChange={setAssignDialogOpen}
                        selectedLeadIds={Array.from(selectedLeads)}
                        onSuccess={() => {
                            setSelectedLeads(new Set());
                            refetch();
                        }}
                    />
                    <RealEstateEditLeadDialog
                        open={!!editingLead}
                        onOpenChange={(open) => !open && setEditingLead(null)}
                        lead={editingLead}
                        onSuccess={refetch}
                    />
                    <RealEstateLeadDetailsDialog
                        open={!!viewingLead}
                        onOpenChange={(open) => !open && setViewingLead(null)}
                        lead={viewingLead}
                        owners={filterOptions?.owners || []}
                        maskLeads={company?.mask_leads}
                    />
                </>
            ) : (
                <>
                    <AssignLeadsDialog
                        open={assignDialogOpen}
                        onOpenChange={setAssignDialogOpen}
                        selectedLeadIds={Array.from(selectedLeads)}
                        onSuccess={() => {
                            setSelectedLeads(new Set());
                            refetch();
                        }}
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
                </>
            )}

            <ColumnConfigDialog
                open={configOpen}
                onOpenChange={setConfigOpen}
                tableId="paid_leads"
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
