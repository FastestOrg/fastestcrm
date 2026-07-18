import { useState } from 'react';
// DashboardLayout removed
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { useCompany } from '@/hooks/useCompany';
import { Tables } from '@/integrations/supabase/types';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { RealEstateLeadsTable } from '@/industries/real_estate/components/RealEstateLeadsTable';
import { useRealEstateLeads } from '@/industries/real_estate/hooks/useRealEstateLeads';
import { RealEstateAssignLeadsDialog } from '@/industries/real_estate/components/RealEstateAssignLeadsDialog';
import { SwipeableLeadCard } from '@/components/leads/SwipeableLeadCard';
import { MobileLeadsHeader } from '@/components/leads/MobileLeadsHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { EditLeadDialog } from '@/components/leads/EditLeadDialog';
import { LeadDetailsDialog } from '@/components/leads/LeadDetailsDialog';
import { toast } from 'sonner';
import { useLeadsTable } from '@/hooks/useLeadsTable';
import { ColumnConfigDialog } from '@/components/leads/ColumnConfigDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { useCustomColumns } from '@/hooks/useCustomColumns';

type Lead = Tables<'leads'> & {
    sales_owner?: {
        full_name: string | null;
    } | null;
};

export default function Interested() {
    const { company } = useCompany();
    const isMobile = useIsMobile();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<any>(null);
    const [viewingLead, setViewingLead] = useState<any>(null);
    const { tableName } = useLeadsTable();
    const { data: userRole } = useUserRole();
    const [configOpen, setConfigOpen] = useState(false);
    const { customColumns } = useCustomColumns();

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
    const columnConfig = (company as any)?.features?.table_configs?.['interested_leads'];

    // Fetch confirmed 'interested' statuses
    const { data: interestedStatuses } = useQuery({
        queryKey: ['interested-statuses', company?.id],
        queryFn: async () => {
            if (!company?.id) return [];
            const { data } = await supabase
                .from('company_lead_statuses' as any)
                .select('value')
                .eq('company_id', company.id)
                .eq('category', 'interested');

            const statuses = data?.map((s: any) => s.value) || [];
            return statuses.length > 0 ? statuses : ['interested'];
        },
        enabled: !!company?.id
    });

    const statusFilter = interestedStatuses && interestedStatuses.length > 0 ? interestedStatuses : ['interested'];

    const hookOptions = {
        search: searchQuery,
        statusFilter: statusFilter
    };

    const genericLeadsQuery = useLeads(hookOptions);
    const realEstateLeadsQuery = useRealEstateLeads(hookOptions);

    const isLoading = isRealEstate ? realEstateLeadsQuery.isLoading : genericLeadsQuery.isLoading;
    const refetch = isRealEstate ? realEstateLeadsQuery.refetch : genericLeadsQuery.refetch;
    const leads = isRealEstate
        ? (realEstateLeadsQuery.data?.leads || [])
        : (genericLeadsQuery.data?.leads || []);

    // Filter Owners (for leads table)
    const { data: owners } = useQuery({
        queryKey: ['leadsFilterOptionsOwners', company?.id],
        queryFn: async () => {
            if (!company?.id) return [];

            const { data: ownersData } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('company_id', company.id)
                .not('full_name', 'is', null);

            let activeOwners = ownersData || [];

            if (activeOwners.length > 0) {
                const ownerIds = activeOwners.map(o => o.id);
                const { data: rolesData } = await supabase
                    .from('user_roles')
                    .select('user_id')
                    .in('user_id', ownerIds);

                const activeUserIds = new Set(rolesData?.map(r => r.user_id));
                activeOwners = activeOwners.filter(o => activeUserIds.has(o.id));
            }

            return activeOwners.map(o => ({ label: o.full_name || 'Unknown', value: o.id }));
        },
        enabled: !!company?.id
    });

    const toggleLead = (id: string) => {
        const newSelected = new Set(selectedLeads);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedLeads(newSelected);
    };

    const handleStatusChange = async (leadId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from(tableName as any)
                .update({ status: newStatus })
                .eq('id', leadId);

            if (error) throw error;
            toast.success('Status updated successfully');
            await refetch();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    if (isLoading) {
        return (
            <>
                <div className="flex items-center justify-center h-screen">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </>
        );
    }

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
                    title={isRealEstate ? "Site Visited" : "Interested Leads"}
                    searchValue={searchQuery}
                    onSearchChange={setSearchQuery}
                    filterOptions={owners ? { owners } : undefined}
                    selectedCount={selectedLeads.size}
                    onAssign={() => setAssignDialogOpen(true)}
                    onEditLayout={userRole === 'company' || userRole === 'company_subadmin' ? () => setConfigOpen(true) : undefined}
                />

                {/* Mobile Card View */}
                {isMobile ? (
                    <div className="space-y-3">
                        {leads.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <p>No {isRealEstate ? 'site visited' : 'interested'} leads found.</p>
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
                                    onStatusChange={(status) => handleStatusChange(lead.id, status)}
                                    owners={owners}
                                    variant={isRealEstate ? 'real_estate' : 'education'}
                                    visibleAttributes={visibleColumns}
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
                                    leads={realEstateLeadsQuery.data?.leads || []}
                                    loading={realEstateLeadsQuery.isLoading}
                                    selectedLeads={selectedLeads}
                                    onSelectionChange={setSelectedLeads}
                                    owners={owners}
                                    onRefetch={realEstateLeadsQuery.refetch}
                                    columnConfig={columnConfig}
                                />
                            ) : (
                                <LeadsTable
                                    leads={(genericLeadsQuery.data?.leads || []) as Lead[]}
                                    loading={genericLeadsQuery.isLoading}
                                    selectedLeads={selectedLeads}
                                    onSelectionChange={setSelectedLeads}
                                    owners={owners}
                                    columnConfig={columnConfig}
                                    customColumns={customColumns}
                                />
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {isRealEstate && (
                <RealEstateAssignLeadsDialog
                    open={assignDialogOpen}
                    onOpenChange={setAssignDialogOpen}
                    selectedLeadIds={Array.from(selectedLeads)}
                    onSuccess={() => setSelectedLeads(new Set())}
                />
            )}

            <EditLeadDialog
                open={!!editingLead}
                onOpenChange={(open) => !open && setEditingLead(null)}
                lead={editingLead}
            />

            <LeadDetailsDialog
                open={!!viewingLead}
                onOpenChange={(open) => !open && setViewingLead(null)}
                lead={viewingLead}
                owners={owners || []}
            />

            <ColumnConfigDialog
                open={configOpen}
                onOpenChange={setConfigOpen}
                tableId="interested_leads"
                defaultColumns={defaultColumns}
            />
        </>
    );
}
