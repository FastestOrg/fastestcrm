import React from 'react';
import { format } from 'date-fns';
import { ReportDisplayConfig } from './ReportCustomizerModal';
import { ReportFilterState } from './ReportFilterBar';
import { GroupSummaryRow } from './CustomReportTable';
import { Lead } from '@/hooks/useLeads';
import { CompanyLeadStatus } from '@/hooks/useLeadStatuses';

interface ReportPrintableTemplateProps {
  id: string;
  config: ReportDisplayConfig;
  filters: ReportFilterState;
  companyName: string;
  logoUrl?: string | null;
  generatedBy: string;
  currencySymbol?: string;
  groupSummary?: GroupSummaryRow[];
  groupByLabel?: string;
  kpiStats: {
    totalLeads: number;
    conversionRate: string;
    wonRevenue: number;
    pipelineRevenue: number;
    activeLeads: number;
    avgScore: number;
    topSegment: string;
    avgDealSize: number;
  };
  leads: Lead[];
  leadStatuses: CompanyLeadStatus[];
  customColumns?: CustomColumn[];
  ownersMap?: Record<string, string>;
}

export const ReportPrintableTemplate = React.forwardRef<HTMLDivElement, ReportPrintableTemplateProps>(
  function ReportPrintableTemplate(
    {
      id,
      config,
      filters,
      companyName,
      logoUrl,
      generatedBy,
      currencySymbol = '₹',
      groupByLabel = 'Segment',
      kpiStats,
      leads,
      leadStatuses,
      customColumns = [],
      ownersMap = {},
    },
    ref
  ) {
    const statusMap = new Map(leadStatuses.map((s) => [s.value, s.label]));
    const rowDim = config.rowDimension || config.groupBy || 'owner';
    const colDim = config.colDimension || 'status';
    const cellMetric = config.cellMetric || 'count';

    // Helper to get dimension item for lead
    const getLeadDimItem = (lead: Lead, dimension: string) => {
      if (dimension === 'owner') {
        const key = lead.sales_owner_id || 'unassigned';
        const label = ownersMap[lead.sales_owner_id || ''] || lead.sales_owner?.full_name || 'Unassigned';
        return { key, label };
      }
      if (dimension === 'status') {
        const key = lead.status || 'unknown';
        const stObj = leadStatuses.find((s) => s.value === lead.status);
        const label = stObj ? stObj.label : lead.status ? lead.status.replace(/_/g, ' ') : 'Unknown';
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
        const score = lead.priority_score || 0;
        const level = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';
        return { key: level, label: level === 'hot' ? 'Hot' : level === 'warm' ? 'Warm' : 'Cold' };
      }
      if (dimension === 'date_month' || dimension === 'date') {
        if (lead.created_at) {
          const d = new Date(lead.created_at);
          return { key: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
        }
        return { key: 'no-date', label: 'No Date' };
      }
      if (dimension.startsWith('custom:')) {
        const colId = dimension.replace('custom:', '');
        const val = (lead as any)[colId] ?? (lead as any).custom_data?.[colId] ?? '';
        const str = String(val).trim();
        return { key: str.toLowerCase() || 'empty', label: str || '(Empty)' };
      }
      return { key: 'other', label: 'Other' };
    };

    const getDimTitle = (dim: string) => {
      if (dim === 'owner') return 'Sales Owner';
      if (dim === 'status') return 'Lead Status';
      if (dim === 'source') return 'Lead Source';
      if (dim === 'product') return 'Product';
      if (dim === 'priority') return 'Priority';
      if (dim === 'date_month' || dim === 'date') return 'Month';
      if (dim.startsWith('custom:')) {
        const id = dim.replace('custom:', '');
        const col = customColumns.find((c) => c.id === id);
        return col ? col.label : id;
      }
      return dim;
    };

    // Columns items
    const colItems = React.useMemo(() => {
      if (colDim === 'status') {
        const map = new Map<string, { key: string; label: string; color?: string }>();
        leadStatuses.forEach((s) => map.set(s.value, { key: s.value, label: s.label, color: s.color }));
        leads.forEach((l) => {
          if (l.status && !map.has(l.status)) {
            map.set(l.status, { key: l.status, label: l.status.replace(/_/g, ' ') });
          }
        });
        return Array.from(map.values());
      }
      const map = new Map<string, { key: string; label: string; color?: string }>();
      leads.forEach((l) => {
        const item = getLeadDimItem(l, colDim);
        if (!map.has(item.key)) map.set(item.key, item);
      });
      return Array.from(map.values()).slice(0, 10);
    }, [colDim, leadStatuses, leads]);

    // Matrix rows
    const matrixRows = React.useMemo(() => {
      const rowMap: Record<
        string,
        {
          key: string;
          name: string;
          total: number;
          revenue: number;
          paid: number;
          cells: Record<string, { count: number; revenue: number }>;
        }
      > = {};

      leads.forEach((l) => {
        const rItem = getLeadDimItem(l, rowDim);
        const cItem = getLeadDimItem(l, colDim);

        if (!rowMap[rItem.key]) {
          rowMap[rItem.key] = {
            key: rItem.key,
            name: rItem.label,
            total: 0,
            revenue: 0,
            paid: 0,
            cells: {},
          };
        }

        const r = rowMap[rItem.key];
        r.total += 1;
        r.revenue += l.revenue_received || 0;
        if (l.status === 'paid' || (l.revenue_received || 0) > 0) r.paid += 1;

        if (!r.cells[cItem.key]) {
          r.cells[cItem.key] = { count: 0, revenue: 0 };
        }
        r.cells[cItem.key].count += 1;
        r.cells[cItem.key].revenue += l.revenue_received || 0;
      });

      return Object.values(rowMap).sort((a, b) => b.total - a.total);
    }, [leads, rowDim, colDim]);

    return (
      <div
        id={id}
        ref={ref}
        style={{
          width: '1100px',
          padding: '40px',
          backgroundColor: '#0f172a', // Premium deep slate background
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          boxSizing: 'border-box',
        }}
        className="space-y-6"
      >
        {/* 1. Executive Header */}
        <div className="flex items-center justify-between border-b border-slate-700 pb-5">
          <div className="flex items-center gap-4">
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                className="h-12 w-auto object-contain rounded"
                crossOrigin="anonymous"
              />
            )}
            <div>
              <div className="text-xs uppercase font-bold tracking-widest text-cyan-400">
                {companyName || 'FastestCRM Enterprise'}
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white mt-0.5">
                {config.reportTitle || 'Custom Lead & Performance Report'}
              </h1>
              {config.reportSubtitle && (
                <p className="text-xs text-slate-400 mt-0.5">{config.reportSubtitle}</p>
              )}
            </div>
          </div>

          <div className="text-right text-xs text-slate-400 space-y-1">
            <div>
              <span className="font-semibold text-slate-300">Generated:</span>{' '}
              {format(new Date(), 'MMM dd, yyyy · hh:mm a')}
            </div>
            <div>
              <span className="font-semibold text-slate-300">Report Author:</span> {generatedBy}
            </div>
            <div>
              <span className="font-semibold text-slate-300">Matrix Pivot:</span>{' '}
              {getDimTitle(rowDim)} × {getDimTitle(colDim)}
            </div>
          </div>
        </div>

        {/* 2. Filter Criteria Badges Banner */}
        <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
            Filter Scope:
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-700/80 text-slate-200">
            Date: {filters.datePreset.toUpperCase()}
          </span>
          {filters.statuses.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
              Statuses ({filters.statuses.length}):{' '}
              {filters.statuses.map((s) => statusMap.get(s) || s).join(', ')}
            </span>
          )}
          {filters.owners.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50">
              Owners ({filters.owners.length})
            </span>
          )}
          {filters.sources.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50">
              Sources: {filters.sources.join(', ')}
            </span>
          )}
          {filters.priorities.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700/50">
              Priority: {filters.priorities.join(', ')}
            </span>
          )}
          <span className="ml-auto font-semibold text-cyan-400">
            {leads.length} Total Leads Selected
          </span>
        </div>

        {/* 3. Executive Notes (if present) */}
        {config.executiveNotes && (
          <div className="p-3.5 rounded-lg bg-cyan-950/40 border border-cyan-800/50 text-xs">
            <span className="font-bold text-cyan-300 block mb-1">Executive Notes & Observations:</span>
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{config.executiveNotes}</p>
          </div>
        )}

        {/* 4. KPI Summary Metric Cards Grid */}
        <div className="grid grid-cols-4 gap-3.5">
          {config.kpis.totalLeads && (
            <div className="p-3.5 rounded-lg bg-slate-800/90 border border-slate-700">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Leads
              </div>
              <div className="text-2xl font-bold text-white mt-1">{kpiStats.totalLeads}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Matching criteria</div>
            </div>
          )}

          {config.kpis.conversionRate && (
            <div className="p-3.5 rounded-lg bg-slate-800/90 border border-slate-700">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Conversion Rate
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {kpiStats.conversionRate}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Won to Total ratio</div>
            </div>
          )}

          {config.kpis.wonRevenue && (
            <div className="p-3.5 rounded-lg bg-slate-800/90 border border-slate-700">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Won Revenue
              </div>
              <div className="text-2xl font-bold text-cyan-400 mt-1">
                {currencySymbol}
                {kpiStats.wonRevenue.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Payments received</div>
            </div>
          )}

          {config.kpis.pipelineRevenue && (
            <div className="p-3.5 rounded-lg bg-slate-800/90 border border-slate-700">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Pipeline Value
              </div>
              <div className="text-2xl font-bold text-purple-400 mt-1">
                {currencySymbol}
                {kpiStats.pipelineRevenue.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Potential pipeline</div>
            </div>
          )}

          {config.kpis.activeLeads && (
            <div className="p-3.5 rounded-lg bg-slate-800/90 border border-slate-700">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Active Pipeline
              </div>
              <div className="text-2xl font-bold text-blue-400 mt-1">{kpiStats.activeLeads}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">In follow-up / negotiation</div>
            </div>
          )}

          {config.kpis.topSegment && (
            <div className="p-3.5 rounded-lg bg-slate-800/90 border border-slate-700">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Top Contributor
              </div>
              <div className="text-xl font-bold text-amber-400 mt-1 truncate">
                {kpiStats.topSegment || 'N/A'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Highest lead share</div>
            </div>
          )}

          {config.kpis.avgDealSize && (
            <div className="p-3.5 rounded-lg bg-slate-800/90 border border-slate-700">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Avg Deal Size
              </div>
              <div className="text-2xl font-bold text-white mt-1">
                {currencySymbol}
                {Math.round(kpiStats.avgDealSize).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Per converted lead</div>
            </div>
          )}

          {config.kpis.avgLeadScore && (
            <div className="p-3.5 rounded-lg bg-slate-800/90 border border-slate-700">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Avg Lead Score
              </div>
              <div className="text-2xl font-bold text-white mt-1">{kpiStats.avgScore}/100</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Quality index</div>
            </div>
          )}
        </div>

        {/* 5. Matrix Cross-Tab Performance Breakdown Table */}
        {matrixRows.length > 0 && (
          <div className="rounded-lg border border-slate-700 overflow-hidden bg-slate-900/90">
            <div className="px-4 py-2.5 bg-slate-800/90 border-b border-slate-700 text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center justify-between">
              <span>
                Pivot Cross-Tab Matrix ({getDimTitle(rowDim)} × {getDimTitle(colDim)})
              </span>
              <span className="text-[10px] font-normal text-slate-400 lowercase">
                Metric: {cellMetric === 'revenue' ? 'Won Revenue' : 'Lead Count'}
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', borderBottom: '1px solid #334155' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#94a3b8' }}>
                    {getDimTitle(rowDim)}
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: '#94a3b8' }}>
                    Total Leads
                  </th>
                  
                  {/* Dynamic Column Headers */}
                  {colItems.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        textAlign: 'right',
                        padding: '8px 10px',
                        fontWeight: 600,
                        color: col.color || '#94a3b8',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.label}
                    </th>
                  ))}

                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: '#38bdf8' }}>
                    Revenue Won
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, color: '#34d399' }}>
                    Conv. Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.slice(0, 20).map((row, idx) => {
                  const rate = row.total > 0 ? ((row.paid / row.total) * 100).toFixed(1) : '0';
                  return (
                    <tr
                      key={row.key}
                      style={{
                        borderBottom: '1px solid #1e293b',
                        backgroundColor: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.5)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: '#f8fafc' }}>{row.name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{row.total}</td>
                      
                      {/* Matrix Cell Values */}
                      {colItems.map((col) => {
                        const cell = row.cells[col.key];
                        const val = cellMetric === 'revenue' ? (cell ? `${currencySymbol}${cell.revenue.toLocaleString('en-IN')}` : '-') : (cell ? cell.count : 0);
                        return (
                          <td
                            key={col.key}
                            style={{
                              padding: '8px 10px',
                              textAlign: 'right',
                              color: cell && cell.count > 0 ? (col.color || '#f8fafc') : '#475569',
                              fontWeight: cell && cell.count > 0 ? 600 : 400,
                            }}
                          >
                            {val}
                          </td>
                        );
                      })}

                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#38bdf8' }}>
                        {currencySymbol}
                        {row.revenue.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#34d399' }}>
                        {rate}%
                      </td>
                    </tr>
                  );
                })}

                {/* Total Row */}
                <tr
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    borderTop: '2px solid #475569',
                    fontWeight: 700,
                  }}
                >
                  <td style={{ padding: '8px 12px', color: '#f8fafc' }}>Total / Average</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#f8fafc' }}>
                    {kpiStats.totalLeads}
                  </td>
                  
                  {colItems.map((col) => {
                    const colTotal = matrixRows.reduce(
                      (acc, r) => acc + (cellMetric === 'revenue' ? (r.cells[col.key]?.revenue || 0) : (r.cells[col.key]?.count || 0)),
                      0
                    );
                    const val = cellMetric === 'revenue' ? `${currencySymbol}${colTotal.toLocaleString('en-IN')}` : colTotal;
                    return (
                      <td
                        key={col.key}
                        style={{
                          padding: '8px 10px',
                          textAlign: 'right',
                          color: '#f8fafc',
                        }}
                      >
                        {val}
                      </td>
                    );
                  })}

                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#38bdf8' }}>
                    {currencySymbol}
                    {kpiStats.wonRevenue.toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#34d399' }}>
                    {kpiStats.conversionRate}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 6. Top Filtered Leads Sample (up to 20 leads) */}
        {leads.length > 0 && (
          <div className="rounded-lg border border-slate-700 overflow-hidden bg-slate-900/90">
            <div className="px-4 py-2 bg-slate-800/90 border-b border-slate-700 text-xs font-bold text-cyan-300 uppercase tracking-wider">
              Lead Records Sample (Showing Top {Math.min(leads.length, 20)} of {leads.length})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', borderBottom: '1px solid #334155' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: '#94a3b8' }}>Lead Name</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: '#94a3b8' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: '#94a3b8' }}>Contact</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: '#94a3b8' }}>Source</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', color: '#94a3b8' }}>Product</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', color: '#94a3b8' }}>Revenue</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', color: '#94a3b8' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 20).map((l, idx) => (
                  <tr
                    key={l.id}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      backgroundColor: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.5)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '6px 10px', fontWeight: 500, color: '#f8fafc' }}>
                      {l.name || 'Unnamed'}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#38bdf8' }}>
                      {statusMap.get(l.status) || l.status}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{l.email || l.phone || '-'}</td>
                    <td style={{ padding: '6px 10px', color: '#cbd5e1' }}>{l.lead_source || '-'}</td>
                    <td style={{ padding: '6px 10px', color: '#cbd5e1' }}>{l.product_purchased || '-'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#34d399' }}>
                      {l.revenue_received ? `${currencySymbol}${l.revenue_received.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: '#94a3b8' }}>
                      {l.created_at ? format(new Date(l.created_at), 'yyyy-MM-dd') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-700/80 pt-3 text-[10px] text-slate-500">
          <div>FastestCRM • High Velocity Intelligent Sales Analytics</div>
          <div>Confidential • For Internal Enterprise Use Only</div>
        </div>
      </div>
    );
  }
);
