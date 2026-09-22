import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useReportAnalytics } from '@/hooks/useReportAnalytics';
import { useTeam } from '@/hooks/useTeam';
import { useProducts } from '@/hooks/useProducts';
import { useLeadStatuses, CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { useCustomColumns } from '@/hooks/useCustomColumns';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useHierarchy } from '@/hooks/useHierarchy';
import { ReportSkeleton } from '@/components/report/ReportSkeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  Loader2,
  TrendingUp,
  Users,
  Target,
  Download,
  FileDown,
  DollarSign,
  Activity,
  Sparkles,
  BrainCircuit,
  BarChart3,
  SlidersHorizontal,
  Flame,
  Layers,
  ArrowUpRight,
  PieChart as PieIcon,
  Tag,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, isAfter, isBefore, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, startOfQuarter } from 'date-fns';

// Subcomponents & Helpers
import { ReportFilterBar, ReportFilterState, CustomFieldFilter } from '@/components/report/ReportFilterBar';
import {
  ReportCustomizerModal,
  ReportDisplayConfig,
} from '@/components/report/ReportCustomizerModal';
import { CustomReportTable, GroupSummaryRow } from '@/components/report/CustomReportTable';
import { ReportPrintableTemplate } from '@/components/report/ReportPrintableTemplate';
import { exportReportToPDF } from '@/lib/reportPdfExport';
import { calculateLeadScore } from '@/hooks/useLeadScoring';
import { EmployeeActivityReport } from '@/components/report/EmployeeActivityReport';

const CHART_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
];

