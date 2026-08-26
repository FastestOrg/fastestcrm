import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  Layers,
  ArrowLeftRight,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Database,
} from 'lucide-react';
import { Lead } from '@/hooks/useLeads';
import { CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { CustomColumn } from '@/hooks/useCustomColumns';
import {
  ReportDisplayConfig,
  ReportDimension,
  ReportColumnDimension,
  MatrixMetricType,
} from './ReportCustomizerModal';
import { format } from 'date-fns';
import { PriorityBadge } from '@/components/leads/PriorityBadge';
import { calculatePriorityLevel } from '@/hooks/useLeadScoring';

export interface GroupSummaryRow {
  key: string;
  name: string;
  total: number;
  sharePercent: string;
  inProgress?: number;
  paid: number;
  conversionRate: string;
  revenue: number;
  avgScore: number;
  statusCounts?: Record<string, number>;
}

interface CustomReportTableProps {
  leads: Lead[];
  groupSummary?: GroupSummaryRow[];
  groupByLabel?: string;
  config: ReportDisplayConfig;
  onConfigChange?: (newConfig: ReportDisplayConfig) => void;
  leadStatuses: CompanyLeadStatus[];
  customColumns: CustomColumn[];
  ownersMap: Record<string, string>;
  currencySymbol?: string;
}

interface DimensionItem {
  key: string;
  label: string;
  color?: string;
}

export function CustomReportTable({
  leads,
  config,
  onConfigChange,
  leadStatuses,
  customColumns,
  ownersMap,
  currencySymbol = '₹',
}: CustomReportTableProps) {
  const [matrixSearch, setMatrixSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [isDetailsLoaded, setIsDetailsLoaded] = useState(Boolean(config.showLeadDetailsTable));

  const rowDim = (config.rowDimension || config.groupBy || 'owner') as ReportDimension;
  const colDim = (config.colDimension || 'status') as ReportColumnDimension;
  const cellMetric = (config.cellMetric || 'count') as MatrixMetricType;

  // Helper to update dimension configuration
  const handleUpdateConfig = (partial: Partial<ReportDisplayConfig>) => {
    if (onConfigChange) {
      onConfigChange({ ...config, ...partial });
    }
  };

  // Swap Row and Column dimensions with 1 click
  const handleSwapDimensions = () => {
    handleUpdateConfig({
      groupBy: colDim as any,
      rowDimension: colDim as any,
      colDimension: rowDim as any,
    });
  };

  // Helper to extract dimension key & label for a single lead
  const getDimensionItem = (lead: Lead, dimension: string): DimensionItem => {
    if (dimension === 'owner') {
      const key = lead.sales_owner_id || 'unassigned';
      const label =
        ownersMap[lead.sales_owner_id || ''] || lead.sales_owner?.full_name || 'Unassigned';
      return { key, label };
    }

    if (dimension === 'status') {
      const key = lead.status || 'unknown';
      const stObj = leadStatuses.find((s) => s.value === lead.status);
      const label = stObj
        ? stObj.label
        : lead.status
        ? lead.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Unknown Status';
      return { key, label, color: stObj?.color || '#3B82F6' };
    }

    if (dimension === 'source') {
      const key = (lead.lead_source || 'direct').trim().toLowerCase();
      const label = lead.lead_source?.trim() || 'Direct / Organic';
      return { key, label };
    }

    if (dimension === 'product') {
      const key = (lead.product_purchased || 'unspecified').trim().toLowerCase();
      const label = lead.product_purchased?.trim() || 'General Inquiry';
      return { key, label };
    }

    if (dimension === 'priority') {
      const { level } = calculatePriorityLevel(lead);
      const label =
        level === 'hot' ? '🔥 Hot Leads' : level === 'warm' ? '⚡ Warm Leads' : '❄️ Cold Leads';
      const color = level === 'hot' ? '#EF4444' : level === 'warm' ? '#F59E0B' : '#3B82F6';
      return { key: level, label, color };
    }

    if (dimension === 'date_month' || dimension === 'date') {
      if (lead.created_at) {
        const d = new Date(lead.created_at);
        return { key: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
      }
      return { key: 'no-date', label: 'No Date' };
    }

    if (dimension === 'date_quarter') {
      if (lead.created_at) {
        const d = new Date(lead.created_at);
        const q = Math.floor(d.getMonth() / 3) + 1;
        return { key: `${d.getFullYear()}-Q${q}`, label: `Q${q} ${d.getFullYear()}` };
      }
      return { key: 'no-date', label: 'No Date' };
    }

    if (dimension === 'date_day') {
      if (lead.created_at) {
        const d = new Date(lead.created_at);
        return { key: format(d, 'yyyy-MM-dd'), label: format(d, 'MMM dd, yyyy') };
      }
      return { key: 'no-date', label: 'No Date' };
    }

    if (dimension === 'city') {
      const city =
        (lead as any).city || (lead as any).address || (lead as any).location || 'Unspecified';
      const str = String(city).trim();
      return { key: str.toLowerCase() || 'unspecified', label: str || 'Unspecified' };
    }

    if (dimension.startsWith('custom:')) {
      const colId = dimension.replace('custom:', '');
      const raw = (lead as any)[colId] ?? (lead as any).custom_data?.[colId] ?? '';
      const str = String(raw).trim();
      return { key: str.toLowerCase() || 'empty', label: str || '(Empty / Unset)' };
    }

    return { key: 'other', label: 'Other' };
  };

  // Helper to format human-readable title of dimension
  const getDimensionTitle = (dim: string): string => {
    if (dim === 'owner') return 'Sales Owner';
    if (dim === 'status') return 'Lead Status';
    if (dim === 'source') return 'Lead Source';
    if (dim === 'product') return 'Product / Program';
    if (dim === 'priority') return 'Priority Tier';
    if (dim === 'date_month' || dim === 'date') return 'Creation Month';
    if (dim === 'date_quarter') return 'Quarter';
    if (dim === 'date_day') return 'Creation Date';
    if (dim === 'city') return 'City / Location';
    if (dim === 'metrics') return 'Standard Metrics';
    if (dim.startsWith('custom:')) {
      const id = dim.replace('custom:', '');
      const col = customColumns.find((c) => c.id === id);
      return col ? col.label : id;
    }
    return dim;
  };

  // ─── 1. Build Column Headers (Column Axis) ─────────────────────────────────
  const columnItems = useMemo<DimensionItem[]>(() => {
    if (colDim === 'status') {
      const map = new Map<string, DimensionItem>();
      (leadStatuses || []).forEach((st) => {
        map.set(st.value, {
          key: st.value,
          label: st.label,
          color: st.color || '#3B82F6',
        });
      });

      // Include any other active status present in leads
      leads.forEach((l) => {
        if (l.status && !map.has(l.status)) {
          map.set(l.status, {
            key: l.status,
            label: l.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            color: '#64748b',
          });
        }
      });

      if (map.size === 0) {
        ['new', 'interested', 'follow_up', 'paid', 'lost'].forEach((s, idx) => {
          map.set(s, {
            key: s,
            label: s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            color: ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444'][idx % 5],
          });
        });
      }

      return Array.from(map.values());
    }

    if (colDim === 'owner') {
      const map = new Map<string, DimensionItem>();
      Object.entries(ownersMap).forEach(([id, name]) => {
        map.set(id, { key: id, label: name });
      });
      leads.forEach((l) => {
        const item = getDimensionItem(l, 'owner');
        if (!map.has(item.key)) {
          map.set(item.key, item);
        }
      });
      return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }

    if (colDim === 'priority') {
      return [
        { key: 'hot', label: '🔥 Hot Leads', color: '#EF4444' },
        { key: 'warm', label: '⚡ Warm Leads', color: '#F59E0B' },
        { key: 'cold', label: '❄️ Cold Leads', color: '#3B82F6' },
      ];
    }

    // Dynamic extraction for source, product, dates, custom fields, etc.
    const map = new Map<string, DimensionItem>();
    leads.forEach((l) => {
      const item = getDimensionItem(l, colDim);
      if (!map.has(item.key)) {
        map.set(item.key, item);
      }
    });

    if (map.size === 0) {
      return [{ key: 'all', label: 'Total Volume' }];
    }

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [colDim, leadStatuses, leads, ownersMap, customColumns]);

  // ─── 2. Build Multi-Dimensional Matrix (Rows × Columns) ───────────────────
  const matrixData = useMemo(() => {
    const rowMap: Record<
      string,
      {
        key: string;
        name: string;
        color?: string;
        totalLeads: number;
        revenue: number;
        pipeline: number;
        paid: number;
        totalScore: number;
        colCells: Record<
          string,
          {
            count: number;
            revenue: number;
            pipeline: number;
            paid: number;
            avgScore: number;
          }
        >;
      }
    > = {};

    leads.forEach((lead) => {
      const rowItem = getDimensionItem(lead, rowDim);
      const colItem = getDimensionItem(lead, colDim);

      if (!rowMap[rowItem.key]) {
        rowMap[rowItem.key] = {
          key: rowItem.key,
          name: rowItem.label,
          color: rowItem.color,
          totalLeads: 0,
          revenue: 0,
          pipeline: 0,
          paid: 0,
          totalScore: 0,
          colCells: {},
        };
      }

      const row = rowMap[rowItem.key];
      row.totalLeads += 1;
      row.revenue += lead.revenue_received || 0;
      row.pipeline += lead.revenue_projected || 0;

      const { score } = calculatePriorityLevel(lead);
      row.totalScore += score;

      const isPaid =
        lead.status === 'paid' ||
        leadStatuses.find((s) => s.value === lead.status)?.category === 'paid' ||
        (lead.revenue_received !== null &&
          lead.revenue_received !== undefined &&
          lead.revenue_received > 0);

      if (isPaid) {
        row.paid += 1;
      }

      // Initialize column cell if not present
      if (!row.colCells[colItem.key]) {
        row.colCells[colItem.key] = {
          count: 0,
          revenue: 0,
          pipeline: 0,
          paid: 0,
          avgScore: 0,
        };
      }

      const cell = row.colCells[colItem.key];
      cell.count += 1;
      cell.revenue += lead.revenue_received || 0;
      cell.pipeline += lead.revenue_projected || 0;
      if (isPaid) cell.paid += 1;
      cell.avgScore += score;
    });

    // Compute averages and sort rows by total volume
    const totalDatasetLeads = leads.length || 1;

    const rows = Object.values(rowMap).map((r) => {
      const sharePercent = ((r.totalLeads / totalDatasetLeads) * 100).toFixed(1);
      const conversionRate = r.totalLeads > 0 ? ((r.paid / r.totalLeads) * 100).toFixed(1) : '0';
      const avgScore = r.totalLeads > 0 ? Math.round(r.totalScore / r.totalLeads) : 0;

      // Finalize cell avg scores
      Object.values(r.colCells).forEach((c) => {
        c.avgScore = c.count > 0 ? Math.round(c.avgScore / c.count) : 0;
      });

      return {
        ...r,
        sharePercent,
        conversionRate,
        avgScore,
      };
    });

    return rows.sort((a, b) => b.totalLeads - a.totalLeads);
  }, [leads, rowDim, colDim, leadStatuses, ownersMap, customColumns]);

  // Filter matrix rows by quick matrix search
  const filteredMatrixRows = useMemo(() => {
    if (!matrixSearch.trim()) return matrixData;
    const q = matrixSearch.toLowerCase();
    return matrixData.filter((r) => r.name.toLowerCase().includes(q));
  }, [matrixData, matrixSearch]);

  // ─── 3. Matrix Column & Grand Totals ───────────────────────────────────────
  const matrixTotals = useMemo(() => {
    const totalLeads = matrixData.reduce((sum, r) => sum + r.totalLeads, 0);
    const totalRevenue = matrixData.reduce((sum, r) => sum + r.revenue, 0);
    const totalPipeline = matrixData.reduce((sum, r) => sum + r.pipeline, 0);
    const totalPaid = matrixData.reduce((sum, r) => sum + r.paid, 0);
    const avgConvRate = totalLeads > 0 ? ((totalPaid / totalLeads) * 100).toFixed(1) : '0';
    const overallAvgScore =
      totalLeads > 0
        ? Math.round(
            matrixData.reduce((sum, r) => sum + r.avgScore * r.totalLeads, 0) / totalLeads
          )
        : 0;

    // Column sums for the selected metric
    const colTotals: Record<string, { count: number; revenue: number; pipeline: number }> = {};
    columnItems.forEach((c) => {
      colTotals[c.key] = {
        count: matrixData.reduce((sum, r) => sum + (r.colCells[c.key]?.count || 0), 0),
        revenue: matrixData.reduce((sum, r) => sum + (r.colCells[c.key]?.revenue || 0), 0),
        pipeline: matrixData.reduce((sum, r) => sum + (r.colCells[c.key]?.pipeline || 0), 0),
      };
    });

    return {
      totalLeads,
      totalRevenue,
      totalPipeline,
      totalPaid,
      avgConvRate,
      overallAvgScore,
      colTotals,
    };
  }, [matrixData, columnItems]);

  // ─── 4. Detailed Filtered Leads Table (Tabular List) ───────────────────────
  const filteredLeads = useMemo(() => {
    if (!tableSearch.trim()) return leads;
    const q = tableSearch.toLowerCase();
    return leads.filter((lead) => {
      return (
        lead.name?.toLowerCase().includes(q) ||
        lead.email?.toLowerCase().includes(q) ||
        lead.phone?.toLowerCase().includes(q) ||
        lead.lead_source?.toLowerCase().includes(q) ||
        lead.product_purchased?.toLowerCase().includes(q) ||
        lead.status?.toLowerCase().includes(q)
      );
    });
  }, [leads, tableSearch]);

  const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  // ─── 5. Export 2D Pivot Matrix to CSV ──────────────────────────────────────
  const handleExportMatrixCSV = () => {
    const rowTitle = getDimensionTitle(rowDim);
    const colTitle = getDimensionTitle(colDim);

    const headers = [
      `${rowTitle} \\ ${colTitle}`,
      'Total Leads',
      'Share %',
      ...columnItems.map((c) => c.label),
      'Revenue Won',
      'Conversion Rate %',
      'Avg Score',
    ];

    const rows = matrixData.map((r) => {
      const rowVals: any[] = [
        `"${r.name.replace(/"/g, '""')}"`,
        r.totalLeads,
        `${r.sharePercent}%`,
      ];

      columnItems.forEach((c) => {
        const cell = r.colCells[c.key];
        if (cellMetric === 'revenue') {
          rowVals.push(cell ? cell.revenue : 0);
        } else if (cellMetric === 'pipeline') {
          rowVals.push(cell ? cell.pipeline : 0);
        } else if (cellMetric === 'avg_score') {
          rowVals.push(cell ? cell.avgScore : 0);
        } else {
          rowVals.push(cell ? cell.count : 0);
        }
      });

      rowVals.push(r.revenue);
      rowVals.push(`${r.conversionRate}%`);
      rowVals.push(r.avgScore);

      return rowVals.join(',');
    });

    // Total Row in CSV
    const totalRowVals: any[] = [
      `"Total / Overall Average"`,
      matrixTotals.totalLeads,
      '100%',
    ];
    columnItems.forEach((c) => {
      const colTot = matrixTotals.colTotals[c.key];
      if (cellMetric === 'revenue') {
        totalRowVals.push(colTot ? colTot.revenue : 0);
      } else if (cellMetric === 'pipeline') {
        totalRowVals.push(colTot ? colTot.pipeline : 0);
      } else {
        totalRowVals.push(colTot ? colTot.count : 0);
      }
    });
    totalRowVals.push(matrixTotals.totalRevenue);
    totalRowVals.push(`${matrixTotals.avgConvRate}%`);
    totalRowVals.push(matrixTotals.overallAvgScore);

    rows.push(totalRowVals.join(','));

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `fastestcrm_matrix_${rowDim}_x_${colDim}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── 6. Export Filtered Leads Dataset to CSV ────────────────────────────────
  const handleExportLeadsCSV = () => {
    const headers = [
      'Lead Name',
      'Email',
      'Phone',
      'Status',
      'Owner',
      'Source',
      'Product',
      'Revenue Received',
      'Projected Revenue',
      'Lead Score',
      'Created Date',
    ];

    customColumns.forEach((c) => headers.push(c.label));

    const rows = filteredLeads.map((l) => {
      const { score } = calculatePriorityLevel(l);
      const row = [
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${l.status || ''}"`,
        `"${ownersMap[l.sales_owner_id || ''] || l.sales_owner?.full_name || 'Unassigned'}"`,
        `"${l.lead_source || ''}"`,
        `"${l.product_purchased || ''}"`,
        l.revenue_received || 0,
        l.revenue_projected || 0,
        score,
        l.created_at ? format(new Date(l.created_at), 'yyyy-MM-dd HH:mm') : '',
      ];

      customColumns.forEach((col) => {
        const val = (l as any)[col.id] ?? (l as any).custom_data?.[col.id] ?? '';
        row.push(`"${String(val).replace(/"/g, '""')}"`);
      });

      return row.join(',');
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `fastestcrm_leads_data_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusObj = (statusVal: string) => {
    return leadStatuses.find((s) => s.value === statusVal);
  };

  // Helper to format cell value in matrix
  const renderCellValue = (
    cell:
      | { count: number; revenue: number; pipeline: number; avgScore: number }
      | undefined,
    color?: string
  ) => {
    if (!cell) {
      return <span className="text-muted-foreground/30 font-mono text-xs">0</span>;
    }

    if (cellMetric === 'revenue') {
      return cell.revenue > 0 ? (
        <span className="font-semibold text-emerald-400">
          {currencySymbol}
          {cell.revenue.toLocaleString('en-IN')}
        </span>
      ) : (
        <span className="text-muted-foreground/30 font-mono text-xs">-</span>
      );
    }

    if (cellMetric === 'pipeline') {
      return cell.pipeline > 0 ? (
        <span className="font-semibold text-purple-400">
          ~{currencySymbol}
          {cell.pipeline.toLocaleString('en-IN')}
        </span>
      ) : (
        <span className="text-muted-foreground/30 font-mono text-xs">-</span>
      );
    }

    if (cellMetric === 'avg_score') {
      return cell.count > 0 ? (
        <span className="font-mono font-medium text-cyan-300">{cell.avgScore}</span>
      ) : (
        <span className="text-muted-foreground/30 font-mono text-xs">-</span>
      );
    }

    // Default: Lead Volume Count
    return cell.count > 0 ? (
      <span
        className="font-semibold"
        style={{ color: color || undefined }}
      >
        {cell.count}
      </span>
    ) : (
      <span className="text-muted-foreground/30 font-mono text-xs">0</span>
    );
  };

  // Helper to format footer column total value
  const renderColTotal = (colKey: string) => {
    const colTot = matrixTotals.colTotals[colKey];
    if (!colTot) return <span className="font-bold text-foreground">0</span>;

    if (cellMetric === 'revenue') {
      return (
        <span className="font-bold text-emerald-400">
          {currencySymbol}
          {colTot.revenue.toLocaleString('en-IN')}
        </span>
      );
    }
    if (cellMetric === 'pipeline') {
      return (
        <span className="font-bold text-purple-400">
          ~{currencySymbol}
          {colTot.pipeline.toLocaleString('en-IN')}
        </span>
      );
    }
    return <span className="font-bold text-foreground">{colTot.count}</span>;
  };

  return (
    <div className="space-y-8">
      {/* ══════════════════════════════════════════════════════════════════════
          1. MULTI-DIMENSIONAL CROSS-TAB & PIVOT MATRIX TABLE
         ══════════════════════════════════════════════════════════════════════ */}
      {config.showBreakdownSummary && matrixData.length > 0 && (
        <div className="bg-card/70 border border-border/70 rounded-xl overflow-hidden shadow-sm space-y-0">
          {/* Matrix Header & Interactive Axis Selectors */}
          <div className="p-4 border-b border-border/60 bg-muted/25 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary shrink-0" />
                <h3 className="font-semibold text-sm">
                  Pivot Matrix:{' '}
                  <span className="text-primary">{getDimensionTitle(rowDim)}</span>
                  <span className="text-muted-foreground mx-1">×</span>
                  <span className="text-cyan-400">{getDimensionTitle(colDim)}</span>
                </h3>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Displaying {matrixData.length} row segments cross-tabulated with {columnItems.length}{' '}
                columns ({cellMetric === 'revenue' ? 'Won Revenue' : cellMetric === 'pipeline' ? 'Pipeline Value' : cellMetric === 'avg_score' ? 'Avg Quality Score' : 'Lead Volume'})
              </p>
            </div>

            {/* Quick Interactive Dimension Controls Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Row Dimension Select */}
              <div className="flex items-center gap-1.5 bg-background/80 border border-border/70 rounded-md px-2 py-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  ↕️ Row:
                </span>
                <Select
                  value={rowDim}
                  onValueChange={(val) =>
                    handleUpdateConfig({
                      groupBy: val as any,
                      rowDimension: val as any,
                    })
                  }
                >
                  <SelectTrigger className="h-6 w-[125px] border-0 bg-transparent text-xs p-0 focus:ring-0 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-xs">
                    <SelectItem value="owner">Sales Owner</SelectItem>
                    <SelectItem value="status">Lead Status (All)</SelectItem>
                    <SelectItem value="source">Lead Source</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="priority">Priority Tier</SelectItem>
                    <SelectItem value="date_month">Creation Month</SelectItem>
                    <SelectItem value="date_quarter">Quarter</SelectItem>
                    <SelectItem value="date_day">Date (Daily)</SelectItem>
                    <SelectItem value="city">City / Location</SelectItem>
                    {customColumns.map((col) => (
                      <SelectItem key={col.id} value={`custom:${col.id}`}>
                        Custom: {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Swap Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSwapDimensions}
                title="Swap Row and Column dimensions"
                className="h-8 px-2.5 text-xs bg-background/80 hover:bg-primary/10 gap-1"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </Button>

              {/* Column Dimension Select */}
              <div className="flex items-center gap-1.5 bg-background/80 border border-border/70 rounded-md px-2 py-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  ↔️ Col:
                </span>
                <Select
                  value={colDim}
                  onValueChange={(val) =>
                    handleUpdateConfig({
                      colDimension: val as any,
                    })
                  }
                >
                  <SelectTrigger className="h-6 w-[125px] border-0 bg-transparent text-xs p-0 focus:ring-0 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-xs">
                    <SelectItem value="status">Lead Status (All)</SelectItem>
                    <SelectItem value="owner">Sales Owner</SelectItem>
                    <SelectItem value="source">Lead Source</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="priority">Priority Tier</SelectItem>
                    <SelectItem value="date_month">Creation Month</SelectItem>
                    {customColumns.map((col) => (
                      <SelectItem key={col.id} value={`custom:${col.id}`}>
                        Custom: {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cell Value Metric Select */}
              <div className="flex items-center gap-1.5 bg-background/80 border border-border/70 rounded-md px-2 py-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  🔢 Metric:
                </span>
                <Select
                  value={cellMetric}
                  onValueChange={(val) =>
                    handleUpdateConfig({
                      cellMetric: val as any,
                    })
                  }
                >
                  <SelectTrigger className="h-6 w-[110px] border-0 bg-transparent text-xs p-0 focus:ring-0 font-medium text-emerald-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-xs">
                    <SelectItem value="count">Count (#)</SelectItem>
                    <SelectItem value="revenue">Won Revenue</SelectItem>
                    <SelectItem value="pipeline">Pipeline Value</SelectItem>
                    <SelectItem value="avg_score">Avg Score</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Export Matrix Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMatrixCSV}
                className="h-8 text-xs gap-1.5 bg-background/80 hover:bg-muted font-medium"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" /> Export Matrix CSV
              </Button>
            </div>
          </div>

          {/* Matrix Filter & Search Input */}
          <div className="px-4 py-2 bg-muted/10 border-b border-border/40 flex items-center justify-between gap-3 text-xs">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={`Search ${getDimensionTitle(rowDim)}...`}
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                className="pl-8 h-7 text-xs bg-background/80"
              />
            </div>
            <div className="text-[11px] text-muted-foreground shrink-0">
              Showing {filteredMatrixRows.length} of {matrixData.length} rows
            </div>
          </div>

          {/* 2D Matrix Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
                  <TableHead className="font-semibold min-w-[160px] sticky left-0 bg-muted/40 z-10">
                    {getDimensionTitle(rowDim)}
                  </TableHead>
                  <TableHead className="text-right font-semibold min-w-[80px]">Total Leads</TableHead>
                  <TableHead className="text-right font-semibold min-w-[70px]">Share %</TableHead>

                  {/* Dynamic Column Headers */}
                  {columnItems.map((col) => (
                    <TableHead
                      key={col.key}
                      className="text-right font-semibold whitespace-nowrap px-3 min-w-[100px]"
                    >
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        {col.color && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: col.color }}
                          />
                        )}
                        <span>{col.label}</span>
                      </span>
                    </TableHead>
                  ))}

                  <TableHead className="text-right font-semibold min-w-[110px]">Revenue Won</TableHead>
                  <TableHead className="text-right font-semibold min-w-[95px]">Conv. Rate</TableHead>
                  <TableHead className="text-right font-semibold min-w-[80px]">Avg Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatrixRows.map((row) => (
                  <TableRow key={row.key} className="hover:bg-muted/30 transition-colors text-xs">
                    <TableCell className="font-medium text-foreground max-w-[220px] truncate sticky left-0 bg-card/95 z-10">
                      <span className="inline-flex items-center gap-1.5">
                        {row.color && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                        )}
                        <span>{row.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{row.totalLeads}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.sharePercent}%
                    </TableCell>

                    {/* Dynamic 2D Matrix Cells */}
                    {columnItems.map((col) => {
                      const cell = row.colCells[col.key];
                      return (
                        <TableCell
                          key={col.key}
                          className="text-right px-3 font-medium transition-colors hover:bg-primary/5"
                        >
                          {renderCellValue(cell, col.color)}
                        </TableCell>
                      );
                    })}

                    <TableCell className="text-right font-semibold text-foreground">
                      {currencySymbol}
                      {row.revenue.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${
                          Number(row.conversionRate) >= 15
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : Number(row.conversionRate) > 0
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {row.conversionRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-muted-foreground">{row.avgScore}</span>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Total Aggregation Summary Row */}
                <TableRow className="bg-primary/5 font-bold hover:bg-primary/10 border-t-2 border-border/80 text-xs">
                  <TableCell className="text-foreground sticky left-0 bg-primary/10 z-10">
                    Total / Overall Average
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {matrixTotals.totalLeads}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">100%</TableCell>

                  {/* Column-wise Totals */}
                  {columnItems.map((col) => (
                    <TableCell key={col.key} className="text-right font-bold px-3">
                      {renderColTotal(col.key)}
                    </TableCell>
                  ))}

                  <TableCell className="text-right text-emerald-400 font-bold">
                    {currencySymbol}
                    {matrixTotals.totalRevenue.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="text-[10px] font-bold text-foreground">
                      {matrixTotals.avgConvRate}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {matrixTotals.overallAvgScore}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          2. FILTERED LEADS DATASET (ON-DEMAND LAZY LOAD)
         ══════════════════════════════════════════════════════════════════════ */}
      {!isDetailsLoaded ? (
        <div className="bg-card/60 border border-dashed border-border/80 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 hover:border-primary/40 hover:bg-card/80 transition-all">
          <div className="flex items-center gap-3 text-left">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                Filtered Leads Raw Dataset
                <Badge variant="secondary" className="text-xs font-normal">
                  {leads.length} records ready
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Detailed record view is hidden by default for maximum speed. Click below to load and inspect individual lead details.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportLeadsCSV}
              className="h-9 text-xs gap-1.5 bg-background/80 hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" /> Quick CSV Export
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setIsDetailsLoaded(true);
                handleUpdateConfig({ showLeadDetailsTable: true });
              }}
              className="h-9 text-xs gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-xs"
            >
              <Eye className="h-4 w-4" /> Load & View Leads ({leads.length})
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-card/70 border border-border/70 rounded-xl overflow-hidden shadow-sm space-y-3">
          <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                Filtered Leads Dataset
                <Badge variant="secondary" className="text-xs font-normal">
                  {filteredLeads.length} leads
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Displaying detailed records matching current report criteria
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search in table..."
                  value={tableSearch}
                  onChange={(e) => {
                    setTableSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 h-8 text-xs bg-background/80"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportLeadsCSV}
                className="h-8 text-xs gap-1.5 shrink-0"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsDetailsLoaded(false);
                  handleUpdateConfig({ showLeadDetailsTable: false });
                }}
                className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
                title="Hide / Collapse Leads Table"
              >
                <EyeOff className="h-3.5 w-3.5" /> Hide Table
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 text-xs">
                  {config.columns.name && <TableHead>Name</TableHead>}
                  {config.columns.priority && <TableHead>Priority / Score</TableHead>}
                  {config.columns.status && <TableHead>Status</TableHead>}
                  {config.columns.contact && <TableHead>Contact</TableHead>}
                  {config.columns.owner && <TableHead>Sales Owner</TableHead>}
                  {config.columns.source && <TableHead>Lead Source</TableHead>}
                  {config.columns.product && <TableHead>Product</TableHead>}
                  {config.columns.revenue && <TableHead className="text-right">Revenue</TableHead>}
                  {config.columns.createdAt && <TableHead className="text-right">Created Date</TableHead>}
                  {customColumns.map((col) => {
                    if (!config.columns[col.id]) return null;
                    return <TableHead key={col.id}>{col.label}</TableHead>;
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.map((lead) => {
                  const { level, score } = calculatePriorityLevel(lead);
                  const statusObj = getStatusObj(lead.status);

                  return (
                    <TableRow key={lead.id} className="hover:bg-muted/30 transition-colors text-xs">
                      {config.columns.name && (
                        <TableCell className="font-medium text-foreground max-w-[160px] truncate">
                          {lead.name || 'Unnamed Lead'}
                        </TableCell>
                      )}

                      {config.columns.priority && (
                        <TableCell>
                          <PriorityBadge level={level} score={score} />
                        </TableCell>
                      )}

                      {config.columns.status && (
                        <TableCell>
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium text-white shadow-xs"
                            style={{ backgroundColor: statusObj?.color || '#3B82F6' }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                            {statusObj?.label || lead.status}
                          </span>
                        </TableCell>
                      )}

                      {config.columns.contact && (
                        <TableCell className="text-muted-foreground text-[11px] max-w-[180px] truncate">
                          {lead.email && (
                            <div className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{lead.email}</span>
                            </div>
                          )}
                          {lead.phone && (
                            <div className="flex items-center gap-1 truncate">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{lead.phone}</span>
                            </div>
                          )}
                          {!lead.email && !lead.phone && <span>-</span>}
                        </TableCell>
                      )}

                      {config.columns.owner && (
                        <TableCell className="text-muted-foreground truncate max-w-[140px]">
                          {ownersMap[lead.sales_owner_id || ''] || lead.sales_owner?.full_name || 'Unassigned'}
                        </TableCell>
                      )}

                      {config.columns.source && (
                        <TableCell className="text-muted-foreground capitalize">
                          {lead.lead_source || '-'}
                        </TableCell>
                      )}

                      {config.columns.product && (
                        <TableCell className="text-muted-foreground max-w-[140px] truncate">
                          {lead.product_purchased || '-'}
                        </TableCell>
                      )}

                      {config.columns.revenue && (
                        <TableCell className="text-right font-medium">
                          {lead.revenue_received ? (
                            <span className="text-emerald-400 font-semibold">
                              {currencySymbol}
                              {lead.revenue_received.toLocaleString('en-IN')}
                            </span>
                          ) : lead.revenue_projected ? (
                            <span className="text-muted-foreground">
                              ~{currencySymbol}
                              {lead.revenue_projected.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}

                      {config.columns.createdAt && (
                        <TableCell className="text-right text-muted-foreground text-[11px]">
                          {lead.created_at ? format(new Date(lead.created_at), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                      )}

                      {customColumns.map((col) => {
                        if (!config.columns[col.id]) return null;
                        const val = (lead as any)[col.id] ?? (lead as any).custom_data?.[col.id] ?? '-';
                        return (
                          <TableCell key={col.id} className="text-muted-foreground max-w-[120px] truncate">
                            {String(val)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}

                {paginatedLeads.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center py-8 text-sm text-muted-foreground"
                    >
                      No leads match the selected filter criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Table Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <div>
                Page {currentPage} of {totalPages} ({filteredLeads.length} records)
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 px-2"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
