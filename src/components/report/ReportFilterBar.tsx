import { useState, useMemo } from 'react';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Search,
  X,
  Filter,
  Calendar,
  User,
  Tag,
  Package,
  Flame,
  Plus,
  RotateCcw,
  Sparkles,
  DollarSign,
  ChevronDown
} from 'lucide-react';
import { CompanyLeadStatus } from '@/hooks/useLeadStatuses';
import { CustomColumn } from '@/hooks/useCustomColumns';

export type DateRangePreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'custom';

export interface CustomFieldFilter {
  fieldId: string;
  fieldLabel: string;
  value: string;
}

export interface ReportFilterState {
  search: string;
  datePreset: DateRangePreset;
  customStartDate: string;
  customEndDate: string;
  statuses: string[];
  owners: string[];
  sources: string[];
  products: string[];
  priorities: string[]; // 'hot' | 'warm' | 'cold'
  revenueStatus: 'all' | 'with_revenue' | 'zero_revenue';
  customFieldFilters: CustomFieldFilter[];
}

interface ReportFilterBarProps {
  filters: ReportFilterState;
  onFilterChange: (newFilters: ReportFilterState) => void;
  leadStatuses: CompanyLeadStatus[];
  teamMembers: { id: string; name: string }[];
  productsList: { id: string; name: string; category?: string }[];
  availableSources: string[];
  customColumns: CustomColumn[];
  totalLeadsCount: number;
  filteredLeadsCount: number;
}

