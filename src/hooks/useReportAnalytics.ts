import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from './useCompany';
import { useOrgClient } from './useOrgClient';

export interface ReportKPIs {
  total_leads: number;
  paid_leads: number;
  won_revenue: number;
  pipeline_revenue: number;
  active_leads: number;
  conversion_rate: number;
  avg_deal_size: number;
}

export interface ReportStatusItem {
  status: string;
  count: number;
  won_count: number;
  revenue: number;
}

export interface ReportOwnerItem {
  owner_id: string | null;
  owner_name: string;
  total_leads: number;
  won_leads: number;
  revenue: number;
  conversion_rate: number;
  status_counts: Record<string, number>;
}

export interface ReportSourceItem {
  source: string;
  volume: number;
  converted: number;
  revenue: number;
  conversion_rate: number;
  share_percent: number;
}

export interface ReportProductItem {
  product: string;
  volume: number;
  converted: number;
  revenue: number;
  conversion_rate: number;
}

export interface ReportMonthItem {
  month_key: string;
  month_label: string;
  leads: number;
  paid: number;
  revenue: number;
}

export interface MasterReportData {
  table_name: string;
  kpis: ReportKPIs;
  status_breakdown: ReportStatusItem[];
  owner_breakdown: ReportOwnerItem[];
  source_breakdown: ReportSourceItem[];
  product_breakdown: ReportProductItem[];
  month_breakdown: ReportMonthItem[];
}

export interface UseReportAnalyticsOptions {
  startDate?: string | null;
  endDate?: string | null;
  owners?: string[];
  statuses?: string[];
  sources?: string[];
  products?: string[];
  revenueStatus?: 'all' | 'with_revenue' | 'zero_revenue';
  search?: string;
}

export function useReportAnalytics({
  startDate,
  endDate,
  owners,
  statuses,
  sources,
  products,
  revenueStatus = 'all',
  search,
}: UseReportAnalyticsOptions = {}) {
  const { company } = useCompany();
  const { orgClient } = useOrgClient();
  const [queryDurationMs, setQueryDurationMs] = useState<number>(0);

  // Clean filters for query key and RPC payload
  const realOwners = useMemo(() => {
    return (owners || []).filter((id) => id !== 'unassigned');
  }, [owners]);

  const queryKey = [
    'master-report-analytics',
    company?.id,
    startDate,
    endDate,
    JSON.stringify(realOwners),
    JSON.stringify(statuses),
    JSON.stringify(sources),
    JSON.stringify(products),
    revenueStatus,
    search,
  ];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<MasterReportData> => {
      if (!company?.id) {
        return {
          table_name: 'leads',
          kpis: {
            total_leads: 0,
            paid_leads: 0,
            won_revenue: 0,
            pipeline_revenue: 0,
            active_leads: 0,
            conversion_rate: 0,
            avg_deal_size: 0,
          },
          status_breakdown: [],
          owner_breakdown: [],
          source_breakdown: [],
          product_breakdown: [],
          month_breakdown: [],
        };
      }

      const t0 = performance.now();
      const { data, error } = await orgClient.rpc('get_master_report_analytics', {
        p_company_id: company.id,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_owner_ids: realOwners.length > 0 ? realOwners : null,
        p_statuses: statuses && statuses.length > 0 ? statuses : null,
        p_sources: sources && sources.length > 0 ? sources.map((s) => s.toLowerCase().trim()) : null,
        p_products: products && products.length > 0 ? products : null,
        p_revenue_status: revenueStatus,
        p_search: search && search.trim() ? search.trim() : null,
      });

      const t1 = performance.now();
      setQueryDurationMs(Math.round(t1 - t0));

      if (error) {
        console.error('[useReportAnalytics] RPC error:', error);
        throw error;
      }

      return data as MasterReportData;
    },
    enabled: !!company?.id,
    staleTime: 60_000, // Cache for 1 minute
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    analytics: query.data,
    kpis: query.data?.kpis,
    statusBreakdown: query.data?.status_breakdown || [],
    ownerBreakdown: query.data?.owner_breakdown || [],
    sourceBreakdown: query.data?.source_breakdown || [],
    productBreakdown: query.data?.product_breakdown || [],
    monthBreakdown: query.data?.month_breakdown || [],
    queryDurationMs,
  };
}
