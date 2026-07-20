import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, Database } from '@/integrations/supabase/types';
import { useLeadsTable } from './useLeadsTable';
import { automationService } from '@/services/automationService';

export type Lead = Tables<'leads'> & Partial<Tables<'leads_real_estate'>> & {
  sales_owner?: {
    full_name: string | null;
  } | null;
  reminder_at?: string | null;
  notes?: string | null;
};
type LeadStatus = Database['public']['Enums']['lead_status'];

interface UseLeadsOptions {
  search?: string;
  statusFilter?: string | string[];
  ownerFilter?: string[];
  /** All currently active owner IDs — used to compute the 'unassigned' (deleted user) filter */
  activeOwnerIds?: string[];
  productFilter?: string[];
  page?: number;
  pageSize?: number;
  fetchAll?: boolean;
  limit?: number;
  pendingPaymentOnly?: boolean;
  dynamicFilters?: Record<string, string[]>;
}

async function fetchLeadsData({
  tableName,
  companyId,
  search,
  statusFilter,
  ownerFilter,
  activeOwnerIds,
  productFilter,
  pendingPaymentOnly,
  page,
  pageSize,
  fetchAll,
  limit,
  dynamicFilters
}: {
  tableName: string;
  companyId: string;
  search?: string;
  statusFilter?: string | string[];
  ownerFilter?: string[];
  activeOwnerIds?: string[];
  productFilter?: string[];
  pendingPaymentOnly?: boolean;
  page: number;
  pageSize: number;
  fetchAll: boolean;
  limit?: number;
  dynamicFilters?: Record<string, string[]>;
}): Promise<{ leads: Lead[]; count: number }> {
  // Early exit if no company context
  if (!companyId) {
    console.warn('[useLeads] No company context - returning empty results');
    return { leads: [], count: 0 };
  }

  // Build select query with dynamic foreign key reference
  const selectQuery = tableName === 'leads'
    ? '*, sales_owner:profiles!leads_sales_owner_id_fkey(full_name)'
    : '*';

  let query = supabase
    .from(tableName as any)
    .select(selectQuery, { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  // CRITICAL: Enforce company isolation for all lead tables
  query = query.eq('company_id', companyId);

  if (statusFilter) {
    if (Array.isArray(statusFilter)) {
      if (statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }
    } else if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as LeadStatus);
    }
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

  if (pendingPaymentOnly) {
    query = query.gt('revenue_received', 0);
  }

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,college.ilike.%${search}%`
    );
  }

  if (fetchAll) {
    let allLeads: Lead[] = [];
    let hasMore = true;
    const CHUNK_SIZE = 1000;
    while (hasMore) {
      const from = allLeads.length;
      let fetchSize = CHUNK_SIZE;

      if (limit && limit > 0) {
        const remaining = limit - from;
        if (remaining <= 0) {
          hasMore = false;
          break;
        }
        fetchSize = Math.min(CHUNK_SIZE, remaining);
      }

      const to = from + fetchSize - 1;

      // Clone the base query for this chunk
      let chunkQuery = supabase
        .from(tableName as any)
        .select(selectQuery, { count: 'exact' });

      // Re-apply filters to chunkQuery
      chunkQuery = chunkQuery.eq('company_id', companyId);
      if (statusFilter) {
        if (Array.isArray(statusFilter)) {
          if (statusFilter.length > 0) chunkQuery = chunkQuery.in('status', statusFilter);
        } else if (statusFilter !== 'all') {
          chunkQuery = chunkQuery.eq('status', statusFilter as LeadStatus);
        }
      }
      if (ownerFilter && ownerFilter.length > 0) {
        const hasUnassigned = ownerFilter.includes('unassigned');
        const realOwnerIds = ownerFilter.filter(id => id !== 'unassigned');
        if (hasUnassigned) {
          if (activeOwnerIds && activeOwnerIds.length > 0) {
            const activeIdList = activeOwnerIds.join(',');
            if (realOwnerIds.length > 0) {
              chunkQuery = chunkQuery.or(`sales_owner_id.is.null,sales_owner_id.not.in.(${activeIdList}),sales_owner_id.in.(${realOwnerIds.join(',')})`);
            } else {
              chunkQuery = chunkQuery.or(`sales_owner_id.is.null,sales_owner_id.not.in.(${activeIdList})`);
            }
          } else {
            if (realOwnerIds.length > 0) {
              chunkQuery = chunkQuery.or(`sales_owner_id.is.null,sales_owner_id.in.(${realOwnerIds.join(',')})`);
            } else {
              chunkQuery = chunkQuery.is('sales_owner_id', null);
            }
          }
        } else {
          chunkQuery = chunkQuery.in('sales_owner_id', realOwnerIds);
        }
      }
      if (productFilter && productFilter.length > 0) chunkQuery = chunkQuery.in('product_purchased', productFilter);
      if (dynamicFilters) {
        Object.entries(dynamicFilters).forEach(([colId, values]) => {
          if (values && values.length > 0) {
            chunkQuery = chunkQuery.in(colId, values);
          }
        });
      }
      if (pendingPaymentOnly) chunkQuery = chunkQuery.gt('revenue_received', 0);
      if (search) {
        chunkQuery = chunkQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,college.ilike.%${search}%`);
      }

      chunkQuery = chunkQuery.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to);

      const { data: chunkData, error: chunkError } = await chunkQuery;

      if (chunkError) {
        console.error('[useLeads] Chunk query error:', chunkError);
        throw chunkError;
      }

      if (chunkData) {
        const fetched = chunkData as unknown as Lead[];
        allLeads = [...allLeads, ...fetched];
        if (fetched.length < fetchSize || (limit && limit > 0 && allLeads.length >= limit)) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    return { leads: allLeads, count: allLeads.length };
  }

  // Normal pagination logic
  let from = (page - 1) * pageSize;
  let to = from + pageSize - 1;

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('[useLeads] Query error:', error);
    throw error;
  }

  return { leads: (data as unknown as Lead[]) || [], count: count || 0 };
}

