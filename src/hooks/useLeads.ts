import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, Database } from '@/integrations/supabase/types';
import { useLeadsTable } from './useLeadsTable';
import { useOrgClient } from './useOrgClient';
import { useHierarchy } from './useHierarchy';
import { automationService } from '@/services/automationService';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  excludeHistory?: boolean;
  accessibleUserIds?: string[];
  canViewAll?: boolean;
}

async function fetchLeadsData({
  client,
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
  dynamicFilters,
  excludeHistory,
  accessibleUserIds,
  canViewAll,
}: {
  client?: SupabaseClient<Database>;
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
  excludeHistory?: boolean;
  accessibleUserIds?: string[];
  canViewAll?: boolean;
}): Promise<{ leads: Lead[]; count: number }> {
  // Early exit if no company context
  if (!companyId) {
    console.warn('[useLeads] No company context - returning empty results');
    return { leads: [], count: 0 };
  }

const LEADS_NO_HISTORY_COLUMNS = [
  'id',
  'batch_month',
  'branch',
  'ca_name',
  'cgpa',
  'college',
  'company',
  'company_id',
  'created_at',
  'created_by_id',
  'domain',
  'email',
  'form_id',
  'graduating_year',
  'last_notification_sent_at',
  'lead_source',
  'lg_link_id',
  'name',
  'notes',
  'payment_link',
  'phone',
  'post_sales_owner_id',
  'pre_sales_owner_id',
  'preferred_language',
  'product_category',
  'product_purchased',
  'reminder_at',
  'revenue_projected',
  'revenue_received',
  'sales_owner_id',
  'send_web_push',
  'state',
  'status',
  'total_recovered',
  'updated_at',
  'utm_campaign',
  'utm_medium',
  'utm_source',
  'whatsapp',
  'sales_owner:profiles!leads_sales_owner_id_fkey(full_name)',
].join(', ');

  const dbClient = client || supabase;

  const selectQuery = tableName === 'leads'
    ? (excludeHistory ? LEADS_NO_HISTORY_COLUMNS : '*, sales_owner:profiles!leads_sales_owner_id_fkey(full_name)')
    : '*';

  // Always use 'planned' count to prevent 300K+ row scans and 8s statement timeouts
  let query = dbClient
    .from(tableName as any)
    .select(selectQuery, { count: 'planned' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  // Enforce company isolation for multi-tenant default database.
  // Bypassed on BYOS single-tenant databases to hit direct single-column indexes & eliminate redundant PostgREST URL predicates.
  const isBYOSHost = (dbClient as any)?.supabaseUrl && !(dbClient as any).supabaseUrl.includes('api.fastestcrm.com') && !(dbClient as any).supabaseUrl.includes('uykdyqdeyilpulaqlqip');
  if (!isBYOSHost) {
    query = query.eq('company_id', companyId);
  }

  // Hierarchy scoping: when not an admin, restrict leads to accessible users
  if (!canViewAll && accessibleUserIds && accessibleUserIds.length > 0) {
    if (ownerFilter && ownerFilter.length > 0) {
      // User explicitly selected owner(s) from dropdown — handled in ownerFilter block below
    } else {
      // Default view: scope query to user's hierarchy
      // For sales reps (single ID), eq hits the composite index directly (7.4ms instead of 6,800ms)
      if (accessibleUserIds.length === 1) {
        query = query.eq('sales_owner_id', accessibleUserIds[0]);
      } else {
        query = query.in('sales_owner_id', accessibleUserIds);
      }
    }
  }

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
      if (values && values.length === 1) {
        query = query.eq(colId, values[0]);
      } else if (values && values.length > 1) {
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
    const MAX_CHUNKS = 500; // Safety cap: up to 500,000 leads
    let chunkIndex = 0;

    while (hasMore && chunkIndex < MAX_CHUNKS) {
      chunkIndex++;
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

      let chunkQuery = dbClient
        .from(tableName as any)
        .select(selectQuery);

      // Re-apply filters to chunkQuery
      if (!isBYOSHost) {
        chunkQuery = chunkQuery.eq('company_id', companyId);
      }
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

      // Hierarchy filtering: restrict non-admins to accessible users
      if (!canViewAll && accessibleUserIds && accessibleUserIds.length > 0) {
        if (!ownerFilter || ownerFilter.length === 0) {
          if (accessibleUserIds.length === 1) {
            chunkQuery = chunkQuery.eq('sales_owner_id', accessibleUserIds[0]);
          } else {
            chunkQuery = chunkQuery.in('sales_owner_id', accessibleUserIds);
          }
        }
      }

      chunkQuery = chunkQuery.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to);

      const { data: chunkData, error: chunkError } = await chunkQuery;

      if (chunkError) {
        console.error('[useLeads] Chunk query error:', chunkError);
        throw chunkError;
      }

      if (chunkData && Array.isArray(chunkData)) {
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

export function useLeads({
  search,
  statusFilter,
  ownerFilter,
  activeOwnerIds,
  productFilter,
  pendingPaymentOnly,
  page = 1,
  pageSize = 25,
  fetchAll = false,
  limit,
  dynamicFilters,
  excludeHistory,
  accessibleUserIds: explicitAccessibleUserIds,
  canViewAll: explicitCanViewAll,
}: UseLeadsOptions = {}) {
  const queryClient = useQueryClient();
  const { tableName, companyId, loading: tableLoading } = useLeadsTable();
  const { orgClient, isBYOSLoading } = useOrgClient();
  const { accessibleUserIds: hierarchyIds, canViewAll: hierarchyCanViewAll, loading: hierarchyLoading } = useHierarchy();

  const accessibleUserIds = explicitAccessibleUserIds !== undefined ? explicitAccessibleUserIds : hierarchyIds;
  const canViewAll = explicitCanViewAll !== undefined ? explicitCanViewAll : hierarchyCanViewAll;

  const queryKey = [
    'leads',
    (orgClient as any)?.supabaseUrl || 'default',
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
    tableName,
    companyId,
    JSON.stringify(dynamicFilters),
    excludeHistory,
    canViewAll,
    accessibleUserIds,
  ];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchLeadsData({
      client: orgClient,
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
      dynamicFilters,
      excludeHistory,
      accessibleUserIds,
      canViewAll,
    }),
    enabled: !tableLoading && !!companyId && !isBYOSLoading && !hierarchyLoading,
    placeholderData: (previousData) => previousData,
    retry: 2,
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
  });

  // Prefetch both next and previous pages for instant 0ms pagination
  useEffect(() => {
    if (!fetchAll && query.data && companyId && tableName && !hierarchyLoading) {
      const orgUrl = (orgClient as any)?.supabaseUrl || 'default';

      // Prefetch Next Page
      if (query.data.count > page * pageSize) {
        const nextPage = page + 1;
        const nextQueryKey = [
          'leads',
          orgUrl,
          search,
          statusFilter,
          ownerFilter,
          activeOwnerIds,
          productFilter,
          pendingPaymentOnly,
          nextPage,
          pageSize,
          fetchAll,
          limit,
          tableName,
          companyId,
          JSON.stringify(dynamicFilters),
          excludeHistory,
          canViewAll,
          accessibleUserIds,
        ];
        queryClient.prefetchQuery({
          queryKey: nextQueryKey,
          queryFn: () => fetchLeadsData({
            client: orgClient,
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
            dynamicFilters,
            excludeHistory,
            accessibleUserIds,
            canViewAll,
          }),
          staleTime: 60000,
        });
      }

      // Prefetch Previous Page
      if (page > 1) {
        const prevPage = page - 1;
        const prevQueryKey = [
          'leads',
          orgUrl,
          search,
          statusFilter,
          ownerFilter,
          activeOwnerIds,
          productFilter,
          pendingPaymentOnly,
          prevPage,
          pageSize,
          fetchAll,
          limit,
          tableName,
          companyId,
          JSON.stringify(dynamicFilters),
          excludeHistory,
          canViewAll,
          accessibleUserIds,
        ];
        queryClient.prefetchQuery({
          queryKey: prevQueryKey,
          queryFn: () => fetchLeadsData({
            client: orgClient,
            tableName: tableName!,
            companyId: companyId!,
            search,
            statusFilter,
            ownerFilter,
            activeOwnerIds,
            productFilter,
            pendingPaymentOnly,
            page: prevPage,
            pageSize,
            fetchAll,
            limit,
            dynamicFilters,
            excludeHistory,
            accessibleUserIds,
            canViewAll,
          }),
          staleTime: 60000,
        });
      }
    }
  }, [query.data, page, pageSize, fetchAll, search, statusFilter, ownerFilter, activeOwnerIds, productFilter, pendingPaymentOnly, limit, dynamicFilters, tableName, companyId, queryClient, orgClient, excludeHistory, canViewAll, accessibleUserIds, hierarchyLoading]);

  return {
    ...query,
    isLoading: query.isLoading || tableLoading || hierarchyLoading
  };
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  const { tableName } = useLeadsTable();
  const { orgClient } = useOrgClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Lead>) => {
      const keys = Object.keys(updates);
      const selectStr = ['id', 'created_at', ...keys.filter(k => k !== 'id' && k !== 'created_at')].join(',');
      const { data, error } = await orgClient
        .from(tableName as any)
        .update(updates)
        .eq('id', id)
        .select(selectStr)
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
  const { orgClient } = useOrgClient();

  return useMutation({
    mutationFn: async (newLead: TablesInsert<'leads'>) => {
      const keys = Object.keys(newLead);
      const selectStr = ['id', 'created_at', ...keys.filter(k => k !== 'id' && k !== 'created_at')].join(',');
      const { data, error } = await orgClient
        .from(tableName as any)
        .insert(newLead)
        .select(selectStr)
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
  const { orgClient } = useOrgClient();

  return useMutation({
    mutationFn: async (newLeads: TablesInsert<'leads'>[]) => {
      const firstLead = newLeads[0] || {};
      const keys = Object.keys(firstLead);
      const selectStr = ['id', 'created_at', ...keys.filter(k => k !== 'id' && k !== 'created_at')].join(',');
      const { data, error } = await orgClient
        .from(tableName as any)
        .insert(newLeads)
        .select(selectStr);

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
  const { orgClient } = useOrgClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await orgClient
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