export function ReportFilterBar({
  filters,
  onFilterChange,
  leadStatuses,
  teamMembers,
  productsList,
  availableSources,
  customColumns,
  totalLeadsCount,
  filteredLeadsCount,
}: ReportFilterBarProps) {
  const [selectedCustomCol, setSelectedCustomCol] = useState<string>('');
  const [customColValue, setCustomColValue] = useState<string>('');

  const update = (partial: Partial<ReportFilterState>) => {
    onFilterChange({ ...filters, ...partial });
  };

  const toggleArrayFilter = (key: 'statuses' | 'owners' | 'sources' | 'products' | 'priorities', value: string) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    update({ [key]: updated });
  };

  const handleAddCustomFilter = () => {
    if (!selectedCustomCol || !customColValue.trim()) return;
    const colObj = customColumns.find((c) => c.id === selectedCustomCol);
    const label = colObj ? colObj.label : selectedCustomCol;
    
    // Check if already exists for this field
    const existingIndex = filters.customFieldFilters.findIndex((f) => f.fieldId === selectedCustomCol);
    let updatedFilters = [...filters.customFieldFilters];
    if (existingIndex >= 0) {
      updatedFilters[existingIndex] = { fieldId: selectedCustomCol, fieldLabel: label, value: customColValue.trim() };
    } else {
      updatedFilters.push({ fieldId: selectedCustomCol, fieldLabel: label, value: customColValue.trim() });
    }

    update({ customFieldFilters: updatedFilters });
    setSelectedCustomCol('');
    setCustomColValue('');
  };

  const handleRemoveCustomFilter = (fieldId: string) => {
    update({
      customFieldFilters: filters.customFieldFilters.filter((f) => f.fieldId !== fieldId),
    });
  };

  const resetAllFilters = () => {
    onFilterChange({
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
  };

  const applyPreset = (presetName: string) => {
    if (presetName === 'active_pipeline') {
      const activeStatusValues = leadStatuses
        .filter((s) => ['interested', 'new', 'site_visit', 'negotiation', 'follow_up'].includes(s.value) || s.category === 'interested')
        .map((s) => s.value);
      update({
        statuses: activeStatusValues.length > 0 ? activeStatusValues : ['interested', 'follow_up'],
        datePreset: 'all',
      });
    } else if (presetName === 'closed_won') {
      const wonValues = leadStatuses.filter((s) => s.value === 'paid' || s.category === 'paid').map((s) => s.value);
      update({
        statuses: wonValues.length > 0 ? wonValues : ['paid'],
        revenueStatus: 'with_revenue',
        datePreset: '30d',
      });
    } else if (presetName === 'hot_leads') {
      update({
        priorities: ['hot'],
        datePreset: 'all',
      });
    } else if (presetName === 'unassigned') {
      update({
        owners: ['unassigned'],
        datePreset: 'all',
      });
    }
  };

  // Active filter count calculation
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.datePreset !== 'all') count++;
    count += filters.statuses.length;
    count += filters.owners.length;
    count += filters.sources.length;
    count += filters.products.length;
    count += filters.priorities.length;
    if (filters.revenueStatus !== 'all') count++;
    count += filters.customFieldFilters.length;
    return count;
  }, [filters]);

  const datePresetLabels: Record<DateRangePreset, string> = {
    all: 'All Time',
    today: 'Today',
    yesterday: 'Yesterday',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    this_month: 'This Month',
    last_month: 'Last Month',
    this_quarter: 'This Quarter',
    custom: 'Custom Range',
  };

  return (
    <div className="space-y-4 bg-card/60 border border-border/60 rounded-xl p-4 md:p-5 backdrop-blur-md shadow-sm">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads by name, email, phone, details..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="pl-9 bg-background/80 border-border/70 focus-visible:ring-1"
          />
          {filters.search && (
            <button
              onClick={() => update({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Quick Filter Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 mr-1">
            <Sparkles className="h-3 w-3 text-amber-500" /> Presets:
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset('active_pipeline')}
            className="text-xs h-8 px-2.5 bg-background/60 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
          >
            Active Pipeline
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset('closed_won')}
            className="text-xs h-8 px-2.5 bg-background/60 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/40"
          >
            Closed Won (30d)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset('hot_leads')}
            className="text-xs h-8 px-2.5 bg-background/60 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/40"
          >
            Hot Priority
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset('unassigned')}
            className="text-xs h-8 px-2.5 bg-background/60 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/40"
          >
            Unassigned
          </Button>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="text-xs h-8 px-2.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1 ml-auto lg:ml-2"
            >
              <RotateCcw className="h-3 w-3" /> Reset ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>

      {/* Main Attribute Dropdowns Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
        {/* 1. Date Range Dropdown */}
        <Select
          value={filters.datePreset}
          onValueChange={(val) => update({ datePreset: val as DateRangePreset })}
        >
          <SelectTrigger className="h-9 text-xs bg-background/80 border-border/70 justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{datePresetLabels[filters.datePreset]}</span>
            </div>
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="custom">Custom Date Range...</SelectItem>
          </SelectContent>
        </Select>

        {/* 2. Statuses Dropdown Multi-Select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 text-xs justify-between px-3 bg-background/80 border-border/70 font-normal ${
                filters.statuses.length > 0 ? 'border-primary/60 text-primary' : ''
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">
                  {filters.statuses.length === 0
                    ? 'All Statuses'
                    : `${filters.statuses.length} Statuses`}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 bg-popover border-border max-h-64 overflow-y-auto" align="start">
            <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">Filter by Status</div>
            <div className="space-y-1">
              {leadStatuses.map((s) => {
                const checked = filters.statuses.includes(s.value);
                return (
                  <button
                    key={s.id || s.value}
                    onClick={() => toggleArrayFilter('statuses', s.value)}
                    className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded text-xs transition-colors ${
                      checked ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: s.color || '#3B82F6' }}
                      />
                      <span className="truncate">{s.label}</span>
                    </div>
                    {checked && <X className="h-3 w-3 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* 3. Sales Owner Dropdown Multi-Select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 text-xs justify-between px-3 bg-background/80 border-border/70 font-normal ${
                filters.owners.length > 0 ? 'border-primary/60 text-primary' : ''
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">
                  {filters.owners.length === 0
                    ? 'All Owners'
                    : `${filters.owners.length} Owners`}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 bg-popover border-border max-h-64 overflow-y-auto" align="start">
            <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">Filter by Sales Rep</div>
            <div className="space-y-1">
              <button
                onClick={() => toggleArrayFilter('owners', 'unassigned')}
                className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded text-xs transition-colors ${
                  filters.owners.includes('unassigned') ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted text-foreground'
                }`}
              >
                <span>Unassigned Leads</span>
                {filters.owners.includes('unassigned') && <X className="h-3 w-3 text-primary shrink-0" />}
              </button>
              {teamMembers.map((m) => {
                const checked = filters.owners.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleArrayFilter('owners', m.id)}
                    className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded text-xs transition-colors ${
                      checked ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <span className="truncate">{m.name}</span>
                    {checked && <X className="h-3 w-3 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* 4. Lead Source Dropdown Multi-Select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 text-xs justify-between px-3 bg-background/80 border-border/70 font-normal ${
                filters.sources.length > 0 ? 'border-primary/60 text-primary' : ''
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">
                  {filters.sources.length === 0
                    ? 'All Sources'
                    : `${filters.sources.length} Sources`}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 bg-popover border-border max-h-64 overflow-y-auto" align="start">
            <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">Filter by Lead Source</div>
            <div className="space-y-1">
              {availableSources.map((src) => {
                const checked = filters.sources.includes(src);
                return (
                  <button
                    key={src}
                    onClick={() => toggleArrayFilter('sources', src)}
                    className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded text-xs transition-colors ${
                      checked ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <span className="truncate capitalize">{src}</span>
                    {checked && <X className="h-3 w-3 text-primary shrink-0" />}
                  </button>
                );
              })}
              {availableSources.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-1">No lead sources found</div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* 5. Product / Plan Dropdown Multi-Select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 text-xs justify-between px-3 bg-background/80 border-border/70 font-normal ${
                filters.products.length > 0 ? 'border-primary/60 text-primary' : ''
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">
                  {filters.products.length === 0
                    ? 'All Products'
                    : `${filters.products.length} Products`}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 bg-popover border-border max-h-64 overflow-y-auto" align="start">
            <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">Filter by Product</div>
            <div className="space-y-1">
              {productsList.map((p) => {
                const checked = filters.products.includes(p.name);
                return (
                  <button
                    key={p.id || p.name}
                    onClick={() => toggleArrayFilter('products', p.name)}
                    className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded text-xs transition-colors ${
                      checked ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="truncate">
                      <div className="truncate font-medium">{p.name}</div>
                      {p.category && <div className="text-[10px] text-muted-foreground">{p.category}</div>}
                    </div>
                    {checked && <X className="h-3 w-3 text-primary shrink-0" />}
                  </button>
                );
              })}
              {productsList.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-1">No products catalogued</div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* 6. Priority / Score Dropdown Multi-Select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 text-xs justify-between px-3 bg-background/80 border-border/70 font-normal ${
                filters.priorities.length > 0 ? 'border-primary/60 text-primary' : ''
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Flame className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">
                  {filters.priorities.length === 0
                    ? 'All Priorities'
                    : `${filters.priorities.length} Priorities`}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2 bg-popover border-border" align="start">
            <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">Priority & Score Tier</div>
            <div className="space-y-1">
              {[
                { id: 'hot', label: '🔥 Hot Lead (Score 70+)', color: 'text-rose-500' },
                { id: 'warm', label: '⚡ Warm Lead (Score 35-69)', color: 'text-amber-500' },
                { id: 'cold', label: '❄️ Cold Lead (Score < 35)', color: 'text-blue-500' },
              ].map((tier) => {
                const checked = filters.priorities.includes(tier.id);
                return (
                  <button
                    key={tier.id}
                    onClick={() => toggleArrayFilter('priorities', tier.id)}
                    className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded text-xs transition-colors ${
                      checked ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <span className={tier.color}>{tier.label}</span>
                    {checked && <X className="h-3 w-3 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Custom Date Range Inputs (if datePreset === 'custom') */}
      {filters.datePreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50 text-xs">
          <span className="font-medium text-muted-foreground">Custom Date Range:</span>
          <div className="flex items-center gap-2">
            <span>From:</span>
            <Input
              type="date"
              value={filters.customStartDate}
              onChange={(e) => update({ customStartDate: e.target.value })}
              className="h-8 w-36 bg-background text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>To:</span>
            <Input
              type="date"
              value={filters.customEndDate}
              onChange={(e) => update({ customEndDate: e.target.value })}
              className="h-8 w-36 bg-background text-xs"
            />
          </div>
        </div>
      )}

      {/* Custom Lead Field / Attribute Filter Section */}
      {customColumns.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Plus className="h-3 w-3" /> Custom Lead Attributes:
          </span>
          <Select value={selectedCustomCol} onValueChange={setSelectedCustomCol}>
            <SelectTrigger className="h-8 w-44 text-xs bg-background/80">
              <SelectValue placeholder="Choose custom attribute" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {customColumns.map((col) => (
                <SelectItem key={col.id} value={col.id}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedCustomCol && (
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="Attribute value contains..."
                value={customColValue}
                onChange={(e) => setCustomColValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomFilter()}
                className="h-8 w-48 text-xs bg-background"
              />
              <Button
                size="sm"
                onClick={handleAddCustomFilter}
                className="h-8 px-2.5 text-xs"
              >
                Add Filter
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Active Filter Pills Bar */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40">
          <span className="text-xs text-muted-foreground mr-1">Active:</span>

          {/* Date Filter Pill */}
          {filters.datePreset !== 'all' && (
            <Badge variant="secondary" className="text-[11px] font-normal gap-1 pl-2 pr-1 py-0.5">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              {datePresetLabels[filters.datePreset]}
              <button
                onClick={() => update({ datePreset: 'all', customStartDate: '', customEndDate: '' })}
                className="hover:text-rose-500 ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {/* Status Pills */}
          {filters.statuses.map((st) => {
            const stObj = leadStatuses.find((s) => s.value === st);
            return (
              <Badge key={st} variant="secondary" className="text-[11px] font-normal gap-1 pl-2 pr-1 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stObj?.color || '#3B82F6' }} />
                {stObj?.label || st}
                <button onClick={() => toggleArrayFilter('statuses', st)} className="hover:text-rose-500 ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}

          {/* Owner Pills */}
          {filters.owners.map((ow) => {
            const member = teamMembers.find((m) => m.id === ow);
            const label = ow === 'unassigned' ? 'Unassigned' : member?.name || ow;
            return (
              <Badge key={ow} variant="secondary" className="text-[11px] font-normal gap-1 pl-2 pr-1 py-0.5">
                <User className="h-3 w-3 text-muted-foreground" />
                {label}
                <button onClick={() => toggleArrayFilter('owners', ow)} className="hover:text-rose-500 ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}

          {/* Source Pills */}
          {filters.sources.map((src) => (
            <Badge key={src} variant="secondary" className="text-[11px] font-normal gap-1 pl-2 pr-1 py-0.5">
              <Tag className="h-3 w-3 text-muted-foreground" />
              {src}
              <button onClick={() => toggleArrayFilter('sources', src)} className="hover:text-rose-500 ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {/* Product Pills */}
          {filters.products.map((prod) => (
            <Badge key={prod} variant="secondary" className="text-[11px] font-normal gap-1 pl-2 pr-1 py-0.5">
              <Package className="h-3 w-3 text-muted-foreground" />
              {prod}
              <button onClick={() => toggleArrayFilter('products', prod)} className="hover:text-rose-500 ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {/* Priority Pills */}
          {filters.priorities.map((p) => (
            <Badge key={p} variant="secondary" className="text-[11px] font-normal gap-1 pl-2 pr-1 py-0.5 capitalize">
              <Flame className="h-3 w-3 text-amber-500" />
              {p} Priority
              <button onClick={() => toggleArrayFilter('priorities', p)} className="hover:text-rose-500 ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {/* Custom Field Pills */}
          {filters.customFieldFilters.map((cf) => (
            <Badge key={cf.fieldId} variant="secondary" className="text-[11px] font-normal gap-1 pl-2 pr-1 py-0.5">
              <span className="text-muted-foreground">{cf.fieldLabel}:</span> {cf.value}
              <button onClick={() => handleRemoveCustomFilter(cf.fieldId)} className="hover:text-rose-500 ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Dataset Summary Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          <span>
            {activeFiltersCount > 0 ? (
              <>
                Filtered: <span className="font-semibold text-foreground">{filteredLeadsCount}</span> of{' '}
                <span className="font-semibold text-foreground">{totalLeadsCount}</span> leads matching criteria
              </>
            ) : (
              <>
                Dataset Scope: <span className="font-semibold text-foreground">{totalLeadsCount}</span> total leads loaded
              </>
            )}
          </span>
        </div>
        {activeFiltersCount > 0 && (
          <button
            onClick={resetAllFilters}
            className="text-[11px] text-rose-500 hover:text-rose-600 underline font-medium"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
