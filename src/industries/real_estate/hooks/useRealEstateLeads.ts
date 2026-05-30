import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import type { RealEstateLead } from '../components/RealEstateLeadsTable';

interface UseRealEstateLeadsOptions {
  search?: string;
  statusFilter?: string | string[];
  ownerFilter?: string[];
  propertyTypeFilter?: string[];
  page?: number;
  pageSize?: number;
  accessibleUserIds?: string[];
  canViewAll?: boolean;
  activeOwnerIds?: string[];
}

async function fetchRealEstateLeadsData({
  companyId,
  search,
  statusFilter,
  ownerFilter,
  propertyTypeFilter,
  page,
  pageSize,
  accessibleUserIds,
  canViewAll,
  activeOwnerIds
}: {
  companyId: string;
  search?: string;
  statusFilter?: string | string[];
  ownerFilter?: string[];
  propertyTypeFilter?: string[];
  page: number;
  pageSize: number;
  accessibleUserIds: string[];
  canViewAll: boolean;
  activeOwnerIds: string[];
}): Promise<{ leads: RealEstateLead[]; count: number }> {
  // Use direct query instead of RPC to avoid TypeScript issues
  let query = supabase
    .from('leads_real_estate')
    .select('*, sales_owner:profiles!leads_real_estate_sales_owner_id_fkey(full_name)', { count: 'exact' })
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    if (Array.isArray(statusFilter)) {
      if (statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }
    } else {
      query = query.eq('status', statusFilter);
    }
  }

  if (ownerFilter && ownerFilter.length > 0) {
    const hasUnassigned = ownerFilter.includes('unassigned');
    const realOwnerIds = ownerFilter.filter(id => id !== 'unassigned');
    if (hasUnassigned) {
      if (activeOwnerIds && activeOwnerIds.length > 0) {
        const activeIdList = activeOwnerIds.join(',');
        if (realOwnerIds.length > 0) {
          const realIds = realOwnerIds.join(',');
          query = query.or(`sales_owner_id.is.null,sales_owner_id.not.in.(${activeIdList}),sales_owner_id.in.(${realIds}),pre_sales_owner_id.in.(${realIds}),post_sales_owner_id.in.(${realIds})`);
        } else {
          query = query.or(`sales_owner_id.is.null,sales_owner_id.not.in.(${activeIdList})`);
        }
      } else {
        if (realOwnerIds.length > 0) {
          const realIds = realOwnerIds.join(',');
          query = query.or(`sales_owner_id.is.null,sales_owner_id.in.(${realIds}),pre_sales_owner_id.in.(${realIds}),post_sales_owner_id.in.(${realIds})`);
        } else {
          query = query.is('sales_owner_id', null);
        }
      }
    } else {
      const realIds = realOwnerIds.join(',');
      query = query.or(`sales_owner_id.in.(${realIds}),pre_sales_owner_id.in.(${realIds}),post_sales_owner_id.in.(${realIds})`);
    }
  }

  if (propertyTypeFilter && propertyTypeFilter.length > 0) {
    query = query.in('property_type', propertyTypeFilter);
  }

  // Hierarchy filtering: restrict to accessible users' leads across all owner roles
  if (!canViewAll && accessibleUserIds.length > 0) {
    const ids = accessibleUserIds.join(',');
    query = query.or(`sales_owner_id.in.(${ids}),pre_sales_owner_id.in.(${ids}),post_sales_owner_id.in.(${ids})`);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,property_name.ilike.%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('[useRealEstateLeads] Query error:', error);
    throw error;
  }

  return {
    leads: (data as unknown as RealEstateLead[]) || [],
    count: count || 0
  };
}

export function useRealEstateLeads({
  search,
  statusFilter,
  ownerFilter,
  propertyTypeFilter,
  page = 1,
  pageSize = 25,
  accessibleUserIds = [],
  canViewAll = true,
  activeOwnerIds = [],
}: UseRealEstateLeadsOptions = {}) {
  const { company, loading: companyLoading } = useCompany();
  const queryClient = useQueryClient();

  const queryKey = [
    'real-estate-leads',
    search,
    statusFilter,
    ownerFilter,
    propertyTypeFilter,
    page,
    pageSize,
    company?.id,
    accessibleUserIds,
    canViewAll,
    activeOwnerIds
  ];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchRealEstateLeadsData({
      companyId: company!.id,
      search,
      statusFilter,
      ownerFilter,
      propertyTypeFilter,
      page,
      pageSize,
      accessibleUserIds,
      canViewAll,
      activeOwnerIds
    }),
    enabled: !companyLoading && !!company?.id,
    placeholderData: (prev) => prev,
    retry: 2,
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
  });

  // Prefetch the next page
  useEffect(() => {
    if (query.data && query.data.count > page * pageSize && company?.id) {
      const nextPage = page + 1;
      const nextQueryKey = [
        'real-estate-leads',
        search,
        statusFilter,
        ownerFilter,
        propertyTypeFilter,
        nextPage,
        pageSize,
        company.id,
        accessibleUserIds,
        canViewAll,
        activeOwnerIds
      ];
      queryClient.prefetchQuery({
        queryKey: nextQueryKey,
        queryFn: () => fetchRealEstateLeadsData({
          companyId: company.id,
          search,
          statusFilter,
          ownerFilter,
          propertyTypeFilter,
          page: nextPage,
          pageSize,
          accessibleUserIds,
          canViewAll,
          activeOwnerIds
        }),
        staleTime: 60000,
      });
    }
  }, [query.data, page, pageSize, search, statusFilter, ownerFilter, propertyTypeFilter, company?.id, accessibleUserIds, canViewAll, activeOwnerIds, queryClient]);

  return {
    ...query,
    isLoading: query.isLoading || companyLoading,
    refetch: query.refetch,
  };
}
