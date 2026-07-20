import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, User, Clock, GripVertical, Loader2, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { Lead } from '@/hooks/useLeads';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLeadsTable } from '@/hooks/useLeadsTable';

const PER_STATUS_LIMIT = 10;

interface LeadsKanbanBoardProps {
  statuses: CompanyLeadStatus[];
  loading: boolean;
  onStatusChange: (leadId: string, newStatus: string) => void;
  onLeadClick?: (lead: Lead) => void;
  owners?: { label: string; value: string }[];
  searchQuery?: string;
  ownerFilter?: string[];
  activeOwnerIds?: string[];
  productFilter?: string[];
  dynamicFilters?: Record<string, string[]>;
}

// Hook to fetch leads for a single status column
function useStatusLeads(
  statusValue: string,
  companyId: string | undefined,
  tableName: string,
  limit: number,
  searchQuery?: string,
  ownerFilter?: string[],
  activeOwnerIds?: string[],
  productFilter?: string[],
  dynamicFilters?: Record<string, string[]>,
) {
  return useQuery({
    queryKey: ['kanban-leads', statusValue, companyId, tableName, limit, searchQuery, ownerFilter, activeOwnerIds, productFilter, JSON.stringify(dynamicFilters)],
    queryFn: async (): Promise<{ leads: Lead[]; totalCount: number }> => {
      if (!companyId) return { leads: [], totalCount: 0 };

      const selectQuery = tableName === 'leads'
        ? '*, sales_owner:profiles!leads_sales_owner_id_fkey(full_name)'
        : tableName === 'leads_real_estate'
        ? '*, sales_owner:profiles!leads_real_estate_sales_owner_id_fkey(full_name)'
        : tableName === 'leads_saas'
        ? '*, sales_owner:profiles!leads_saas_sales_owner_id_fkey(full_name)'
        : tableName === 'leads_healthcare'
        ? '*, sales_owner:profiles!leads_healthcare_sales_owner_id_fkey(full_name)'
        : tableName === 'leads_insurance'
        ? '*, sales_owner:profiles!leads_insurance_sales_owner_id_fkey(full_name)'
        : tableName === 'leads_travel'
        ? '*, sales_owner:profiles!leads_travel_sales_owner_id_fkey(full_name)'
        : '*';

      let query = supabase
        .from(tableName as any)
        .select(selectQuery, { count: 'exact' })
        .eq('company_id', companyId)
        .eq('status', statusValue)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(0, limit - 1);

      if (searchQuery) {
        const searchFields = tableName === 'leads_real_estate'
          ? `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,property_name.ilike.%${searchQuery}%`
          : tableName === 'leads_saas'
          ? `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%`
          : tableName === 'leads_healthcare'
          ? `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,condition.ilike.%${searchQuery}%,department.ilike.%${searchQuery}%`
          : tableName === 'leads_insurance'
          ? `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,plan_name.ilike.%${searchQuery}%,insurance_type.ilike.%${searchQuery}%`
          : tableName === 'leads_travel'
          ? `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,destination.ilike.%${searchQuery}%,hotel_name.ilike.%${searchQuery}%`
          : `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,college.ilike.%${searchQuery}%`;
        query = query.or(searchFields);
      }

      if (ownerFilter && ownerFilter.length > 0) {
        const hasUnassigned = ownerFilter.includes('unassigned');
        const realOwnerIds = ownerFilter.filter(id => id !== 'unassigned');
        if (hasUnassigned) {
          if (activeOwnerIds && activeOwnerIds.length > 0) {
            const activeIdList = activeOwnerIds.join(',');
            if (realOwnerIds.length > 0) {
              query = query.or(`sales_owner_id.is.null,sales_owner_id.not.in.(${activeIdList}),sales_owner_id.in.(${realOwnerIds.join(',')})`);
            } else {
              query = query.or(`sales_owner_id.is.null,sales_owner_id.not.in.(${activeIdList})`);
            }
          } else {
            if (realOwnerIds.length > 0) {
              query = query.or(`sales_owner_id.is.null,sales_owner_id.in.(${realOwnerIds.join(',')})`);
            } else {
              query = query.is('sales_owner_id', null);
            }
          }
        } else {
          query = query.in('sales_owner_id', realOwnerIds);
        }
      }

      if (productFilter && productFilter.length > 0) {
        query = query.in('product_purchased', productFilter);
      }

      if (dynamicFilters) {
        Object.entries(dynamicFilters).forEach(([colId, values]) => {
          if (values && values.length > 0) {
            query = query.in(colId, values);
          }
        });
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { leads: (data as unknown as Lead[]) || [], totalCount: count || 0 };
    },
    enabled: !!companyId,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });
}

// Single column component that manages its own data
function KanbanStatusColumn({
  status,
  companyId,
  tableName,
  onStatusChange,
  onLeadClick,
  owners,
  searchQuery,
  ownerFilter,
  activeOwnerIds,
  productFilter,
  dynamicFilters,
  allLeadsForDrag,
  setColumnLeads,
}: {
  status: CompanyLeadStatus;
  companyId: string | undefined;
  tableName: string;
  onStatusChange: (leadId: string, newStatus: string) => void;
  onLeadClick?: (lead: Lead) => void;
  owners?: { label: string; value: string }[];
  searchQuery?: string;
  ownerFilter?: string[];
  activeOwnerIds?: string[];
  productFilter?: string[];
  dynamicFilters?: Record<string, string[]>;
  allLeadsForDrag: Lead[];
  setColumnLeads: (status: string, leads: Lead[], total: number) => void;
}) {
  const [visibleLimit, setVisibleLimit] = useState(PER_STATUS_LIMIT);

  const { data, isLoading } = useStatusLeads(
    status.value, companyId, tableName, visibleLimit,
    searchQuery, ownerFilter, activeOwnerIds, productFilter, dynamicFilters
  );

  const leads = data?.leads || [];
  const totalCount = data?.totalCount || 0;
  const hasMore = leads.length < totalCount;

  // Report leads to parent for drag-and-drop lookup - use useEffect to avoid render-phase side effects
  const leadsRef = { leads, totalCount, statusValue: status.value };
  if (leads.length > 0 || totalCount > 0) {
    // Deferred update to avoid cascading re-renders
    queueMicrotask(() => setColumnLeads(leadsRef.statusValue, leadsRef.leads, leadsRef.totalCount));
  }

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status.value}`,
    data: { status: status.value },
  });

  return (
    <div className="flex flex-col min-w-[280px] w-[280px] shrink-0">
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-t-lg border border-b-0 border-border"
        style={{ backgroundColor: `${status.color}15` }}
      >
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
        <span className="font-semibold text-sm truncate">{status.label}</span>
        <Badge variant="secondary" className="ml-auto text-xs shrink-0">
          {totalCount}
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 border border-border rounded-b-lg p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-260px)] overflow-y-auto transition-colors",
          isOver && "bg-primary/5 border-primary/30"
        )}
      >
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        ) : (
          <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
            {leads.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                Drop leads here
              </div>
            ) : (
              <>
                {leads.map(lead => (
                  <KanbanLeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={() => onLeadClick?.(lead)}
                    owners={owners}
                  />
                ))}
                {hasMore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground hover:text-foreground gap-1"
                    onClick={() => setVisibleLimit(prev => prev + PER_STATUS_LIMIT)}
                  >
                    <ChevronDown className="h-3 w-3" />
                    Load more ({totalCount - leads.length} remaining)
                  </Button>
                )}
              </>
            )}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

// Draggable lead card
function KanbanLeadCard({
  lead,
  onClick,
  owners,
  isDragging,
}: {
  lead: Lead;
  onClick?: () => void;
  owners?: { label: string; value: string }[];
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: lead.id,
    data: { lead, status: lead.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  const ownerName = lead.sales_owner?.full_name ||
    owners?.find(o => o.value === lead.sales_owner_id)?.label;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 cursor-pointer hover:shadow-md transition-shadow border border-border bg-card",
        isDragging && "shadow-lg ring-2 ring-primary/20"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="font-medium text-sm truncate">{lead.name}</p>

          {(lead.email || lead.phone) && (
            <div className="flex flex-col gap-0.5">
              {lead.email && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </span>
              )}
              {lead.phone && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" />
                  {lead.phone}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {ownerName && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">{ownerName}</span>
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Clock className="h-3 w-3" />
              {format(new Date(lead.created_at), 'dd MMM')}
            </span>
          </div>

          {lead.product_purchased && (
            <Badge variant="outline" className="text-xs mt-1">
              {lead.product_purchased}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

// Overlay card shown while dragging
function DragOverlayCard({ lead, owners }: { lead: Lead; owners?: { label: string; value: string }[] }) {
  const ownerName = lead.sales_owner?.full_name ||
    owners?.find(o => o.value === lead.sales_owner_id)?.label;

  return (
    <Card className="p-3 shadow-xl ring-2 ring-primary/30 w-[260px] bg-card border border-primary/20">
      <div className="space-y-1.5">
        <p className="font-medium text-sm truncate">{lead.name}</p>
        {lead.phone && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" /> {lead.phone}
          </span>
        )}
        {ownerName && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" /> {ownerName}
          </span>
        )}
      </div>
    </Card>
  );
}

export function LeadsKanbanBoard({
  statuses,
  loading,
  onStatusChange,
  onLeadClick,
  owners,
  searchQuery,
  ownerFilter,
  activeOwnerIds,
  productFilter,
  dynamicFilters,
}: LeadsKanbanBoardProps) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [allColumnLeads, setAllColumnLeads] = useState<Record<string, { leads: Lead[]; total: number }>>({});
  const { tableName, companyId } = useLeadsTable();
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const setColumnLeads = useCallback((status: string, leads: Lead[], total: number) => {
    setAllColumnLeads(prev => {
      // Avoid unnecessary re-renders
      if (prev[status]?.leads === leads) return prev;
      return { ...prev, [status]: { leads, total } };
    });
  }, []);

  // Flatten all leads for drag lookup
  const allLeads = useMemo(() => {
    return Object.values(allColumnLeads).flatMap(col => col.leads);
  }, [allColumnLeads]);

  const handleDragStart = (event: DragStartEvent) => {
    const lead = allLeads.find(l => l.id === event.active.id);
    setActiveLead(lead || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) return;

    let targetStatus: string | null = null;
    if (over.id.toString().startsWith('column-')) {
      targetStatus = over.id.toString().replace('column-', '');
    } else {
      const targetLead = allLeads.find(l => l.id === over.id);
      if (targetLead) targetStatus = targetLead.status;
    }

    if (targetStatus && targetStatus !== lead.status) {
      onStatusChange(leadId, targetStatus);
      // Invalidate both source and target columns
      queryClient.invalidateQueries({ queryKey: ['kanban-leads', lead.status] });
      queryClient.invalidateQueries({ queryKey: ['kanban-leads', targetStatus] });
    }
  };

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="min-w-[280px] space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
        {statuses.map(status => (
          <KanbanStatusColumn
            key={status.value}
            status={status}
            companyId={companyId}
            tableName={tableName}
            onStatusChange={onStatusChange}
            onLeadClick={onLeadClick}
            owners={owners}
            searchQuery={searchQuery}
            ownerFilter={ownerFilter}
            activeOwnerIds={activeOwnerIds}
            productFilter={productFilter}
            dynamicFilters={dynamicFilters}
            allLeadsForDrag={allLeads}
            setColumnLeads={setColumnLeads}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead ? (
          <DragOverlayCard lead={activeLead} owners={owners} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
