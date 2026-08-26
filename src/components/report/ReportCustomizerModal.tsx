import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SlidersHorizontal, BarChart3, PieChart, Table2, Layers, Sparkles, Check } from 'lucide-react';
import { CustomColumn } from '@/hooks/useCustomColumns';

export type GroupByDimension =
  | 'owner'
  | 'status'
  | 'source'
  | 'product'
  | 'priority'
  | 'date'
  | 'date_month'
  | 'date_quarter'
  | 'date_day'
  | 'city'
  | string; // For dynamic custom fields e.g. "custom:<id>"

export type ReportDimension = GroupByDimension;

export type ReportColumnDimension =
  | 'status'
  | 'owner'
  | 'source'
  | 'product'
  | 'priority'
  | 'date_month'
  | 'metrics'
  | string;

export type MatrixMetricType =
  | 'count'
  | 'revenue'
  | 'pipeline'
  | 'avg_score';

export interface VisibleKPICards {
  totalLeads: boolean;
  conversionRate: boolean;
  wonRevenue: boolean;
  pipelineRevenue: boolean;
  activeLeads: boolean;
  topSegment: boolean;
  avgDealSize: boolean;
  avgLeadScore: boolean;
}

export interface VisibleCharts {
  breakdownBar: boolean;
  statusPie: boolean;
  conversionFunnel: boolean;
  revenueArea: boolean;
}

export interface VisibleTableColumns {
  name: boolean;
  contact: boolean;
  status: boolean;
  owner: boolean;
  source: boolean;
  product: boolean;
  revenue: boolean;
  priority: boolean;
  createdAt: boolean;
  [customColId: string]: boolean;
}

export interface ReportDisplayConfig {
  reportTitle: string;
  reportSubtitle: string;
  executiveNotes: string;
  groupBy: GroupByDimension;
  rowDimension?: ReportDimension;
  colDimension?: ReportColumnDimension;
  cellMetric?: MatrixMetricType;
  kpis: VisibleKPICards;
  charts: VisibleCharts;
  columns: VisibleTableColumns;
  showBreakdownSummary: boolean;
  showLeadDetailsTable: boolean;
}

interface ReportCustomizerModalProps {
  config: ReportDisplayConfig;
  onConfigChange: (newConfig: ReportDisplayConfig) => void;
  customColumns: CustomColumn[];
  trigger?: React.ReactNode;
}

