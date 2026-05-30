import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import type { TravelLead } from '../components/TravelLeadsTable';

interface UseTravelLeadsOptions {
  search?: string;
  statusFilter?: string | string[];
  ownerFilter?: string[];
  tripTypeFilter?: string[];
  page?: number;
  pageSize?: number;
  accessibleUserIds?: string[];
  canViewAll?: boolean;
}

async function fetchTravelLeadsData({
  companyId,
  search,
  statusFilter,
  ownerFilter,
  tripTypeFilter,
  page,
  pageSize,
  accessibleUserIds,
  canViewAll
}: {
  companyId: string;
  search?: string;
  statusFilter?: string | string[];
  ownerFilter?: string[];
  tripTypeFilter?: string[];
  page: number;
  pageSize: number;
  accessibleUserIds: string[];
  canViewAll: boolean;
}): Promise<{ leads: TravelLead[]; count: number }> {
  let q = supabase
    .from('leads_travel' as any)
    .select('*, sales_owner:profiles!leads_travel_sales_owner_id_fkey(full_name)', { count: 'exact' })
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    if (Array.isArray(statusFilter)) {
      if (statusFilter.length > 0) q = q.in('status', statusFilter);
    } else {
      q = q.eq('status', statusFilter);
    }
  }

  if (ownerFilter && ownerFilter.length > 0) q = q.in('sales_owner_id', ownerFilter);
  if (tripTypeFilter && tripTypeFilter.length > 0) q = q.in('trip_type', tripTypeFilter);

  if (!canViewAll && accessibleUserIds.length > 0) {
    q = q.in('sales_owner_id', accessibleUserIds);
  }

  if (search) {
    q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,destination.ilike.%${search}%,hotel_name.ilike.%${search}%`);
  }

  const from = (page - 1) * pageSize;
  q = q.range(from, from + pageSize - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { leads: (data as unknown as TravelLead[]) || [], count: count || 0 };
}

export function useTravelLeads({
  search, statusFilter, ownerFilter, tripTypeFilter,
  page = 1, pageSize = 25, accessibleUserIds = [], canViewAll = true,
}: UseTravelLeadsOptions = {}) {
  const { company, loading: companyLoading } = useCompany();
  const queryClient = useQueryClient();

  const queryKey = [
    'travel-leads', search, statusFilter, ownerFilter, tripTypeFilter,
    page, pageSize, company?.id, accessibleUserIds, canViewAll,
  ];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchTravelLeadsData({
      companyId: company!.id,
      search,
      statusFilter,
      ownerFilter,
      tripTypeFilter,
      page,
      pageSize,
      accessibleUserIds,
      canViewAll
    }),
    enabled: !companyLoading && !!company?.id,
    placeholderData: (prev) => prev,
    retry: 2,
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
  });

  // Prefetch next page
  useEffect(() => {
    if (query.data && query.data.count > page * pageSize && company?.id) {
      const nextPage = page + 1;
      const nextQueryKey = [
        'travel-leads', search, statusFilter, ownerFilter, tripTypeFilter,
        nextPage, pageSize, company.id, accessibleUserIds, canViewAll,
      ];
      queryClient.prefetchQuery({
        queryKey: nextQueryKey,
        queryFn: () => fetchTravelLeadsData({
          companyId: company.id,
          search,
          statusFilter,
          ownerFilter,
          tripTypeFilter,
          page: nextPage,
          pageSize,
          accessibleUserIds,
          canViewAll
        }),
        staleTime: 60000,
      });
    }
  }, [query.data, page, pageSize, search, statusFilter, ownerFilter, tripTypeFilter, company?.id, accessibleUserIds, canViewAll, queryClient]);

  return { ...query, isLoading: query.isLoading || companyLoading, refetch: query.refetch };
}