export default function Report() {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

  // 1. Master Filter State
  const [filters, setFilters] = useState<ReportFilterState>({
    search: '',
    datePreset: 'this_month',
    customStartDate: '',
    customEndDate: '',
    statuses: [],
    owners: [],
    sources: [],
    products: [],
    priorities: [],
    revenueStatus: 'all',
    customFieldFilters: [],
  });

  // 2. Display / Customizer Configuration
  const [displayConfig, setDisplayConfig] = useState<ReportDisplayConfig>({
    reportTitle: 'Lead & Performance Report',
    reportSubtitle: 'Custom multidimensional conversion analysis & pipeline health',
    executiveNotes: '',
    groupBy: 'owner', // Default group by Sales Owner
    rowDimension: 'owner',
    colDimension: 'status',
    cellMetric: 'count',
    kpis: {
      totalLeads: true,
      conversionRate: true,
      wonRevenue: true,
      pipelineRevenue: true,
      activeLeads: true,
      topSegment: true,
      avgDealSize: true,
      avgLeadScore: true,
    },
    charts: {
      breakdownBar: true,
      statusPie: true,
      conversionFunnel: true,
      revenueArea: true,
    },
    columns: {
      name: true,
      priority: true,
      status: true,
      contact: true,
      owner: true,
      source: true,
      product: true,
      revenue: true,
      createdAt: true,
    },
    showBreakdownSummary: true,
    showLeadDetailsTable: false,
  });

  // ─── Fast Server-Side Date Range Calculation ────────────────────────────────
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let s: Date | null = null;
    let e: Date | null = null;

    if (filters.datePreset === 'today') {
      s = startOfDay(now);
      e = endOfDay(now);
    } else if (filters.datePreset === 'yesterday') {
      const yest = subDays(now, 1);
      s = startOfDay(yest);
      e = endOfDay(yest);
    } else if (filters.datePreset === '7d') {
      s = subDays(now, 7);
      e = endOfDay(now);
    } else if (filters.datePreset === '30d') {
      s = subDays(now, 30);
      e = endOfDay(now);
    } else if (filters.datePreset === 'this_month') {
      s = startOfMonth(now);
      e = endOfMonth(now);
    } else if (filters.datePreset === 'last_month') {
      const lastMonth = subMonths(now, 1);
      s = startOfMonth(lastMonth);
      e = endOfMonth(lastMonth);
    } else if (filters.datePreset === 'this_quarter') {
      s = startOfQuarter(now);
      e = endOfDay(now);
    } else if (filters.datePreset === 'custom') {
      if (filters.customStartDate) s = startOfDay(new Date(filters.customStartDate));
      if (filters.customEndDate) e = endOfDay(new Date(filters.customEndDate));
    }

    return {
      startDate: s ? s.toISOString() : null,
      endDate: e ? e.toISOString() : null,
    };
  }, [filters.datePreset, filters.customStartDate, filters.customEndDate]);

  const { members, loading: teamLoading } = useTeam();
  const { products } = useProducts();
  const { statuses: leadStatuses, isLoading: statusesLoading } = useLeadStatuses();
  const { customColumns, loading: customColumnsLoading } = useCustomColumns('leads');
  const { company } = useCompany();
  const { user } = useAuth();
  const { accessibleUserIds, canViewAll, loading: hierarchyLoading } = useHierarchy();

  const isIndividual = !canViewAll && accessibleUserIds.length <= 1;

  // Determine effective owners for hierarchy & scoping
  const effectiveOwners = useMemo(() => {
    if (canViewAll) {
      return filters.owners;
    }
    if (accessibleUserIds.length <= 1) {
      return user?.id ? [user.id] : [];
    }
    // Manager: if user selected specific accessible owners, use those; otherwise use all accessibleUserIds
    if (filters.owners.length > 0) {
      const filtered = filters.owners.filter((id) => accessibleUserIds.includes(id));
      return filtered.length > 0 ? filtered : accessibleUserIds;
    }
    return accessibleUserIds;
  }, [canViewAll, accessibleUserIds, filters.owners, user?.id]);

  // ─── ⚡ Master Server-Side Analytics Engine (Single-pass PostgreSQL RPC) ────
  const {
    analytics,
    kpis: rpcKpis,
    statusBreakdown: rpcStatusBreakdown,
    ownerBreakdown: rpcOwnerBreakdown,
    sourceBreakdown: rpcSourceBreakdown,
    productBreakdown: rpcProductBreakdown,
    monthBreakdown: rpcMonthBreakdown,
    isLoading: analyticsLoading,
    isFetching: analyticsFetching,
    queryDurationMs,
    refetch: refetchAnalytics,
  } = useReportAnalytics({
    startDate,
    endDate,
    owners: effectiveOwners,
    statuses: filters.statuses,
    sources: filters.sources,
    products: filters.products,
    revenueStatus: filters.revenueStatus,
    search: filters.search,
    enabled: !hierarchyLoading && !!company?.id,
  });

  const isInitialLoading = (analyticsLoading || hierarchyLoading) && !analytics;

  // Currency symbol
  const currencySymbol = company?.default_currency === 'USD' ? '$' : '₹';

  // Team members lookup filtered by hierarchy
  const visibleTeamMembers = useMemo(() => {
    const list = (members || []).map((m) => ({
      id: m.id,
      name: m.full_name || m.email?.split('@')[0] || 'Unknown Member',
    }));

    if (canViewAll) return list;
    const filtered = list.filter((m) => accessibleUserIds.includes(m.id));
    if (filtered.length === 0 && user?.id) {
      return [{
        id: user.id,
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'My Performance',
      }];
    }
    return filtered;
  }, [members, canViewAll, accessibleUserIds, user]);

  const ownersMap = useMemo(() => {
    const map: Record<string, string> = {};
    visibleTeamMembers.forEach((m) => {
      map[m.id] = m.name;
    });
    return map;
  }, [visibleTeamMembers]);

  // Unique lead sources - combines server analytics across ALL leads + defaults
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    (rpcSourceBreakdown || []).forEach((s) => {
      if (s.source && s.source.trim()) set.add(s.source.trim().toLowerCase());
    });
    ['website', 'google ads', 'facebook ads', 'referral', 'organic', 'inbound', 'cold call', 'email campaign'].forEach(
      (s) => set.add(s)
    );
    return Array.from(set).sort();
  }, [rpcSourceBreakdown]);

  // Dynamic products list - incorporates server database breakdown
  const productsList = useMemo(() => {
    const list: { id: string; name: string; category?: string }[] = (products || []).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
    }));

    const existingNames = new Set(list.map((p) => p.name.toLowerCase()));
    (rpcProductBreakdown || []).forEach((p) => {
      if (p.product && !existingNames.has(p.product.toLowerCase())) {
        list.push({ id: p.product, name: p.product });
        existingNames.add(p.product.toLowerCase());
      }
    });

    return list;
  }, [products, rpcProductBreakdown]);

  // ─── AI Revenue Forecast Calculation (Server-Aggregated) ────────────────────
  const forecastData = useMemo(() => {
    if (rpcStatusBreakdown && rpcStatusBreakdown.length > 0 && rpcKpis) {
      const STATUS_PROBABILITIES: Record<string, number> = {
        new: 0.1,
        contacted: 0.2,
        qualified: 0.3,
        interested: 0.25,
        follow_up: 0.4,
        proposal_sent: 0.5,
        negotiation: 0.7,
        site_visit: 0.6,
        paid: 1.0,
        closed_lost: 0,
      };

      let totalPotential = rpcKpis.pipeline_revenue || 0;
      let expectedRevenue = 0;
      const closedRevenue = rpcKpis.won_revenue || 0;
      const avgDeal = rpcKpis.avg_deal_size || 5000;

      const pipelineByStatus = rpcStatusBreakdown.map((s) => {
        const prob = STATUS_PROBABILITIES[s.status.toLowerCase()] ?? 0.2;
        const stTotal = s.revenue > 0 ? s.revenue : s.count * avgDeal;
        const stExpected = stTotal * prob;
        expectedRevenue += stExpected;
        if (totalPotential === 0) totalPotential += stTotal;

        return {
          name: s.status.replace(/_/g, ' ').toUpperCase(),
          total: stTotal,
          expected: stExpected,
        };
      }).sort((a, b) => b.total - a.total);

      return {
        totalPotential: totalPotential || closedRevenue,
        expectedRevenue: Math.round(expectedRevenue),
        closedRevenue,
        pipelineByStatus,
        conversionRate: rpcKpis.conversion_rate || 0,
      };
    }

    return {
      totalPotential: 0,
      expectedRevenue: 0,
      closedRevenue: 0,
      pipelineByStatus: [],
      conversionRate: 0,
    };
  }, [rpcStatusBreakdown, rpcKpis]);

  // ─── Group-By Aggregation Engine ────────────────────────────────────────────
  const groupByLabel = useMemo(() => {
    if (displayConfig.groupBy === 'owner') return 'Sales Owner';
    if (displayConfig.groupBy === 'status') return 'Lead Status';
    if (displayConfig.groupBy === 'source') return 'Lead Source';
    if (displayConfig.groupBy === 'product') return 'Product';
    if (displayConfig.groupBy === 'priority') return 'Priority Level';
    if (displayConfig.groupBy === 'date') return 'Creation Month';
    if (displayConfig.groupBy.startsWith('custom:')) {
      const colId = displayConfig.groupBy.replace('custom:', '');
      const colObj = customColumns.find((c) => c.id === colId);
      return colObj ? colObj.label : colId;
    }
    return 'Segment';
  }, [displayConfig.groupBy, customColumns]);

  const groupSummary: GroupSummaryRow[] = useMemo(() => {
    const groupBy = displayConfig.groupBy;
    const totalCount = rpcKpis?.total_leads || 1;

    // 1. Direct Server Aggregate for Sales Owner
    if (groupBy === 'owner' && rpcOwnerBreakdown.length > 0) {
      return rpcOwnerBreakdown.map((o) => ({
        key: o.owner_id || 'unassigned',
        name: o.owner_name,
        total: o.total_leads,
        sharePercent: ((o.total_leads / totalCount) * 100).toFixed(1),
        paid: o.won_leads,
        conversionRate: o.conversion_rate !== undefined ? o.conversion_rate.toFixed(1) : '0',
        revenue: o.revenue,
        avgScore: 65,
        statusCounts: o.status_counts,
      })).sort((a, b) => b.total - a.total);
    }

    // 2. Direct Server Aggregate for Lead Status
    if (groupBy === 'status' && rpcStatusBreakdown.length > 0) {
      return rpcStatusBreakdown.map((s) => {
        const stObj = leadStatuses.find((x) => x.value === s.status);
        const name = stObj?.label || s.status.replace(/_/g, ' ').toUpperCase();
        return {
          key: s.status,
          name,
          total: s.count,
          sharePercent: ((s.count / totalCount) * 100).toFixed(1),
          paid: s.won_count,
          conversionRate: s.count > 0 ? ((s.won_count / s.count) * 100).toFixed(1) : '0',
          revenue: s.revenue,
          avgScore: 65,
        };
      }).sort((a, b) => b.total - a.total);
    }

    // 3. Direct Server Aggregate for Lead Source
    if (groupBy === 'source' && rpcSourceBreakdown.length > 0) {
      return rpcSourceBreakdown.map((s) => ({
        key: s.source,
        name: s.source ? s.source.charAt(0).toUpperCase() + s.source.slice(1) : 'Unknown',
        total: s.volume,
        sharePercent: s.share_percent.toFixed(1),
        paid: s.converted,
        conversionRate: s.conversion_rate.toFixed(1),
        revenue: s.revenue,
        avgScore: 65,
      })).sort((a, b) => b.total - a.total);
    }

    // 4. Direct Server Aggregate for Product
    if (groupBy === 'product' && rpcProductBreakdown.length > 0) {
      return rpcProductBreakdown.map((p) => ({
        key: p.product,
        name: p.product || 'Unspecified',
        total: p.volume,
        sharePercent: ((p.volume / totalCount) * 100).toFixed(1),
        paid: p.converted,
        conversionRate: p.conversion_rate.toFixed(1),
        revenue: p.revenue,
        avgScore: 65,
      })).sort((a, b) => b.total - a.total);
    }

    // 5. Direct Server Aggregate for Creation Month
    if (groupBy === 'date' && rpcMonthBreakdown.length > 0) {
      return rpcMonthBreakdown.map((m) => ({
        key: m.month_key,
        name: m.month_label,
        total: m.leads,
        sharePercent: ((m.leads / totalCount) * 100).toFixed(1),
        paid: m.paid,
        conversionRate: m.leads > 0 ? ((m.paid / m.leads) * 100).toFixed(1) : '0',
        revenue: m.revenue,
        avgScore: 65,
      })).sort((a, b) => b.key.localeCompare(a.key));
    }

    return [];
  }, [
    displayConfig.groupBy,
    rpcKpis,
    rpcOwnerBreakdown,
    rpcStatusBreakdown,
    rpcSourceBreakdown,
    rpcProductBreakdown,
    rpcMonthBreakdown,
    leadStatuses,
  ]);

  // ─── KPI Stats Calculation ──────────────────────────────────────────────────
  const kpiStats = useMemo(() => {
    if (rpcKpis) {
      const totalLeads = rpcKpis.total_leads || 0;
      const paidLeads = rpcKpis.paid_leads || 0;
      const activeLeads = rpcKpis.active_leads || 0;
      const wonRevenue = rpcKpis.won_revenue || 0;
      const pipelineRevenue = rpcKpis.pipeline_revenue || 0;
      const conversionRate = rpcKpis.conversion_rate !== undefined ? rpcKpis.conversion_rate.toFixed(1) : '0';
      const avgDealSize = rpcKpis.avg_deal_size || (paidLeads > 0 ? wonRevenue / paidLeads : 0);
      const topSegment = groupSummary[0]?.name || 'N/A';
      const avgScore = 65;

      return {
        totalLeads,
        conversionRate,
        wonRevenue,
        pipelineRevenue,
        activeLeads,
        avgScore,
        topSegment,
        avgDealSize,
      };
    }

    return {
      totalLeads: 0,
      conversionRate: '0',
      wonRevenue: 0,
      pipelineRevenue: 0,
      activeLeads: 0,
      avgScore: 0,
      topSegment: 'N/A',
      avgDealSize: 0,
    };
  }, [rpcKpis, groupSummary]);

  // ─── Chart Data Formats ─────────────────────────────────────────────────────
  // 1. Status Distribution for Donut Chart
  const statusPieData = useMemo(() => {
    if (rpcStatusBreakdown && rpcStatusBreakdown.length > 0) {
      return rpcStatusBreakdown.map((item, index) => {
        const stObj = leadStatuses.find((s) => s.value === item.status);
        const name = stObj?.label || item.status.replace(/_/g, ' ').toUpperCase();
        const color = stObj?.color || CHART_COLORS[index % CHART_COLORS.length];
        return {
          name,
          value: item.count,
          color,
        };
      }).sort((a, b) => b.value - a.value);
    }

    return [];
  }, [rpcStatusBreakdown, leadStatuses]);

  // 2. Funnel Chart Data
  const funnelData = useMemo(() => {
    if (rpcKpis) {
      return [
        { name: '1. Total Leads Inflow', count: rpcKpis.total_leads || 0, fill: '#3b82f6' },
        { name: '2. Active / Interested', count: rpcKpis.active_leads || 0, fill: '#f59e0b' },
        { name: '3. Closed Won (Paid)', count: rpcKpis.paid_leads || 0, fill: '#10b981' },
      ];
    }

    return [];
  }, [rpcKpis]);

  // 3. Breakdown Bar Chart Data (Top 10 segments)
  const breakdownBarData = useMemo(() => {
    return groupSummary.slice(0, 10).map((g) => ({
      name: g.name.length > 18 ? g.name.slice(0, 16) + '...' : g.name,
      fullName: g.name,
      leads: g.total,
      paid: g.paid,
      revenue: g.revenue,
    }));
  }, [groupSummary]);

  // ─── PDF Export Handler ─────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    try {
      setIsExportingPDF(true);
      toast.loading('Generating high-resolution executive PDF report...');

      const dateStr = format(new Date(), 'yyyy-MM-dd_HHmm');
      const filename = `${company?.name || 'CRM'}_Report_${dateStr}.pdf`;

      // Trigger export with multi-page support
      await exportReportToPDF({
        elementId: 'executive-printable-report',
        filename,
        orientation: 'landscape',
      });

      toast.dismiss();
      toast.success('PDF report downloaded successfully!');
    } catch (err: unknown) {
      toast.dismiss();
      console.error('PDF Export Error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to download PDF report');
    } finally {
      setIsExportingPDF(false);
    }
  };

  if (isInitialLoading) {
    return <ReportSkeleton />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* ─── Page Title & Action Header ─── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Custom Lead Reports & Analytics
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary text-xs hidden sm:inline-flex">
              Interactive Builder
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Build custom multidimensional reports, choose any lead attributes, and export executive PDF reports.
          </p>
        </div>

        {/* Action Controls: PDF Download + Customizer Modal + Leads Limit */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Customize View Modal */}
          <ReportCustomizerModal
            config={displayConfig}
            onConfigChange={setDisplayConfig}
            customColumns={customColumns}
          />

          {/* Download PDF Button */}
          <Button
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="gap-2 text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-all"
          >
            {isExportingPDF ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting PDF...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Download PDF Report
              </>
            )}
          </Button>

          {/* Turbo Performance Profiler Badge */}
          {queryDurationMs > 0 && (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md px-3 py-1.5 text-xs font-semibold shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0 animate-pulse" />
              <span>
                ⚡ Analyzed {kpiStats.totalLeads.toLocaleString('en-IN')} Leads in <strong>{queryDurationMs}ms</strong>
              </span>
            </div>
          )}
          {analyticsFetching && !queryDurationMs && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Analyzing database...</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Attribute Filters Bar ─── */}
      <ReportFilterBar
        filters={filters}
        onFilterChange={setFilters}
        leadStatuses={leadStatuses}
        teamMembers={visibleTeamMembers}
        productsList={productsList}
        availableSources={availableSources}
        customColumns={customColumns}
        totalLeadsCount={kpiStats.totalLeads}
        filteredLeadsCount={kpiStats.totalLeads}
        canViewAll={canViewAll}
        isIndividual={isIndividual}
      />

      {/* ─── Main Tabs Navigation ─── */}
      <Tabs defaultValue="custom-builder" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 border border-border/50">
          <TabsTrigger value="custom-builder" className="gap-1.5 text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Custom Report Builder
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            {isIndividual ? 'My Performance' : 'Team Performance'}
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5 text-xs">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            Daily Activity & Recency Audit
          </TabsTrigger>
          <TabsTrigger value="sources" className="gap-1.5 text-xs">
            <Tag className="h-3.5 w-3.5" />
            Sources & Marketing ROI
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
            AI Revenue Forecast
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: CUSTOM REPORT BUILDER
           ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="custom-builder" className="space-y-6">
          {/* 1. Dynamic KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            {displayConfig.kpis.totalLeads && (
              <Card className="bg-card/70 border-border/70 shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Total Leads
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpiStats.totalLeads}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Matching filter criteria</p>
                </CardContent>
              </Card>
            )}

            {displayConfig.kpis.conversionRate && (
              <Card className="bg-card/70 border-border/70 shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Conversion Rate
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-400">{kpiStats.conversionRate}%</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Leads resulted in payment</p>
                </CardContent>
              </Card>
            )}

            {displayConfig.kpis.wonRevenue && (
              <Card className="bg-card/70 border-border/70 shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Won Revenue
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-cyan-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-cyan-400">
                    {currencySymbol}
                    {kpiStats.wonRevenue.toLocaleString('en-IN')}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Actual payments collected</p>
                </CardContent>
              </Card>
            )}

            {displayConfig.kpis.pipelineRevenue && (
              <Card className="bg-card/70 border-border/70 shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Pipeline Potential
                  </CardTitle>
                  <Activity className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-400">
                    {currencySymbol}
                    {kpiStats.pipelineRevenue.toLocaleString('en-IN')}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Gross projected revenue</p>
                </CardContent>
              </Card>
            )}

            {displayConfig.kpis.activeLeads && (
              <Card className="bg-card/70 border-border/70 shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Active Pipeline
                  </CardTitle>
                  <Target className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-400">{kpiStats.activeLeads}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">In follow-up / negotiation</p>
                </CardContent>
              </Card>
            )}

            {displayConfig.kpis.topSegment && (
              <Card className="bg-card/70 border-border/70 shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Top Segment ({groupByLabel})
                  </CardTitle>
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-amber-400 truncate">{kpiStats.topSegment}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Highest lead concentration</p>
                </CardContent>
              </Card>
            )}

            {displayConfig.kpis.avgDealSize && (
              <Card className="bg-card/70 border-border/70 shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Avg Deal Size
                  </CardTitle>
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {currencySymbol}
                    {Math.round(kpiStats.avgDealSize).toLocaleString('en-IN')}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Per converted lead</p>
                </CardContent>
              </Card>
            )}

            {displayConfig.kpis.avgLeadScore && (
              <Card className="bg-card/70 border-border/70 shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Avg Lead Score
                  </CardTitle>
                  <Flame className="h-4 w-4 text-rose-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpiStats.avgScore} / 100</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Overall lead quality rating</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 2. Visual Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-5">
            {/* Breakdown Bar Chart (Group-By Dimension) */}
            {displayConfig.charts.breakdownBar && (
              <Card className={displayConfig.charts.statusPie ? 'col-span-4' : 'col-span-7'}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">
                      Leads Volume & Won by {groupByLabel}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Comparison of total assigned leads versus closed won customers.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Top 10 Segments
                  </Badge>
                </CardHeader>
                <CardContent className="pt-2">
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart
                      data={breakdownBarData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 45 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="name"
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                        height={60}
                      />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #334155',
                          backgroundColor: '#0f172a',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="leads" name="Total Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="paid" name="Closed Won" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Status Distribution Pie / Donut Chart */}
            {displayConfig.charts.statusPie && (
              <Card className={displayConfig.charts.breakdownBar ? 'col-span-3' : 'col-span-7'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieIcon className="h-4 w-4 text-primary" />
                    Status Bifurcation
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Current distribution across all lead lifecycle stages.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #334155',
                          backgroundColor: '#0f172a',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Funnel Chart */}
          {displayConfig.charts.conversionFunnel && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-500" />
                  Conversion Funnel Drop-off Analysis
                </CardTitle>
                <CardDescription className="text-xs">
                  Progression and attrition rate through sales engagement stages.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 30, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={180}
                      tick={{ fontSize: 12, fill: '#cbd5e1' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        backgroundColor: '#0f172a',
                        color: '#f8fafc',
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28}>
                      {funnelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 3. Custom Report Table (Breakdown Summary) */}
          <CustomReportTable
            groupSummary={groupSummary}
            groupByLabel={groupByLabel}
            config={displayConfig}
            onConfigChange={setDisplayConfig}
            leadStatuses={leadStatuses}
            customColumns={customColumns}
            ownersMap={ownersMap}
            currencySymbol={currencySymbol}
          />
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: TEAM PERFORMANCE
           ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {isIndividual ? 'My Performance Scorecard & Conversion Matrix' : 'Team Member Scorecard & Conversion Matrix'}
              </CardTitle>
              <CardDescription>
                {isIndividual
                  ? 'Your individual performance breakdown across leads assigned, progression, won revenue, and close rate.'
                  : 'Individual performance breakdown across leads assigned, progression, won revenue, and close rate.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>{isIndividual ? 'User Name' : 'Employee Name'}</TableHead>
                      <TableHead className="text-right">Total Leads</TableHead>
                      {leadStatuses.map((st) => (
                        <TableHead key={st.value} className="text-right whitespace-nowrap px-3 font-semibold">
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            <span
                              className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: st.color || '#3B82F6' }}
                            />
                            <span>{st.label}</span>
                          </span>
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Revenue Collected</TableHead>
                      <TableHead className="text-right">Conversion Rate</TableHead>
                      <TableHead className="text-right">Avg Quality Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleTeamMembers.map((member) => {
                      const ownerData = rpcOwnerBreakdown.find((o) => o.owner_id === member.id);
                      const total = ownerData ? ownerData.total_leads : 0;
                      const revenue = ownerData ? ownerData.revenue : 0;
                      const rate = ownerData && ownerData.conversion_rate !== undefined ? ownerData.conversion_rate.toFixed(1) : '0';
                      const statusCounts = ownerData ? (ownerData.status_counts || {}) : {};

                      return (
                        <TableRow key={member.id} className="text-xs hover:bg-muted/30">
                          <TableCell className="font-semibold text-foreground">{member.name}</TableCell>
                          <TableCell className="text-right font-medium">{total}</TableCell>
                          
                          {/* Dynamic Status Counts per Team Member */}
                          {leadStatuses.map((st) => {
                            const count = statusCounts[st.value] || 0;
                            return (
                              <TableCell key={st.value} className="text-right px-3 font-medium">
                                {count > 0 ? (
                                  <span
                                    className="font-semibold"
                                    style={{ color: st.color || undefined }}
                                  >
                                    {count}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/30 font-mono">0</span>
                                )}
                              </TableCell>
                            );
                          })}

                          <TableCell className="text-right font-semibold text-foreground">
                            {currencySymbol}
                            {revenue.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${
                                Number(rate) >= 15
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : Number(rate) > 0
                                  ? 'bg-blue-500/15 text-blue-400'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {rate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            65/100
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {/* Dynamic Unassigned Leads Row */}
                    {(() => {
                      if (!canViewAll) return null;
                      const unassigned = rpcOwnerBreakdown.find((o) => !o.owner_id || o.owner_id === 'unassigned');
                      if (!unassigned || unassigned.total_leads === 0) return null;
                      return (
                        <TableRow key="unassigned" className="text-xs hover:bg-muted/30 bg-muted/10 italic">
                          <TableCell className="font-semibold text-muted-foreground">Unassigned Leads</TableCell>
                          <TableCell className="text-right font-medium">{unassigned.total_leads}</TableCell>
                          {leadStatuses.map((st) => {
                            const count = unassigned.status_counts?.[st.value] || 0;
                            return (
                              <TableCell key={st.value} className="text-right px-3 font-medium">
                                {count > 0 ? (
                                  <span className="font-semibold" style={{ color: st.color || undefined }}>
                                    {count}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/30 font-mono">0</span>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right font-semibold text-foreground">
                            {currencySymbol}
                            {unassigned.revenue.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">
                              {unassigned.conversion_rate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">-</TableCell>
                        </TableRow>
                      );
                    })()}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: DAILY ACTIVITY & CONTACT RECENCY AUDIT
           ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="activity" className="space-y-6">
          <EmployeeActivityReport />
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 3: SOURCES & MARKETING ROI
           ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="sources" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lead Sources & Acquisition Channels</CardTitle>
              <CardDescription>
                Analyze which channels generate the highest volume and closed revenue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Channel / Source</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Share %</TableHead>
                      <TableHead className="text-right text-emerald-400">Converted</TableHead>
                      <TableHead className="text-right">Conversion Rate</TableHead>
                      <TableHead className="text-right">Revenue Generated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(rpcSourceBreakdown || []).map((sourceItem) => (
                      <TableRow key={sourceItem.source} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-semibold capitalize text-foreground">
                          {sourceItem.source}
                        </TableCell>
                        <TableCell className="text-right font-medium">{sourceItem.volume}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{sourceItem.share_percent.toFixed(1)}%</TableCell>
                        <TableCell className="text-right text-emerald-400 font-bold">{sourceItem.converted}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-[10px]">
                            {sourceItem.conversion_rate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          {currencySymbol}
                          {sourceItem.revenue.toLocaleString('en-IN')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 4: REVENUE FORECAST
           ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="forecast" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Potential Pipeline
                </CardTitle>
                <Activity className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currencySymbol}
                  {forecastData?.totalPotential?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
                </div>
                <p className="text-xs text-muted-foreground">Gross value of all active leads</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Expected Revenue
                </CardTitle>
                <BrainCircuit className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currencySymbol}
                  {forecastData?.expectedRevenue?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
                </div>
                <p className="text-xs text-muted-foreground">Probability-adjusted weighting</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Closed Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currencySymbol}
                  {forecastData?.closedRevenue?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
                </div>
                <p className="text-xs text-muted-foreground">Total payments received</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Avg Conversion
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{forecastData?.conversionRate?.toFixed(1) || '0'}%</div>
                <p className="text-xs text-muted-foreground">Leads to Paid ratio</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Pipeline Value Distribution</CardTitle>
                <CardDescription>
                  Comparison between gross pipeline value and expected revenue (probability adjusted).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={380}>
                  <ComposedChart data={forecastData?.pipelineByStatus}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                    <XAxis
                      dataKey="name"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `${currencySymbol}${val / 1000}k`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [
                        `${currencySymbol}${value.toLocaleString('en-IN')}`,
                        '',
                      ]}
                    />
                    <Legend />
                    <Bar
                      dataKey="total"
                      name="Gross Value"
                      fill="#3b82f6"
                      opacity={0.3}
                      radius={[4, 4, 0, 0]}
                    />
                    <Area
                      type="monotone"
                      dataKey="expected"
                      name="Expected Adjusted"
                      fill="#10b981"
                      stroke="#10b981"
                      fillOpacity={0.2}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  AI Forecast Insights
                </CardTitle>
                <CardDescription>Automated pipeline health check</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <h4 className="text-sm font-semibold text-blue-400 mb-1">Projected Outcome</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Based on current conversion probabilities, your pipeline of {kpiStats.totalLeads.toLocaleString('en-IN')} leads is
                    expected to generate{' '}
                    <span className="text-foreground font-bold">
                      {currencySymbol}
                      {forecastData?.expectedRevenue?.toLocaleString('en-IN') || 0}
                    </span>{' '}
                    at maturity.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Strategic Recommendations
                  </h4>
                  <ul className="space-y-2.5">
                    <li className="flex gap-2.5 text-xs text-muted-foreground items-start">
                      <div className="h-4 w-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </div>
                      Focus on conversion optimization for "Interested" leads to potentially increase Expected Revenue
                      by 15%.
                    </li>
                    <li className="flex gap-2.5 text-xs text-muted-foreground items-start">
                      <div className="h-4 w-4 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      </div>
                      High-intent leads in mid-funnel represent the largest opportunity for immediate revenue growth.
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Hidden Printable Template for High-Fidelity PDF Export ─── */}
      <div
        style={{
          position: 'absolute',
          top: '-99999px',
          left: '-99999px',
          overflow: 'hidden',
          width: '1100px',
        }}
      >
        <ReportPrintableTemplate
          id="executive-printable-report"
          ref={printableRef}
          config={displayConfig}
          filters={filters}
          companyName={company?.name || 'FastestCRM Enterprise'}
          logoUrl={company?.logo_url}
          generatedBy={user?.email || 'Sales Administrator'}
          currencySymbol={currencySymbol}
          groupSummary={groupSummary}
          groupByLabel={groupByLabel}
          kpiStats={kpiStats}
          leads={[]}
          leadStatuses={leadStatuses}
          customColumns={customColumns}
          ownersMap={ownersMap}
        />
      </div>
    </div>
  );
}
