import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeads, Lead } from '@/hooks/useLeads';
import { useTeam } from '@/hooks/useTeam';
import { useProducts } from '@/hooks/useProducts';
import { useLeadStatuses, CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { useCustomColumns } from '@/hooks/useCustomColumns';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useForecast } from '@/hooks/useForecast';
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
  const [reportLimit, setReportLimit] = useState<number>(0); // 0 means All Leads (unlimited)
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

  // Queries - fetch all leads with optional user-specified cap
  const effectiveLimit = reportLimit > 0 ? reportLimit : undefined;
  const { data: leadsData, isLoading: leadsLoading, isFetching: leadsFetching } = useLeads({
    fetchAll: true,
    limit: effectiveLimit,
  });
  const { members, loading: teamLoading } = useTeam();
  const { products } = useProducts();
  const { statuses: leadStatuses, isLoading: statusesLoading } = useLeadStatuses();
  const { customColumns, loading: customColumnsLoading } = useCustomColumns('leads');
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: forecastData, isLoading: forecastLoading } = useForecast();

  const allLeads = useMemo(() => leadsData?.leads || [], [leadsData]);
  const isLoading = leadsLoading || teamLoading || statusesLoading;

  // Currency symbol
  const currencySymbol = company?.default_currency === 'USD' ? '$' : '₹';

  // Team members lookup
  const teamMembers = useMemo(() => {
    return (members || []).map((m) => ({
      id: m.id,
      name: m.full_name || m.email?.split('@')[0] || 'Unknown Member',
    }));
  }, [members]);

  const ownersMap = useMemo(() => {
    const map: Record<string, string> = {};
    teamMembers.forEach((m) => {
      map[m.id] = m.name;
    });
    return map;
  }, [teamMembers]);

  // Unique lead sources extracted from actual dataset
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    allLeads.forEach((l) => {
      if (l.lead_source && typeof l.lead_source === 'string' && l.lead_source.trim()) {
        set.add(l.lead_source.trim().toLowerCase());
      }
    });
    // Common default sources if empty
    ['website', 'google ads', 'facebook ads', 'referral', 'organic', 'inbound', 'cold call', 'email campaign'].forEach(
      (s) => set.add(s)
    );
    return Array.from(set).sort();
  }, [allLeads]);

  // Dynamic products list
  const productsList = useMemo(() => {
    const list: { id: string; name: string; category?: string }[] = (products || []).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
    }));

    // Also include any distinct product_purchased values found on leads
    const existingNames = new Set(list.map((p) => p.name.toLowerCase()));
    allLeads.forEach((l) => {
      if (l.product_purchased && !existingNames.has(l.product_purchased.toLowerCase())) {
        list.push({ id: l.product_purchased, name: l.product_purchased, category: (l as any).product_category });
        existingNames.add(l.product_purchased.toLowerCase());
      }
    });

    return list;
  }, [products, allLeads]);

  // 1. Master Filter State
  const [filters, setFilters] = useState<ReportFilterState>({
    search: '',
    datePreset: 'all',
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
    reportTitle: `${company?.name || 'Company'} Lead & Performance Report`,
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

  // ─── Filter Computation Engine ──────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    return allLeads.filter((lead) => {
      // A. Search Query
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const matchesSearch =
          lead.name?.toLowerCase().includes(q) ||
          lead.email?.toLowerCase().includes(q) ||
          lead.phone?.toLowerCase().includes(q) ||
          lead.lead_source?.toLowerCase().includes(q) ||
          lead.product_purchased?.toLowerCase().includes(q) ||
          lead.notes?.toLowerCase().includes(q) ||
          lead.college?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // B. Date Preset & Range
      if (filters.datePreset !== 'all' && lead.created_at) {
        const leadDate = new Date(lead.created_at);
        const now = new Date();

        if (filters.datePreset === 'today') {
          if (leadDate < startOfDay(now) || leadDate > endOfDay(now)) return false;
        } else if (filters.datePreset === 'yesterday') {
          const yest = subDays(now, 1);
          if (leadDate < startOfDay(yest) || leadDate > endOfDay(yest)) return false;
        } else if (filters.datePreset === '7d') {
          if (leadDate < subDays(now, 7)) return false;
        } else if (filters.datePreset === '30d') {
          if (leadDate < subDays(now, 30)) return false;
        } else if (filters.datePreset === 'this_month') {
          if (leadDate < startOfMonth(now) || leadDate > endOfMonth(now)) return false;
        } else if (filters.datePreset === 'last_month') {
          const lastMonth = subMonths(now, 1);
          if (leadDate < startOfMonth(lastMonth) || leadDate > endOfMonth(lastMonth)) return false;
        } else if (filters.datePreset === 'this_quarter') {
          if (leadDate < startOfQuarter(now)) return false;
        } else if (filters.datePreset === 'custom') {
          if (filters.customStartDate && isBefore(leadDate, startOfDay(new Date(filters.customStartDate)))) {
            return false;
          }
          if (filters.customEndDate && isAfter(leadDate, endOfDay(new Date(filters.customEndDate)))) {
            return false;
          }
        }
      }

      // C. Status Filter (Multi-select)
      if (filters.statuses.length > 0) {
        if (!filters.statuses.includes(lead.status)) return false;
      }

      // D. Sales Owner Filter (Multi-select)
      if (filters.owners.length > 0) {
        const isUnassigned = !lead.sales_owner_id;
        const wantsUnassigned = filters.owners.includes('unassigned');
        const matchesOwner = filters.owners.includes(lead.sales_owner_id || '');

        if (isUnassigned && !wantsUnassigned) return false;
        if (!isUnassigned && !matchesOwner) return false;
      }

      // E. Lead Source Filter (Multi-select)
      if (filters.sources.length > 0) {
        const src = (lead.lead_source || '').toLowerCase().trim();
        if (!filters.sources.some((s) => s.toLowerCase() === src)) return false;
      }

      // F. Product Filter (Multi-select)
      if (filters.products.length > 0) {
        const prod = lead.product_purchased || '';
        if (!filters.products.includes(prod)) return false;
      }

      // G. Priority / Lead Score Filter (Multi-select)
      if (filters.priorities.length > 0) {
        const { level } = calculateLeadScore(lead);
        if (!filters.priorities.includes(level)) return false;
      }

      // H. Revenue Status Filter
      if (filters.revenueStatus === 'with_revenue') {
        if (!lead.revenue_received || lead.revenue_received <= 0) return false;
      } else if (filters.revenueStatus === 'zero_revenue') {
        if (lead.revenue_received && lead.revenue_received > 0) return false;
      }

      // I. Custom Field Filters
      if (filters.customFieldFilters.length > 0) {
        for (const cf of filters.customFieldFilters) {
          const rawVal =
            (lead as any)[cf.fieldId] ??
            (lead as any).custom_data?.[cf.fieldId] ??
            '';
          const strVal = String(rawVal).toLowerCase();
          if (!strVal.includes(cf.value.toLowerCase())) {
            return false;
          }
        }
      }

      return true;
    });
  }, [allLeads, filters]);

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
    const groups: Record<
      string,
      {
        name: string;
        total: number;
        inProgress: number;
        paid: number;
        revenue: number;
        totalScore: number;
        statusCounts: Record<string, number>;
      }
    > = {};

    filteredLeads.forEach((lead) => {
      let groupKey = 'unknown';
      let groupName = 'Unknown';

      if (displayConfig.groupBy === 'owner') {
        groupKey = lead.sales_owner_id || 'unassigned';
        groupName = ownersMap[lead.sales_owner_id || ''] || lead.sales_owner?.full_name || 'Unassigned';
      } else if (displayConfig.groupBy === 'status') {
        groupKey = lead.status || 'other';
        const stObj = leadStatuses.find((s) => s.value === lead.status);
        groupName = stObj ? stObj.label : lead.status.replace(/_/g, ' ').toUpperCase();
      } else if (displayConfig.groupBy === 'source') {
        groupKey = (lead.lead_source || 'Unknown').toLowerCase();
        groupName = lead.lead_source || 'Direct / Organic';
      } else if (displayConfig.groupBy === 'product') {
        groupKey = (lead.product_purchased || 'Unspecified').toLowerCase();
        groupName = lead.product_purchased || 'General Inquiry';
      } else if (displayConfig.groupBy === 'priority') {
        const { level } = calculateLeadScore(lead);
        groupKey = level;
        groupName = level === 'hot' ? '🔥 Hot Leads' : level === 'warm' ? '⚡ Warm Leads' : '❄️ Cold Leads';
      } else if (displayConfig.groupBy === 'date') {
        if (lead.created_at) {
          const d = new Date(lead.created_at);
          groupKey = format(d, 'yyyy-MM');
          groupName = format(d, 'MMMM yyyy');
        } else {
          groupKey = 'no-date';
          groupName = 'No Date';
        }
      } else if (displayConfig.groupBy.startsWith('custom:')) {
        const colId = displayConfig.groupBy.replace('custom:', '');
        const val = (lead as any)[colId] ?? (lead as any).custom_data?.[colId] ?? 'Unspecified';
        groupKey = String(val).toLowerCase();
        groupName = String(val);
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          name: groupName,
          total: 0,
          inProgress: 0,
          paid: 0,
          revenue: 0,
          totalScore: 0,
          statusCounts: {},
        };
      }

      groups[groupKey].total += 1;

      // Track dynamic custom status count
      const rawStatus = lead.status || 'other';
      groups[groupKey].statusCounts[rawStatus] = (groups[groupKey].statusCounts[rawStatus] || 0) + 1;

      // Status classification for conversion metrics
      const statusObj = leadStatuses.find((s) => s.value === lead.status);
      const isPaid =
        lead.status === 'paid' ||
        statusObj?.category === 'paid' ||
        (lead.revenue_received !== null && lead.revenue_received !== undefined && lead.revenue_received > 0);
      const isInProgress =
        ['interested', 'follow_up', 'site_visit', 'negotiation'].includes(lead.status) ||
        statusObj?.category === 'interested';

      if (isPaid) {
        groups[groupKey].paid += 1;
      } else if (isInProgress) {
        groups[groupKey].inProgress += 1;
      }

      groups[groupKey].revenue += lead.revenue_received || 0;
      const { score } = calculateLeadScore(lead);
      groups[groupKey].totalScore += score;
    });

    const totalCount = filteredLeads.length || 1;

    return Object.entries(groups)
      .map(([key, data]) => {
        const sharePercent = ((data.total / totalCount) * 100).toFixed(1);
        const conversionRate = data.total > 0 ? ((data.paid / data.total) * 100).toFixed(1) : '0';
        const avgScore = data.total > 0 ? Math.round(data.totalScore / data.total) : 0;

        return {
          key,
          name: data.name,
          total: data.total,
          sharePercent,
          inProgress: data.inProgress,
          paid: data.paid,
          conversionRate,
          revenue: data.revenue,
          avgScore,
          statusCounts: data.statusCounts,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredLeads, displayConfig.groupBy, ownersMap, leadStatuses, customColumns]);

  // ─── KPI Stats Calculation ──────────────────────────────────────────────────
  const kpiStats = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const paidLeads = filteredLeads.filter((l) => l.status === 'paid' || (l.revenue_received || 0) > 0).length;
    const activeLeads = filteredLeads.filter((l) =>
      ['interested', 'follow_up', 'site_visit', 'negotiation'].includes(l.status)
    ).length;
    const wonRevenue = filteredLeads.reduce((sum, l) => sum + (l.revenue_received || 0), 0);
    const pipelineRevenue = filteredLeads.reduce((sum, l) => sum + (l.revenue_projected || 0), 0);
    const conversionRate = totalLeads > 0 ? ((paidLeads / totalLeads) * 100).toFixed(1) : '0';
    const avgDealSize = paidLeads > 0 ? wonRevenue / paidLeads : 0;

    const totalScores = filteredLeads.reduce((sum, l) => sum + calculateLeadScore(l).score, 0);
    const avgScore = totalLeads > 0 ? Math.round(totalScores / totalLeads) : 0;

    const topSegment = groupSummary[0]?.name || 'N/A';

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
  }, [filteredLeads, groupSummary]);

  // ─── Chart Data Formats ─────────────────────────────────────────────────────
  // 1. Status Distribution for Donut Chart
  const statusPieData = useMemo(() => {
    const counts: Record<string, { name: string; value: number; color: string }> = {};
    filteredLeads.forEach((l) => {
      const st = l.status || 'other';
      const stObj = leadStatuses.find((s) => s.value === st);
      const label = stObj?.label || st.replace(/_/g, ' ').toUpperCase();
      const color = stObj?.color || '#3b82f6';

      if (!counts[st]) {
        counts[st] = { name: label, value: 0, color };
      }
      counts[st].value += 1;
    });

    return Object.values(counts).sort((a, b) => b.value - a.value);
  }, [filteredLeads, leadStatuses]);

  // 2. Funnel Chart Data
  const funnelData = useMemo(() => {
    const total = filteredLeads.length;
    const inProgress = filteredLeads.filter((l) =>
      ['interested', 'follow_up', 'site_visit', 'negotiation'].includes(l.status)
    ).length;
    const won = filteredLeads.filter((l) => l.status === 'paid' || (l.revenue_received || 0) > 0).length;

    return [
      { name: '1. Total Leads Inflow', count: total, fill: '#3b82f6' },
      { name: '2. Active / Interested', count: inProgress, fill: '#f59e0b' },
      { name: '3. Closed Won (Paid)', count: won, fill: '#10b981' },
    ];
  }, [filteredLeads]);

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
    } catch (err: any) {
      toast.dismiss();
      console.error('PDF Export Error:', err);
      toast.error(err.message || 'Failed to download PDF report');
    } finally {
      setIsExportingPDF(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading custom report engine...</p>
        </div>
      </div>
    );
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

          {/* Dataset Range Limit Selector */}
          <div className="flex items-center gap-1.5 bg-card/60 border border-border/60 rounded-md px-2.5 py-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Data Limit:
            </span>
            <Select
              value={reportLimit.toString()}
              onValueChange={(val) => setReportLimit(Number(val))}
            >
              <SelectTrigger className="w-[125px] h-7 border-0 bg-transparent text-xs p-0 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="0">All Leads (Complete)</SelectItem>
                <SelectItem value="1000">Recent 1,000</SelectItem>
                <SelectItem value="5000">Recent 5,000</SelectItem>
                <SelectItem value="10000">Recent 10,000</SelectItem>
                <SelectItem value="25000">Recent 25,000</SelectItem>
                <SelectItem value="50000">Recent 50,000</SelectItem>
                <SelectItem value="100000">Recent 100,000</SelectItem>
              </SelectContent>
            </Select>
            {leadsFetching && (
              <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
            )}
          </div>
        </div>
      </div>

      {/* ─── Attribute Filters Bar ─── */}
      <ReportFilterBar
        filters={filters}
        onFilterChange={setFilters}
        leadStatuses={leadStatuses}
        teamMembers={teamMembers}
        productsList={productsList}
        availableSources={availableSources}
        customColumns={customColumns}
        totalLeadsCount={allLeads.length}
        filteredLeadsCount={filteredLeads.length}
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
            Team Performance
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

          {/* 3. Custom Report Table (Breakdown Summary & Filtered Lead Records) */}
          <CustomReportTable
            leads={filteredLeads}
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
              <CardTitle>Team Member Scorecard & Conversion Matrix</CardTitle>
              <CardDescription>
                Individual performance breakdown across leads assigned, progression, won revenue, and close rate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Employee Name</TableHead>
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
                    {teamMembers.map((member) => {
                      const memberLeads = filteredLeads.filter((l) => l.sales_owner_id === member.id);
                      const total = memberLeads.length;
                      const paid = memberLeads.filter((l) => {
                        const sObj = leadStatuses.find((s) => s.value === l.status);
                        return l.status === 'paid' || sObj?.category === 'paid' || (l.revenue_received || 0) > 0;
                      }).length;
                      const revenue = memberLeads.reduce((sum, l) => sum + (l.revenue_received || 0), 0);
                      const rate = total > 0 ? ((paid / total) * 100).toFixed(1) : '0';
                      const avgScore =
                        total > 0
                          ? Math.round(
                              memberLeads.reduce((sum, l) => sum + calculateLeadScore(l).score, 0) / total
                            )
                          : 0;

                      return (
                        <TableRow key={member.id} className="text-xs hover:bg-muted/30">
                          <TableCell className="font-semibold text-foreground">{member.name}</TableCell>
                          <TableCell className="text-right font-medium">{total}</TableCell>
                          
                          {/* Dynamic Status Counts per Team Member */}
                          {leadStatuses.map((st) => {
                            const count = memberLeads.filter((l) => l.status === st.value).length;
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
                            {avgScore}/100
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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
                    {availableSources.map((sourceName) => {
                      const srcLeads = filteredLeads.filter(
                        (l) => (l.lead_source || '').toLowerCase().trim() === sourceName.toLowerCase()
                      );
                      if (srcLeads.length === 0) return null;

                      const total = srcLeads.length;
                      const share = ((total / (filteredLeads.length || 1)) * 100).toFixed(1);
                      const paid = srcLeads.filter((l) => l.status === 'paid' || (l.revenue_received || 0) > 0).length;
                      const rate = total > 0 ? ((paid / total) * 100).toFixed(1) : '0';
                      const revenue = srcLeads.reduce((sum, l) => sum + (l.revenue_received || 0), 0);

                      return (
                        <TableRow key={sourceName} className="text-xs hover:bg-muted/30">
                          <TableCell className="font-semibold capitalize text-foreground">
                            {sourceName}
                          </TableCell>
                          <TableCell className="text-right font-medium">{total}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{share}%</TableCell>
                          <TableCell className="text-right text-emerald-400 font-bold">{paid}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="text-[10px]">
                              {rate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            {currencySymbol}
                            {revenue.toLocaleString('en-IN')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
                    Based on current conversion probabilities, your pipeline of {filteredLeads.length} leads is
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
          leads={filteredLeads}
          leadStatuses={leadStatuses}
          customColumns={customColumns}
          ownersMap={ownersMap}
        />
      </div>
    </div>
  );
}
