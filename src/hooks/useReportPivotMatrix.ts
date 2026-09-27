import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useCompany } from './useCompany';
import { useOrgClient } from './useOrgClient';
import { supabase } from '@/integrations/supabase/client';

export interface PivotMatrixCell {
  count: number;
  revenue: number;
  pipeline: number;
  paid: number;
  avgScore: number;
}

export interface PivotMatrixRow {
  key: string;
  name: string;
  totalLeads: number;
  revenue: number;
  pipeline: number;
  paid: number;
  conversionRate: string;
  avgScore: number;
  colCells: Record<string, PivotMatrixCell>;
}

export interface PivotMatrixColumn {
  key: string;
  label: string;
  color?: string;
}

export interface PivotMatrixData {
  rows: PivotMatrixRow[];
  columns: PivotMatrixColumn[];
}

export interface UseReportPivotMatrixOptions {
  rowDim?: string;
  colDim?: string;
  startDate?: string | null;
  endDate?: string | null;
  owners?: string[];
  statuses?: string[];
  sources?: string[];
  products?: string[];
  revenueStatus?: 'all' | 'with_revenue' | 'zero_revenue';
  search?: string;
  forceRefresh?: boolean;
  enabled?: boolean;
}

export function useReportPivotMatrix({
  rowDim = 'owner',
  colDim = 'status',
  startDate,
  endDate,
  owners,
  statuses,
  sources,
  products,
  revenueStatus = 'all',
  search,
  forceRefresh = false,
  enabled = true,
}: UseReportPivotMatrixOptions = {}) {
  const { company } = useCompany();
  const { orgClient } = useOrgClient();

  const realOwners = useMemo(() => {
    return (owners || []).filter((id) => id !== 'unassigned');
  }, [owners]);

  const queryKey = [
    'report-pivot-matrix',
    company?.id,
    rowDim,
    colDim,
    startDate,
    endDate,
    JSON.stringify(realOwners),
    JSON.stringify(statuses),
    JSON.stringify(sources),
    JSON.stringify(products),
    revenueStatus,
    search,
    forceRefresh,
  ];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<PivotMatrixData> => {
      if (!company?.id) {
        return { rows: [], columns: [] };
      }

      const rpcPayload = {
        p_company_id: company.id,
        p_row_dim: rowDim,
        p_col_dim: colDim,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_owner_ids: realOwners.length > 0 ? realOwners : null,
        p_statuses: statuses && statuses.length > 0 ? statuses : null,
        p_sources: sources && sources.length > 0 ? sources.map((s) => s.toLowerCase().trim()) : null,
        p_products: products && products.length > 0 ? products : null,
        p_revenue_status: revenueStatus,
        p_search: search && search.trim() ? search.trim() : null,
        p_force_refresh: forceRefresh,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let { data, error } = await (orgClient as any).rpc('get_report_pivot_matrix', rpcPayload);

      if (error && orgClient !== supabase) {
        // Fallback to primary client if custom client fails
        const fallbackRes = await (supabase as any).rpc('get_report_pivot_matrix', rpcPayload);
        if (!fallbackRes.error && fallbackRes.data) {
          data = fallbackRes.data;
          error = null;
        }
      }

      if (error) {
        console.error('[useReportPivotMatrix] RPC Error:', error);
        return { rows: [], columns: [] };
      }

      return (data as PivotMatrixData) || { rows: [], columns: [] };
    },
    enabled: !!company?.id && enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  return {
    data: query.data,
    rows: query.data?.rows || [],
    columns: query.data?.columns || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    error: query.error,
  };
}
