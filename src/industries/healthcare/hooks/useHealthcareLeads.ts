import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useOrgClient } from '@/hooks/useOrgClient';
import type { HealthcareLead } from '../components/HealthcareLeadsTable';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

interface UseHealthcareLeadsOptions {
  search?: string;
  statusFilter?: string | string[];
  ownerFilter?: string[];
  departmentFilter?: string[];
  genderFilter?: string[];
  page?: number;
  pageSize?: number;
  accessibleUserIds?: string[];
  canViewAll?: boolean;
}

async function fetchHealthcareLeadsData({
  client,
  companyId,
  search,
  statusFilter,
  ownerFilter,
  departmentFilter,
  genderFilter,
  page,
  pageSize,
  accessibleUserIds,
  canViewAll
}: {
  client?: SupabaseClient<Database>;
  companyId: string;
  search?: string;
  statusFilter?: string | string[];
  ownerFilter?: string[];
  departmentFilter?: string[];
  genderFilter?: string[];
  page: number;
  pageSize: number;
  accessibleUserIds: string[];
  canViewAll: boolean;
}): Promise<{ leads: HealthcareLead[]; count: number }> {
  const dbClient = client || supabase;
  let query = dbClient
    .from('leads_healthcare' as any)
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    if (Array.isArray(statusFilter)) {
      if (statusFilter.length > 0) query = query.in('status', statusFilter);
    } else {
      query = query.eq('status', statusFilter);
    }
  }

  if (ownerFilter && ownerFilter.length > 0) {
    query = query.in('sales_owner_id', ownerFilter);
  }

  if (departmentFilter && departmentFilter.length > 0) {
    query = query.in('department', departmentFilter);
  }

  if (genderFilter && genderFilter.length > 0) {
    query = query.in('gender', genderFilter);
  }

  if (!canViewAll && accessibleUserIds.length > 0) {
    query = query.in('sales_owner_id', accessibleUserIds);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,condition.ilike.%${search}%,department.ilike.%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    leads: (data as unknown as HealthcareLead[]) || [],
    count: count || 0,
  };
}

export function useHealthcareLeads({
  search,
  statusFilter,
  ownerFilter,
  departmentFilter,
  genderFilter,
  page = 1,
  pageSize = 25,
  accessibleUserIds = [],
  canViewAll = true,
}: UseHealthcareLeadsOptions = {}) {
  const { company, loading: companyLoading } = useCompany();
  const { orgClient, isBYOSLoading } = useOrgClient();
  const queryClient = useQueryClient();

  const queryKey = [
    'healthcare-leads', (orgClient as any)?.supabaseUrl || 'default', search, statusFilter, ownerFilter,
    departmentFilter, genderFilter, page, pageSize,
    company?.id, accessibleUserIds, canViewAll,
  ];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchHealthcareLeadsData({
      client: orgClient,
      companyId: company!.id,
      search,
      statusFilter,
      ownerFilter,
      departmentFilter,
      genderFilter,
      page,
      pageSize,
      accessibleUserIds,
      canViewAll
    }),
    enabled: !companyLoading && !!company?.id && !isBYOSLoading,
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
        'healthcare-leads', search, statusFilter, ownerFilter,
        departmentFilter, genderFilter, nextPage, pageSize,
        company.id, accessibleUserIds, canViewAll,
      ];
      queryClient.prefetchQuery({
        queryKey: nextQueryKey,
        queryFn: () => fetchHealthcareLeadsData({
          client: orgClient,
          companyId: company.id,
          search,
          statusFilter,
          ownerFilter,
          departmentFilter,
          genderFilter,
          page: nextPage,
          pageSize,
          accessibleUserIds,
          canViewAll
        }),
        staleTime: 60000,
      });
    }
  }, [query.data, page, pageSize, search, statusFilter, ownerFilter, departmentFilter, genderFilter, company?.id, accessibleUserIds, canViewAll, queryClient]);

  return {
    ...query,
    isLoading: query.isLoading || companyLoading,
    refetch: query.refetch,
  };
}
