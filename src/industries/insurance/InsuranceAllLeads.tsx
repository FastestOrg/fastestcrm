import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, ChevronLeft, ChevronRight, LayoutGrid, Table2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useUserRole } from '@/hooks/useUserRole';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { InsuranceLeadsTable } from './components/InsuranceLeadsTable';
import { InsuranceAddLeadDialog } from './components/InsuranceAddLeadDialog';
import { InsuranceUploadLeadsDialog } from './components/InsuranceUploadLeadsDialog';
import { InsuranceAssignLeadsDialog } from './components/InsuranceAssignLeadsDialog';
import { InsuranceEditLeadDialog } from './components/InsuranceEditLeadDialog';
import { InsuranceLeadDetailsDialog } from './components/InsuranceLeadDetailsDialog';
import { useHierarchy } from '@/hooks/useHierarchy';
import { useInsuranceLeads } from './hooks/useInsuranceLeads';
import { INSURANCE_TYPES } from './config';
import { MobileLeadsHeader } from '@/components/leads/MobileLeadsHeader';
import { SwipeableLeadCard } from '@/components/leads/SwipeableLeadCard';
import { FloatingAddButton } from '@/components/leads/FloatingAddButton';
import { ColumnConfigDialog } from '@/components/leads/ColumnConfigDialog';
import { LeadsKanbanBoard } from '@/components/leads/LeadsKanbanBoard';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';

