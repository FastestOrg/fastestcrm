import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from './useCompany';
import { useOrgClient } from './useOrgClient';
import { useHierarchy } from './useHierarchy';
import { startOfDay, endOfDay, subDays, format, isValid, parseISO } from 'date-fns';

export type ActivityDatePreset = 'today' | 'yesterday' | '7d' | '14d' | '30d' | 'custom';
export type ActivityStatusBadge = 'active_now' | 'idle' | 'earlier_today' | 'inactive';

export interface EmployeeLastActivity {
  timestamp: string;
  action: string;
  lead_id: string;
  lead_name: string;
  old_status?: string | null;
  new_status?: string | null;
  details?: any;
  seconds_ago: number;
  status_badge: ActivityStatusBadge;
}

export interface EmployeeActivityMetric {
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  unique_leads_worked: number;
  total_actions: number;
  action_counts: Record<string, number>;
  last_activity?: EmployeeLastActivity | null;
}

export interface ActivitySummary {
  total_unique_leads_worked: number;
  total_actions: number;
  active_employees_count: number;
  total_employees_count: number;
  active_now_count: number;
  top_performer?: {
    user_id: string;
    name: string;
    email: string;
    unique_leads_worked: number;
    total_actions: number;
  } | null;
}

export interface DailyTrendItem {
  date: string;
  user_id: string;
  name: string;
  unique_leads: number;
  total_actions: number;
}

export interface EmployeeActivityReportData {
  summary: ActivitySummary;
  employees: EmployeeActivityMetric[];
  daily_trend: DailyTrendItem[];
  start_date: string;
  end_date: string;
}

export interface LeadTimelineItem {
  id: string;
  lead_id: string;
  lead_name: string;
  action: string;
  old_status?: string | null;
  new_status?: string | null;
  details?: any;
  created_at: string;
  seconds_ago: number;
}

