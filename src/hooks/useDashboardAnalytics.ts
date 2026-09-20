import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useOrgClient } from '@/hooks/useOrgClient';
import { Lead } from '@/hooks/useLeads';

export interface DashboardKpis {
  leads_today: number;
  paid_today: number;
  revenue_today: number;
  total_revenue: number;
  projected_revenue: number;
  pipeline_value: number;
  total_incentive: number;
  total_leads: number;
}

export interface DashboardIntakeDay {
  dateStr: string;
  label: string;
  count: number;
  revenue: number;
}

export interface DashboardStatusItem {
  name: string;
  count: number;
  fill: string;
}

export interface DashboardRecentLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  updated_at: string;
  revenue_received: number;
  revenue_projected: number;
}

export interface DashboardAnalyticsData {
  kpis: DashboardKpis;
  intake_trend: DashboardIntakeDay[];
  status_distribution: DashboardStatusItem[];
  recent_leads: Lead[];
  action_leads: Lead[];
  table_name: string;
}

const DEFAULT_KPIS: DashboardKpis = {
  leads_today: 0,
  paid_today: 0,
  revenue_today: 0,
  total_revenue: 0,
  projected_revenue: 0,
  pipeline_value: 0,
  total_incentive: 0,
  total_leads: 0,
};

interface RpcResponse {
  kpis?: Record<string, number>;
  intake_trend?: DashboardIntakeDay[];
  status_distribution?: DashboardStatusItem[];
  recent_leads?: Lead[];
  action_leads?: Lead[];
  table_name?: string;
}

interface RpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: RpcResponse | null; error: Error | null }>;
}

export function useDashboardAnalytics() {
  const { company } = useCompany();
  const { orgClient } = useOrgClient();

  const queryKey = ['dashboard-analytics', company?.id];

  const query = useQuery<DashboardAnalyticsData>({
    queryKey,
    queryFn: async (): Promise<DashboardAnalyticsData> => {
      if (!company?.id) {
        return {
          kpis: DEFAULT_KPIS,
          intake_trend: [],
          status_distribution: [],
          recent_leads: [],
          action_leads: [],
          table_name: 'leads',
        };
      }

      const client = orgClient as unknown as RpcClient;
      const { data, error } = await client.rpc('get_dashboard_analytics', {
        p_company_id: company.id,
        p_limit_recent: 5,
      });

      if (error) {
        console.error('[useDashboardAnalytics] RPC failed, returning fallback:', error);
        throw error;
      }

      return {
        kpis: {
          leads_today: Number(data?.kpis?.leads_today) || 0,
          paid_today: Number(data?.kpis?.paid_today) || 0,
          revenue_today: Number(data?.kpis?.revenue_today) || 0,
          total_revenue: Number(data?.kpis?.total_revenue) || 0,
          projected_revenue: Number(data?.kpis?.projected_revenue) || 0,
          pipeline_value: Number(data?.kpis?.pipeline_value) || 0,
          total_incentive: Number(data?.kpis?.total_incentive) || 0,
          total_leads: Number(data?.kpis?.total_leads) || 0,
        },
        intake_trend: Array.isArray(data?.intake_trend) ? data.intake_trend : [],
        status_distribution: Array.isArray(data?.status_distribution) ? data.status_distribution : [],
        recent_leads: (data?.recent_leads || []) as Lead[],
        action_leads: (data?.action_leads || []) as Lead[],
        table_name: data?.table_name || 'leads',
      };
    },
    enabled: !!company?.id,
    staleTime: 1000 * 60,       // Cache for 60 seconds — fast navigation without redundant fetches
    gcTime: 1000 * 60 * 5,      // Retain in memory for 5 minutes
    refetchOnWindowFocus: false, // Prevent background refetches when switching tabs
  });

  return {
    ...query,
    analytics: query.data,
    kpis: query.data?.kpis || DEFAULT_KPIS,
    intakeTrend: query.data?.intake_trend || [],
    statusDistribution: query.data?.status_distribution || [],
    recentLeads: query.data?.recent_leads || [],
    actionLeads: query.data?.action_leads || [],
  };
}