export default function InsuranceAllLeads() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedInsuranceTypes, setSelectedInsuranceTypes] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const handlePageSizeChange = (value: string) => {
    const size = parseInt(value, 10);
    setPageSize(size);
    setPage(1);
  };
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [viewingLead, setViewingLead] = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { company } = useCompany();
  const { data: userRole } = useUserRole();
  const isMobile = useIsMobile();
  const [configOpen, setConfigOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const { statuses } = useLeadStatuses();

  const defaultColumns = [
    { id: 'name', label: 'Name' },
    { id: 'phone', label: 'Phone' },
    { id: 'age', label: 'Age' },
    { id: 'insurance_type', label: 'Insurance Type' },
    { id: 'plan_name', label: 'Plan' },
    { id: 'premium_amount', label: 'Premium' },
    { id: 'contribution_frequency', label: 'Frequency' },
    { id: 'status', label: 'Status' },
    { id: 'sales_owner', label: 'Sales Owner' },
    { id: 'notes', label: 'Notes' },
    { id: 'created_at', label: 'Date' },
    { id: 'email', label: 'Email', defaultHidden: true },
    { id: 'gender', label: 'Gender', defaultHidden: true },
    { id: 'pan_number', label: 'PAN', defaultHidden: true },
    { id: 'occupation', label: 'Occupation', defaultHidden: true },
    { id: 'annual_income', label: 'Annual Income', defaultHidden: true },
    { id: 'sum_insured', label: 'Sum Insured', defaultHidden: true },
    { id: 'policy_term', label: 'Term', defaultHidden: true },
    { id: 'nominee_name', label: 'Nominee', defaultHidden: true },
    { id: 'policy_number', label: 'Policy #', defaultHidden: true },
    { id: 'renewal_date', label: 'Renewal', defaultHidden: true },
    { id: 'pre_sales_owner', label: 'Pre-Sales', defaultHidden: true },
    { id: 'post_sales_owner', label: 'Post-Sales', defaultHidden: true },
  ];

  const columnConfig = (company as any)?.features?.table_configs?.['insurance_leads'];
  const { accessibleUserIds, canViewAll, loading: hierarchyLoading } = useHierarchy();

  const { data: filterOptions } = useQuery({
    queryKey: ['insuranceLeadsFilterOptions', company?.id, canViewAll, accessibleUserIds, hierarchyLoading],
    queryFn: async () => {
      if (!company?.id) return null;
      const [ownersResult, statusesResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('company_id', company.id).not('full_name', 'is', null),
        supabase.from('company_lead_statuses' as any).select('label, value, category, order_index').eq('company_id', company.id).order('order_index'),
      ]);
      let activeOwners = ownersResult.data || [];
      if (activeOwners.length > 0) {
        const { data: rolesData } = await supabase.from('user_roles').select('user_id').in('user_id', activeOwners.map(o => o.id));
        const activeIds = new Set(rolesData?.map(r => r.user_id));
        activeOwners = activeOwners.filter(o => activeIds.has(o.id));
      }
      if (!hierarchyLoading && !canViewAll && accessibleUserIds.length > 0) {
        const accessibleSet = new Set(accessibleUserIds);
        activeOwners = activeOwners.filter(o => accessibleSet.has(o.id));
      }
      return {
        owners: activeOwners.map(o => ({ label: o.full_name || 'Unknown', value: o.id })),
        statuses: (statusesResult.data as any[] || []).map((s: any) => ({ label: s.label, value: s.value, group: s.category })),
        insuranceTypes: INSURANCE_TYPES.map(t => ({ label: t, value: t })),
      };
    },
    enabled: !!company?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: leadsData, isLoading, refetch } = useInsuranceLeads({
    search: debouncedSearchQuery,
    statusFilter: selectedStatuses.size === 1 ? Array.from(selectedStatuses)[0] : undefined,
    ownerFilter: Array.from(selectedOwners),
    insuranceTypeFilter: Array.from(selectedInsuranceTypes),
    page, pageSize, accessibleUserIds, canViewAll,
  });

  const leads = leadsData?.leads || [];
  const totalCount = leadsData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleDeleteLeads = async () => {
    if (!confirm('Delete selected leads? This cannot be undone.')) return;
    try {
      const { error } = await supabase.from('leads_insurance' as any).delete().in('id', Array.from(selectedLeads));
      if (error) throw error;
      toast.success(`Deleted ${selectedLeads.size} leads`);
      setSelectedLeads(new Set()); await refetch();
    } catch { toast.error('Failed to delete leads'); }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('leads_insurance' as any).update({ status: newStatus }).eq('id', leadId);
      if (error) throw error;
      toast.success('Status updated'); await refetch();
    } catch { toast.error('Failed to update status'); }
  };

  const toggleLead = (id: string) => {
    const newSet = new Set(selectedLeads);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedLeads(newSet);
  };

  const visibleColumns = defaultColumns.filter(col => {
    if (!columnConfig) return !(col as any).defaultHidden;
    const cfg = columnConfig.find((c: any) => c.id === col.id);
    return cfg ? cfg.visible : !(col as any).defaultHidden;
  }).map(col => ({ ...col, visible: true }));

  return (
    <>
      <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
        <MobileLeadsHeader
          title="Insurance Leads"
          icon={<Shield className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          filterOptions={filterOptions ? { owners: filterOptions.owners, statuses: filterOptions.statuses } : undefined}
          selectedOwners={selectedOwners}
          onOwnersChange={setSelectedOwners}
          selectedStatuses={selectedStatuses}
          onStatusesChange={setSelectedStatuses}
          selectedCount={selectedLeads.size}
          onDelete={handleDeleteLeads}
          onAssign={() => setAssignDialogOpen(true)}
          canDelete={userRole === 'company' || userRole === 'company_subadmin'}
          addButton={!isMobile ? (
            <div className="flex items-center gap-2"><InsuranceUploadLeadsDialog /><InsuranceAddLeadDialog /></div>
          ) : null}
          onEditLayout={userRole === 'company' || userRole === 'company_subadmin' ? () => setConfigOpen(true) : undefined}
        />

        {!isMobile && (
          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 w-fit">
            <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" className="h-8 px-3 gap-1.5" onClick={() => setViewMode('table')}><Table2 className="h-4 w-4" /> Table</Button>
            <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" className="h-8 px-3 gap-1.5" onClick={() => setViewMode('kanban')}><LayoutGrid className="h-4 w-4" /> Kanban</Button>
          </div>
        )}

        {isMobile ? (
          <div className="space-y-3">
            {leads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><p>No leads found. Add your first insurance lead!</p></div>
            ) : leads.map((lead) => (
              <SwipeableLeadCard key={lead.id} lead={lead} isSelected={selectedLeads.has(lead.id)}
                onToggleSelect={() => toggleLead(lead.id)} onViewDetails={() => setViewingLead(lead)}
                onEdit={() => setEditingLead(lead)} onStatusChange={(status) => handleStatusChange(lead.id, status)}
                owners={filterOptions?.owners} visibleAttributes={visibleColumns} maskLeads={company?.mask_leads} />
            ))}
          </div>
        ) : viewMode === 'kanban' ? (
          <LeadsKanbanBoard statuses={statuses} loading={isLoading} onStatusChange={handleStatusChange}
            onLeadClick={(lead) => setViewingLead(lead)} owners={filterOptions?.owners}
            searchQuery={debouncedSearchQuery} ownerFilter={Array.from(selectedOwners)} />
        ) : (
          <Card><CardContent className="pt-6">
            <InsuranceLeadsTable leads={leads} loading={isLoading} selectedLeads={selectedLeads}
              onSelectionChange={setSelectedLeads} owners={filterOptions?.owners || []} onRefetch={refetch}
              onViewDetails={(lead) => setViewingLead(lead)} onEditLead={(lead) => setEditingLead(lead)}
              columnConfig={columnConfig} maskLeads={company?.mask_leads} />
          </CardContent></Card>
        )}

        {viewMode === 'table' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="text-sm text-muted-foreground">Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}</div>
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
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}><ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline ml-1">Previous</span></Button>
              <div className="text-sm font-medium px-2">{page} / {totalPages || 1}</div>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || isLoading}><span className="hidden sm:inline mr-1">Next</span><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>

      <InsuranceAssignLeadsDialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen} selectedLeadIds={Array.from(selectedLeads)} onSuccess={() => setSelectedLeads(new Set())} />
      <InsuranceEditLeadDialog open={!!editingLead} onOpenChange={(open) => !open && setEditingLead(null)} lead={editingLead} onSuccess={refetch} />
      <InsuranceLeadDetailsDialog open={!!viewingLead} onOpenChange={(open) => !open && setViewingLead(null)} lead={viewingLead} owners={filterOptions?.owners || []} maskLeads={company?.mask_leads} />
      {isMobile && <FloatingAddButton onClick={() => setAddDialogOpen(true)} />}
      <InsuranceAddLeadDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <ColumnConfigDialog open={configOpen} onOpenChange={setConfigOpen} tableId="insurance_leads" defaultColumns={defaultColumns} />
    </>
  );
}