export function useEmployeeActivityReport() {
  const { company } = useCompany();
  const { orgClient } = useOrgClient();
  const { accessibleUserIds, canViewAll, loading: hierarchyLoading } = useHierarchy();

  const [datePreset, setDatePreset] = useState<ActivityDatePreset>('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | ActivityStatusBadge>('all');
  const [queryDurationMs, setQueryDurationMs] = useState<number>(0);

  const isIndividual = !canViewAll && accessibleUserIds.length <= 1;

  // Calculate start and end ISO strings based on preset
  const { startDateISO, endDateISO } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    switch (datePreset) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'yesterday': {
        const yest = subDays(now, 1);
        start = startOfDay(yest);
        end = endOfDay(yest);
        break;
      }
      case '7d':
        start = startOfDay(subDays(now, 6));
        break;
      case '14d':
        start = startOfDay(subDays(now, 13));
        break;
      case '30d':
        start = startOfDay(subDays(now, 29));
        break;
      case 'custom':
        if (customStartDate) {
          const parsedStart = parseISO(customStartDate);
          start = isValid(parsedStart) ? startOfDay(parsedStart) : startOfDay(now);
        } else {
          start = startOfDay(now);
        }
        if (customEndDate) {
          const parsedEnd = parseISO(customEndDate);
          end = isValid(parsedEnd) ? endOfDay(parsedEnd) : endOfDay(now);
        }
        break;
      default:
        start = startOfDay(now);
        end = endOfDay(now);
    }

    return {
      startDateISO: start.toISOString(),
      endDateISO: end.toISOString(),
    };
  }, [datePreset, customStartDate, customEndDate]);

  const scopedUserIds = useMemo(() => {
    if (canViewAll) return null;
    return accessibleUserIds;
  }, [canViewAll, accessibleUserIds]);

  const queryKey = [
    'employee-activity-report',
    company?.id,
    startDateISO,
    endDateISO,
    JSON.stringify(scopedUserIds),
  ];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<EmployeeActivityReportData> => {
      if (!company?.id) {
        return {
          summary: {
            total_unique_leads_worked: 0,
            total_actions: 0,
            active_employees_count: 0,
            total_employees_count: 0,
            active_now_count: 0,
            top_performer: null,
          },
          employees: [],
          daily_trend: [],
          start_date: startDateISO,
          end_date: endDateISO,
        };
      }

      const t0 = performance.now();
      const { data, error } = await orgClient.rpc('get_employee_daily_activity_report', {
        p_company_id: company.id,
        p_start_date: startDateISO,
        p_end_date: endDateISO,
        p_user_ids: scopedUserIds && scopedUserIds.length > 0 ? scopedUserIds : null,
      });

      const t1 = performance.now();
      setQueryDurationMs(Math.round(t1 - t0));

      if (error) {
        console.error('[useEmployeeActivityReport] RPC error:', error);
        throw error;
      }

      return data as EmployeeActivityReportData;
    },
    enabled: !!company?.id && !hierarchyLoading,
    staleTime: 60_000, // Cache for 60s
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  // Fetch individual employee activity timeline for drilldown
  const fetchEmployeeTimeline = useCallback(
    async (userId: string, limit: number = 100): Promise<LeadTimelineItem[]> => {
      if (!company?.id) return [];
      if (!canViewAll && !accessibleUserIds.includes(userId)) {
        console.warn('[useEmployeeActivityReport] Access denied to user timeline:', userId);
        return [];
      }
      const { data, error } = await orgClient.rpc('get_employee_activity_timeline', {
        p_company_id: company.id,
        p_user_id: userId,
        p_start_date: startDateISO,
        p_end_date: endDateISO,
        p_limit: limit,
      });

      if (error) {
        console.error('[useEmployeeActivityReport] fetchEmployeeTimeline error:', error);
        return [];
      }

      return (data as LeadTimelineItem[]) || [];
    },
    [company?.id, orgClient, startDateISO, endDateISO, canViewAll, accessibleUserIds]
  );

  // Client-side filtering for fast table searching without server refetch
  const filteredEmployees = useMemo(() => {
    let list = query.data?.employees || [];
    if (!canViewAll) {
      list = list.filter((emp) => accessibleUserIds.includes(emp.user_id));
    }

    return list.filter((emp) => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = emp.name.toLowerCase().includes(q);
        const matchesEmail = emp.email.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }

      // 2. Status badge filter
      if (statusFilter !== 'all') {
        const badge = emp.last_activity?.status_badge || 'inactive';
        if (badge !== statusFilter) return false;
      }

      return true;
    });
  }, [query.data?.employees, searchQuery, statusFilter, canViewAll, accessibleUserIds]);

  // Scoped daily trend
  const filteredDailyTrend = useMemo(() => {
    const list = query.data?.daily_trend || [];
    if (canViewAll) return list;
    return list.filter((item) => accessibleUserIds.includes(item.user_id));
  }, [query.data?.daily_trend, canViewAll, accessibleUserIds]);

  // Scoped summary
  const scopedSummary = useMemo(() => {
    if (canViewAll) return query.data?.summary;
    if (!query.data?.employees) return null;

    const accessibleEmployees = query.data.employees.filter((emp) => accessibleUserIds.includes(emp.user_id));
    const total_unique_leads_worked = accessibleEmployees.reduce((sum, e) => sum + (e.unique_leads_worked || 0), 0);
    const total_actions = accessibleEmployees.reduce((sum, e) => sum + (e.total_actions || 0), 0);
    const active_employees_count = accessibleEmployees.filter((e) => (e.unique_leads_worked || 0) > 0).length;
    const total_employees_count = accessibleEmployees.length;
    const active_now_count = accessibleEmployees.filter((e) => e.last_activity?.status_badge === 'active_now').length;

    let top_performer = null;
    const sorted = [...accessibleEmployees].sort((a, b) => (b.unique_leads_worked || 0) - (a.unique_leads_worked || 0));
    if (sorted.length > 0 && (sorted[0].unique_leads_worked || 0) > 0) {
      top_performer = {
        user_id: sorted[0].user_id,
        name: sorted[0].name,
        email: sorted[0].email,
        unique_leads_worked: sorted[0].unique_leads_worked,
        total_actions: sorted[0].total_actions,
      };
    }

    return {
      total_unique_leads_worked,
      total_actions,
      active_employees_count,
      total_employees_count,
      active_now_count,
      top_performer,
    };
  }, [query.data, canViewAll, accessibleUserIds]);

  // Relative time helper
  const getRelativeTime = (secondsAgo: number): string => {
    if (secondsAgo < 60) return 'Just now';
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    if (secondsAgo < 86400) {
      const hrs = Math.floor(secondsAgo / 3600);
      const mins = Math.floor((secondsAgo % 3600) / 60);
      return mins > 0 ? `${hrs}h ${mins}m ago` : `${hrs}h ago`;
    }
    const days = Math.floor(secondsAgo / 86400);
    return days === 1 ? 'Yesterday' : `${days}d ago`;
  };

  return {
    ...query,
    isLoading: query.isLoading || hierarchyLoading,
    reportData: query.data,
    employees: filteredEmployees,
    summary: scopedSummary,
    dailyTrend: filteredDailyTrend,
    datePreset,
    setDatePreset,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    queryDurationMs,
    fetchEmployeeTimeline,
    getRelativeTime,
    canViewAll,
    accessibleUserIds,
    isIndividual,
  };
}