export function ReportCustomizerModal({
  config,
  onConfigChange,
  customColumns,
  trigger,
}: ReportCustomizerModalProps) {
  const [open, setOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<ReportDisplayConfig>(config);

  const handleOpen = (newOpen: boolean) => {
    if (newOpen) {
      setLocalConfig(config);
    }
    setOpen(newOpen);
  };

  const handleSave = () => {
    onConfigChange(localConfig);
    setOpen(false);
  };

  const handleSwapDimensions = () => {
    setLocalConfig((prev) => {
      const currentRow = prev.rowDimension || prev.groupBy || 'owner';
      const currentCol = prev.colDimension || 'status';
      return {
        ...prev,
        groupBy: currentCol as GroupByDimension,
        rowDimension: currentCol as ReportDimension,
        colDimension: currentRow as ReportColumnDimension,
      };
    });
  };

  const toggleKPI = (key: keyof VisibleKPICards) => {
    setLocalConfig((prev) => ({
      ...prev,
      kpis: { ...prev.kpis, [key]: !prev.kpis[key] },
    }));
  };

  const toggleChart = (key: keyof VisibleCharts) => {
    setLocalConfig((prev) => ({
      ...prev,
      charts: { ...prev.charts, [key]: !prev.charts[key] },
    }));
  };

  const toggleColumn = (key: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      columns: { ...prev.columns, [key]: !prev.columns[key] },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2 text-xs h-9 bg-card/60 hover:bg-card">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Customize Report Layout
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            Customize Report & Matrix Presentation
          </DialogTitle>
          <DialogDescription>
            Choose what dimensions to place in rows and columns, select cell metrics, and tailor charts/columns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* 1. Report Title & Notes */}
          <div className="space-y-3 p-3.5 bg-muted/20 rounded-lg border border-border/50">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" /> Report Header & Notes
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Report Title</Label>
                <Input
                  value={localConfig.reportTitle}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({ ...prev, reportTitle: e.target.value }))
                  }
                  placeholder="e.g. Executive Performance & Pipeline Report"
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Subtitle / Purpose</Label>
                <Input
                  value={localConfig.reportSubtitle}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({ ...prev, reportSubtitle: e.target.value }))
                  }
                  placeholder="e.g. Lead conversion analysis and revenue breakdown"
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Executive Summary / Remarks (Included in PDF)</Label>
              <Textarea
                value={localConfig.executiveNotes}
                onChange={(e) =>
                  setLocalConfig((prev) => ({ ...prev, executiveNotes: e.target.value }))
                }
                placeholder="Add optional notes, target milestones, or strategic observations for this report..."
                className="text-xs bg-background min-h-[60px]"
              />
            </div>
          </div>

          {/* 2. Multi-Dimensional Matrix / Pivot Configuration */}
          <div className="space-y-3 p-3.5 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold flex items-center gap-2 text-primary">
                <Layers className="h-4 w-4" /> Multi-Dimensional Cross-Tab & Pivot Matrix
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSwapDimensions}
                className="h-7 text-xs gap-1.5 bg-background hover:bg-primary/10"
              >
                🔀 Swap Rows & Columns
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Select any CRM attribute for the Rows and Columns to cross-tabulate any dataset matrix.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Row Dimension */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <span>↕️ Row Dimension</span>
                </Label>
                <Select
                  value={localConfig.rowDimension || localConfig.groupBy || 'owner'}
                  onValueChange={(val) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      groupBy: val as GroupByDimension,
                      rowDimension: val as ReportDimension,
                    }))
                  }
                >
                  <SelectTrigger className="w-full h-8 text-xs bg-background">
                    <SelectValue placeholder="Choose row dimension" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="owner">Sales Owner / Team</SelectItem>
                    <SelectItem value="status">Lead Status (All Custom)</SelectItem>
                    <SelectItem value="source">Lead Source / Channel</SelectItem>
                    <SelectItem value="product">Product / Program</SelectItem>
                    <SelectItem value="priority">Priority Tier (Hot/Warm/Cold)</SelectItem>
                    <SelectItem value="date_month">Time: Month</SelectItem>
                    <SelectItem value="date_quarter">Time: Quarter</SelectItem>
                    <SelectItem value="date_day">Time: Daily</SelectItem>
                    <SelectItem value="city">City / Territory</SelectItem>
                    {customColumns.map((col) => (
                      <SelectItem key={col.id} value={`custom:${col.id}`}>
                        Custom: {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Column Dimension */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <span>↔️ Column Dimension</span>
                </Label>
                <Select
                  value={localConfig.colDimension || 'status'}
                  onValueChange={(val) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      colDimension: val as ReportColumnDimension,
                    }))
                  }
                >
                  <SelectTrigger className="w-full h-8 text-xs bg-background">
                    <SelectValue placeholder="Choose column dimension" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="status">Lead Status (All Custom)</SelectItem>
                    <SelectItem value="owner">Sales Owner / Team</SelectItem>
                    <SelectItem value="source">Lead Source / Channel</SelectItem>
                    <SelectItem value="product">Product / Program</SelectItem>
                    <SelectItem value="priority">Priority Tier</SelectItem>
                    <SelectItem value="date_month">Time: Month</SelectItem>
                    <SelectItem value="metrics">Classic Summary Metrics</SelectItem>
                    {customColumns.map((col) => (
                      <SelectItem key={col.id} value={`custom:${col.id}`}>
                        Custom: {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cell Value Metric */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <span>🔢 Cell Value Metric</span>
                </Label>
                <Select
                  value={localConfig.cellMetric || 'count'}
                  onValueChange={(val) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      cellMetric: val as MatrixMetricType,
                    }))
                  }
                >
                  <SelectTrigger className="w-full h-8 text-xs bg-background">
                    <SelectValue placeholder="Choose cell metric" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="count">Lead Volume Count (#)</SelectItem>
                    <SelectItem value="revenue">Won Revenue Collected</SelectItem>
                    <SelectItem value="pipeline">Pipeline Potential Value</SelectItem>
                    <SelectItem value="avg_score">Avg Quality Score (0-100)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 3. KPI Metric Cards */}
          <div className="space-y-2 p-3.5 bg-muted/20 rounded-lg border border-border/50">
            <div className="text-sm font-semibold">Visible KPI Metric Cards</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              {[
                { id: 'totalLeads', label: 'Total Leads' },
                { id: 'conversionRate', label: 'Conversion Rate %' },
                { id: 'wonRevenue', label: 'Closed Revenue' },
                { id: 'pipelineRevenue', label: 'Pipeline Potential' },
                { id: 'activeLeads', label: 'Active Pipeline' },
                { id: 'topSegment', label: 'Top Performer/Source' },
                { id: 'avgDealSize', label: 'Avg Deal Size' },
                { id: 'avgLeadScore', label: 'Avg Lead Score' },
              ].map((kpi) => (
                <label
                  key={kpi.id}
                  className="flex items-center gap-2 text-xs p-2 rounded-md hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox
                    checked={localConfig.kpis[kpi.id as keyof VisibleKPICards]}
                    onCheckedChange={() => toggleKPI(kpi.id as keyof VisibleKPICards)}
                  />
                  <span>{kpi.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 4. Chart Visualizations */}
          <div className="space-y-2 p-3.5 bg-muted/20 rounded-lg border border-border/50">
            <div className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-500" /> Visual Charts & Analytics
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {[
                {
                  id: 'breakdownBar',
                  label: 'Group Breakdown Bar Chart',
                  desc: 'Compares lead volume and revenue by selected dimension',
                },
                {
                  id: 'statusPie',
                  label: 'Status Bifurcation Donut Chart',
                  desc: 'Visualizes proportional distribution across lead statuses',
                },
                {
                  id: 'conversionFunnel',
                  label: 'Conversion Funnel Chart',
                  desc: 'Shows drop-off from Total Leads to In-Progress to Won',
                },
                {
                  id: 'revenueArea',
                  label: 'Revenue & Trend Distribution',
                  desc: 'Visualizes revenue captured versus pipeline opportunity',
                },
              ].map((chart) => (
                <label
                  key={chart.id}
                  className="flex items-start gap-2.5 text-xs p-2.5 rounded-lg border border-border/40 hover:bg-muted/30 cursor-pointer"
                >
                  <Checkbox
                    checked={localConfig.charts[chart.id as keyof VisibleCharts]}
                    onCheckedChange={() => toggleChart(chart.id as keyof VisibleCharts)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-foreground">{chart.label}</div>
                    <div className="text-[11px] text-muted-foreground">{chart.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 5. Detailed Table Columns */}
          <div className="space-y-2 p-3.5 bg-muted/20 rounded-lg border border-border/50">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Table2 className="h-4 w-4 text-purple-500" /> Data Table Columns
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
              {[
                { id: 'name', label: 'Lead Name' },
                { id: 'contact', label: 'Contact (Email/Phone)' },
                { id: 'status', label: 'Status' },
                { id: 'owner', label: 'Sales Owner' },
                { id: 'source', label: 'Lead Source' },
                { id: 'product', label: 'Product' },
                { id: 'revenue', label: 'Revenue / Value' },
                { id: 'priority', label: 'Priority / Score' },
                { id: 'createdAt', label: 'Creation Date' },
              ].map((col) => (
                <label
                  key={col.id}
                  className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox
                    checked={localConfig.columns[col.id as keyof VisibleTableColumns] ?? true}
                    onCheckedChange={() => toggleColumn(col.id)}
                  />
                  <span>{col.label}</span>
                </label>
              ))}

              {customColumns.map((customCol) => (
                <label
                  key={customCol.id}
                  className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox
                    checked={localConfig.columns[customCol.id] ?? false}
                    onCheckedChange={() => toggleColumn(customCol.id)}
                  />
                  <span className="truncate">{customCol.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="text-xs gap-1.5">
            <Check className="h-3.5 w-3.5" /> Apply Report Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
