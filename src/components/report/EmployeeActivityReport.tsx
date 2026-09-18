import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useEmployeeActivityReport,
  ActivityDatePreset,
  ActivityStatusBadge,
  EmployeeActivityMetric,
  LeadTimelineItem,
} from '@/hooks/useEmployeeActivityReport';
import {
  Activity,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  History,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
  User,
  Users,
  Zap,
  BarChart3,
  ListFilter,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';

export function EmployeeActivityReport() {
  const {
    employees,
    summary,
    dailyTrend,
    isLoading,
    isRefetching,
    refetch,
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
  } = useEmployeeActivityReport();

  // Active view: 'table' | 'chart'
  const [activeView, setActiveView] = useState<'table' | 'chart'>('table');

  // Drilldown modal state
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeActivityMetric | null>(null);
  const [timelineItems, setTimelineItems] = useState<LeadTimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState<boolean>(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(false);

  // Maximum unique leads for progress bar scaling
  const maxUniqueLeads = Math.max(...employees.map((e) => e.unique_leads_worked), 1);

  // Open timeline modal
  const handleOpenTimeline = async (emp: EmployeeActivityMetric) => {
    setSelectedEmployee(emp);
    setIsTimelineOpen(true);
    setTimelineLoading(true);
    try {
      const items = await fetchEmployeeTimeline(emp.user_id, 100);
      setTimelineItems(items);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setTimelineLoading(false);
    }
  };

  // Format status or action strings
  const formatLabel = (str?: string | null) => {
    if (!str) return '—';
    return str
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Status Badge Component
  const renderStatusBadge = (badge?: ActivityStatusBadge, secondsAgo?: number) => {
    if (!badge || badge === 'inactive') {
      return (
        <Badge variant="outline" className="bg-muted/40 text-muted-foreground border-border/40 text-[11px] font-normal gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500 shrink-0" />
          Inactive
        </Badge>
      );
    }

    if (badge === 'active_now') {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium gap-1.5 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          Active Now
        </Badge>
      );
    }

    if (badge === 'idle') {
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-medium gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
          Idle (&lt; 1h)
        </Badge>
      );
    }

    return (
      <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[11px] font-normal gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
        Earlier Today
      </Badge>
    );
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!employees.length) return;
    const headers = [
      'Employee Name',
      'Email',
      'CRM Status',
      'Unique Leads Worked On',
      'Total Actions',
      'Last Action',
      'Last Target Lead',
      'Last Active Timestamp',
    ];

    const rows = employees.map((emp) => [
      `"${emp.name.replace(/"/g, '""')}"`,
      `"${emp.email.replace(/"/g, '""')}"`,
      `"${emp.last_activity?.status_badge || 'inactive'}"`,
      emp.unique_leads_worked,
      emp.total_actions,
      `"${emp.last_activity?.action || '—'}"`,
      `"${(emp.last_activity?.lead_name || '—').replace(/"/g, '""')}"`,
      `"${emp.last_activity?.timestamp || '—'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `employee_daily_activity_${datePreset}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepare chart data for daily trend
  const chartData = React.useMemo(() => {
    if (!dailyTrend.length) return [];
    const dateMap = new Map<string, any>();

    dailyTrend.forEach((item) => {
      const dKey = format(parseISO(item.date), 'MMM dd');
      if (!dateMap.has(dKey)) {
        dateMap.set(dKey, { date: dKey });
      }
      const obj = dateMap.get(dKey);
      obj[item.name] = item.unique_leads;
    });

    return Array.from(dateMap.values());
  }, [dailyTrend]);

  // Unique names in daily trend for chart bars (limit to top 6 for visual clarity)
  const topTrendNames = React.useMemo(() => {
    const counts = new Map<string, number>();
    dailyTrend.forEach((t) => counts.set(t.name, (counts.get(t.name) || 0) + t.unique_leads));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map((entry) => entry[0]);
  }, [dailyTrend]);

  const CHART_PALETTE = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* ─── Top Control & Preset Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 p-4 rounded-xl border border-border/70 backdrop-blur-sm shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              Employee Daily Activity & Workload Audit
            </h3>
            {queryDurationMs > 0 && (
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                ⚡ {queryDurationMs}ms
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time audit of unique lead data edited, actions performed, and employee contact recency.
          </p>
        </div>

        {/* Date Filter & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            value={datePreset}
            onValueChange={(val: ActivityDatePreset) => setDatePreset(val)}
          >
            <SelectTrigger className="w-[145px] h-9 text-xs bg-background">
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="14d">Last 14 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-9 text-xs w-[130px] bg-background"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-9 text-xs w-[130px] bg-background"
              />
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="h-9 px-3 text-xs gap-1.5"
            title="Refresh Live Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={employees.length === 0}
            className="h-9 px-3 text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ─── Executive KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Unique Leads Worked On */}
        <Card className="bg-gradient-to-br from-emerald-500/10 via-card/80 to-card border-border/80 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Daily Data Worked On
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground tracking-tight">
              {isLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                summary?.total_unique_leads_worked.toLocaleString('en-IN') || 0
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-medium">Distinct lead records</span> edited in window
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Contact Actions */}
        <Card className="bg-gradient-to-br from-cyan-500/10 via-card/80 to-card border-border/80 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Contact Actions
            </CardTitle>
            <Zap className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground tracking-tight">
              {isLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                summary?.total_actions.toLocaleString('en-IN') || 0
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Status changes, notes, & assignments logged
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Active Employees & Live Status */}
        <Card className="bg-gradient-to-br from-violet-500/10 via-card/80 to-card border-border/80 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Team Members
            </CardTitle>
            <Users className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground tracking-tight">
              {isLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                `${summary?.active_employees_count || 0} / ${summary?.total_employees_count || 0}`
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {(summary?.active_now_count || 0) > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {summary?.active_now_count} active right now
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">Logged contact activity today</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Top Performer */}
        <Card className="bg-gradient-to-br from-amber-500/10 via-card/80 to-card border-border/80 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Top Workload Performer
            </CardTitle>
            <Trophy className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-extrabold text-foreground tracking-tight truncate">
              {isLoading ? (
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              ) : (
                summary?.top_performer?.name || 'No Activity'
              )}
            </div>
            <p className="text-[11px] text-amber-400/90 font-medium mt-1">
              {summary?.top_performer ? (
                `${summary.top_performer.unique_leads_worked} unique leads worked`
              ) : (
                'Awaiting today\'s records'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Search, Filter, & View Toolbar ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-3 rounded-lg border border-border/50">
        <div className="flex flex-wrap items-center gap-2">
          {/* Employee Search input */}
          <div className="relative w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>

          {/* Quick status filter pills */}
          <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-md border border-border/50">
            {(
              [
                { label: 'All', value: 'all' },
                { label: 'Active Now', value: 'active_now' },
                { label: 'Idle', value: 'idle' },
                { label: 'Earlier', value: 'earlier_today' },
                { label: 'Inactive', value: 'inactive' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* View Switcher: Table vs Trend Chart */}
        <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-md border border-border/50 self-end sm:self-auto">
          <button
            onClick={() => setActiveView('table')}
            className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors ${
              activeView === 'table'
                ? 'bg-muted text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListFilter className="h-3 w-3" />
            Table View
          </button>
          <button
            onClick={() => setActiveView('chart')}
            className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors ${
              activeView === 'chart'
                ? 'bg-muted text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="h-3 w-3" />
            Workload Chart
          </button>
        </div>
      </div>

      {/* ─── Main Content View: Table or Workload Chart ─── */}
      {activeView === 'table' ? (
        <Card className="border-border/70 shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Employee Daily Activity & Contact Recency Ledger
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Detailed individual metrics for unique leads touched and exact last contact activity.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {employees.length} Team Members
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading high-speed activity matrix...</p>
              </div>
            ) : employees.length === 0 ? (
              <div className="py-16 text-center">
                <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <h4 className="text-sm font-semibold text-foreground">No Activity Records Found</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  No lead contact activity was recorded matching the selected date range and filter criteria.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-muted/20">
                      <TableHead className="w-[240px]">Employee</TableHead>
                      <TableHead className="w-[140px]">Live CRM Status</TableHead>
                      <TableHead className="text-right w-[190px]">Unique Data Worked On</TableHead>
                      <TableHead className="text-right w-[130px]">Total Actions</TableHead>
                      <TableHead className="min-w-[260px]">Last Contact Activity</TableHead>
                      <TableHead className="text-right w-[150px]">Last Active</TableHead>
                      <TableHead className="text-center w-[110px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => {
                      const lastAct = emp.last_activity;
                      const uniquePercent = Math.round((emp.unique_leads_worked / maxUniqueLeads) * 100);

                      return (
                        <TableRow key={emp.user_id} className="text-xs hover:bg-muted/30 transition-colors">
                          {/* 1. Employee Info */}
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="relative">
                                <Avatar className="h-8 w-8 border border-border/50">
                                  <AvatarImage src={emp.avatar_url || ''} />
                                  <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                                    {emp.name.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                {lastAct?.status_badge === 'active_now' && (
                                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground truncate">{emp.name}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{emp.email}</div>
                              </div>
                            </div>
                          </TableCell>

                          {/* 2. Live CRM Status */}
                          <TableCell>
                            {renderStatusBadge(lastAct?.status_badge, lastAct?.seconds_ago)}
                          </TableCell>

                          {/* 3. Unique Data Worked On (Core Metric 1) */}
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={`font-mono text-sm font-bold ${
                                  emp.unique_leads_worked > 0
                                    ? 'text-emerald-400'
                                    : 'text-muted-foreground/50'
                                }`}
                              >
                                {emp.unique_leads_worked}
                              </span>
                              <div className="w-24 bg-muted/50 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${uniquePercent}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>

                          {/* 4. Total Actions */}
                          <TableCell className="text-right">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="font-mono font-medium text-foreground cursor-help underline decoration-dotted underline-offset-4">
                                    {emp.total_actions}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs p-2 space-y-1 bg-popover border-border">
                                  <div className="font-bold text-[11px] text-muted-foreground mb-1">
                                    Action Breakdown
                                  </div>
                                  {Object.keys(emp.action_counts || {}).length > 0 ? (
                                    Object.entries(emp.action_counts).map(([act, count]) => (
                                      <div key={act} className="flex justify-between gap-4 text-[11px]">
                                        <span className="capitalize">{formatLabel(act)}:</span>
                                        <span className="font-mono font-bold text-foreground">{count}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-[11px] text-muted-foreground">No actions in window</div>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>

                          {/* 5. Last Contact Activity (Core Metric 2) */}
                          <TableCell>
                            {lastAct ? (
                              <div className="flex flex-col gap-0.5 max-w-[280px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-foreground truncate">
                                    {lastAct.lead_name}
                                  </span>
                                  {lastAct.action === 'status_change' && lastAct.new_status && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0 capitalize shrink-0 font-normal bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                    >
                                      → {formatLabel(lastAct.new_status)}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground capitalize">
                                  {formatLabel(lastAct.action)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40 font-mono text-[11px]">No activity logged</span>
                            )}
                          </TableCell>

                          {/* 6. Last Active Recency */}
                          <TableCell className="text-right">
                            {lastAct ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help">
                                      <span
                                        className={`font-medium ${
                                          lastAct.status_badge === 'active_now'
                                            ? 'text-emerald-400 font-bold'
                                            : lastAct.status_badge === 'idle'
                                            ? 'text-amber-400'
                                            : 'text-muted-foreground'
                                        }`}
                                      >
                                        {getRelativeTime(lastAct.seconds_ago)}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-xs">
                                    {format(new Date(lastAct.timestamp), 'PPpp')}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </TableCell>

                          {/* 7. Action Button */}
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenTimeline(emp)}
                              className="h-7 px-2 text-[11px] hover:bg-muted gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <History className="h-3 w-3" />
                              Audit
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ─── Workload Trend Chart View ─── */
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Unique Leads Worked Daily Trend
            </CardTitle>
            <CardDescription className="text-xs">
              Daily distribution of unique leads touched per employee across the selected timeframe.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {chartData.length === 0 ? (
              <div className="py-16 text-center text-xs text-muted-foreground">
                No trend data available for this range. Select a wider date range (e.g. Last 7 or 30 Days).
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      backgroundColor: '#0f172a',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  {topTrendNames.map((name, i) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      name={name}
                      fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Employee Activity Audit Timeline Modal ─── */}
      <Dialog open={isTimelineOpen} onOpenChange={setIsTimelineOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="pb-3 border-b border-border/50">
            <DialogTitle className="flex items-center gap-2.5 text-base font-bold">
              <History className="h-5 w-5 text-emerald-500" />
              Activity Audit Log: {selectedEmployee?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Chronological log of leads touched and updates performed in this reporting window.
            </DialogDescription>
          </DialogHeader>

          {/* Quick stats banner */}
          <div className="grid grid-cols-2 gap-3 py-3 bg-muted/20 px-3 rounded-lg border border-border/40 my-2">
            <div>
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Unique Leads Worked</div>
              <div className="text-lg font-bold text-emerald-400">
                {selectedEmployee?.unique_leads_worked || 0}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Total Actions Recorded</div>
              <div className="text-lg font-bold text-foreground">
                {selectedEmployee?.total_actions || 0}
              </div>
            </div>
          </div>

          {/* Timeline items list */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 mt-2 min-h-[260px] max-h-[420px]">
            {timelineLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Fetching detailed audit events...</span>
              </div>
            ) : timelineItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No granular audit events recorded in this window.
              </div>
            ) : (
              <div className="relative border-l-2 border-muted ml-3 space-y-4 py-1">
                {timelineItems.map((item) => (
                  <div key={item.id} className="relative pl-5 group">
                    <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-background" />
                    <div className="bg-card/70 border border-border/60 p-3 rounded-lg hover:border-border transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {item.lead_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                          {format(new Date(item.created_at), 'PP p')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] font-normal capitalize">
                          {formatLabel(item.action)}
                        </Badge>
                        {item.new_status && (
                          <span className="text-[11px] text-muted-foreground">
                            {item.old_status ? `${formatLabel(item.old_status)} → ` : ''}
                            <span className="font-medium text-emerald-400">{formatLabel(item.new_status)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