export function useLeads({ search, statusFilter, ownerFilter, activeOwnerIds, productFilter, pendingPaymentOnly, page = 1, pageSize = 25, fetchAll = false, limit, dynamicFilters }: UseLeadsOptions = {}) {
  const queryClient = useQueryClient();
  const { tableName, companyId, loading: tableLoading } = useLeadsTable();

  const queryKey = ['leads', search, statusFilter, ownerFilter, activeOwnerIds, productFilter, pendingPaymentOnly, page, pageSize, fetchAll, limit, tableName, companyId, JSON.stringify(dynamicFilters)];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchLeadsData({
      tableName: tableName!,
      companyId: companyId!,
      search,
      statusFilter,
      ownerFilter,
      activeOwnerIds,
      productFilter,
      pendingPaymentOnly,
      page,
      pageSize,
      fetchAll,
      limit,
      dynamicFilters
    }),
    enabled: !tableLoading && !!companyId,
    placeholderData: (previousData) => previousData,
    retry: 2,
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
  });

  // Prefetch the next page
  useEffect(() => {
    if (!fetchAll && query.data && query.data.count > page * pageSize && companyId && tableName) {
      const nextPage = page + 1;
      const nextQueryKey = ['leads', search, statusFilter, ownerFilter, activeOwnerIds, productFilter, pendingPaymentOnly, nextPage, pageSize, fetchAll, limit, tableName, companyId, JSON.stringify(dynamicFilters)];
      queryClient.prefetchQuery({
        queryKey: nextQueryKey,
        queryFn: () => fetchLeadsData({
          tableName: tableName!,
          companyId: companyId!,
          search,
          statusFilter,
          ownerFilter,
          activeOwnerIds,
          productFilter,
          pendingPaymentOnly,
          page: nextPage,
          pageSize,
          fetchAll,
          limit,
          dynamicFilters
        }),
        staleTime: 60000,
      });
    }
  }, [query.data, page, pageSize, fetchAll, search, statusFilter, ownerFilter, activeOwnerIds, productFilter, pendingPaymentOnly, tableName, companyId, queryClient, JSON.stringify(dynamicFilters)]);

  return {
    ...query,
    isLoading: query.isLoading || tableLoading
  };
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  const { tableName } = useLeadsTable();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Lead>) => {
      const { data, error } = await supabase
        .from(tableName as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Lead;
    },
    onMutate: async (newLeadData) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['leads'] });

      // Snapshot the previous values
      const previousQueries = queryClient.getQueriesData({ queryKey: ['leads'] });

      // Optimistically update to the new value in all cached leads queries
      queryClient.setQueriesData({ queryKey: ['leads'] }, (old: any) => {
        if (!old || !old.leads) return old;
        return {
          ...old,
          leads: old.leads.map((lead: any) =>
            lead.id === newLeadData.id ? { ...lead, ...newLeadData } : lead
          ),
        };
      });

      // Return a context object with the snapshotted value
      return { previousQueries };
    },
    onError: (err, newLeadData, context: any) => {
      // Rollback on error
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, value]: any) => {
          queryClient.setQueryData(queryKey, value);
        });
      }
    },
    onSuccess: (data) => {
      // Trigger Automation: Status Changed
      if (data.status) {
        automationService.checkAndRunAutomations('status_changed', data);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to guarantee sync
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  const { tableName } = useLeadsTable();

  return useMutation({
    mutationFn: async (newLead: TablesInsert<'leads'>) => {
      const { data, error } = await supabase
        .from(tableName as any)
        .insert(newLead)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Lead;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      // Trigger Automation: Lead Created
      automationService.checkAndRunAutomations('lead_created', data);
    },
  });
}

export function useCreateLeads() {
  const queryClient = useQueryClient();
  const { tableName } = useLeadsTable();

  return useMutation({
    mutationFn: async (newLeads: TablesInsert<'leads'>[]) => {
      const { data, error } = await supabase
        .from(tableName as any)
        .insert(newLeads)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      // Trigger Automation for each new lead
      if (data && Array.isArray(data)) {
        data.forEach(lead => automationService.checkAndRunAutomations('lead_created', lead));
      }
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  const { tableName } = useLeadsTable();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
