import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, X, Plus, Upload, Trash2, Users, Settings2 } from 'lucide-react';
import { MultiSelectFilter } from '@/components/ui/multi-select-filter';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState, useEffect } from 'react';

interface FilterOption {
  label: string;
  value: string;
  group?: string;
}

export interface ActiveFilter {
  id: string;
  label: string;
  options: FilterOption[];
  selectedValues: Set<string>;
  onSelectionChange: (values: Set<string>) => void;
}

interface MobileLeadsHeaderProps {
  title: string;
  icon?: ReactNode;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filterOptions?: {
    owners?: FilterOption[];
    statuses?: FilterOption[];
    products?: FilterOption[];
    propertyTypes?: FilterOption[];
  };
  selectedOwners?: Set<string>;
  onOwnersChange?: (owners: Set<string>) => void;
  selectedStatuses?: Set<string>;
  onStatusesChange?: (statuses: Set<string>) => void;
  selectedProducts?: Set<string>;
  onProductsChange?: (products: Set<string>) => void;
  selectedPropertyTypes?: Set<string>;
  onPropertyTypesChange?: (types: Set<string>) => void;
  selectedCount?: number;
  onDelete?: () => void;
  onAssign?: () => void;
  onAdd?: () => void;
  onUpload?: () => void;
  addButton?: ReactNode;
  uploadButton?: ReactNode;
  canDelete?: boolean;
  onEditLayout?: () => void;
  activeFilters?: ActiveFilter[];
}

export function MobileLeadsHeader({
  title,
  icon,
  searchValue,
  onSearchChange,
  filterOptions,
  selectedOwners = new Set(),
  onOwnersChange,
  selectedStatuses = new Set(),
  onStatusesChange,
  selectedProducts = new Set(),
  onProductsChange,
  selectedPropertyTypes = new Set(),
  onPropertyTypesChange,
  selectedCount = 0,
  onDelete,
  onAssign,
  addButton,
  uploadButton,
  canDelete = false,
  onEditLayout,
  activeFilters
}: MobileLeadsHeaderProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchValue);

  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchValue) {
        onSearchChange(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange, searchValue]);

  const hasActiveFilters = activeFilters
    ? activeFilters.some(f => f.selectedValues.size > 0)
    : (selectedOwners.size > 0 ||
       selectedStatuses.size > 0 ||
       selectedProducts.size > 0 ||
       selectedPropertyTypes.size > 0);

  const clearAllFilters = () => {
    if (activeFilters) {
      activeFilters.forEach(f => f.onSelectionChange(new Set()));
    } else {
      onOwnersChange?.(new Set());
      onStatusesChange?.(new Set());
      onProductsChange?.(new Set());
      onPropertyTypesChange?.(new Set());
    }
  };

  return (
    <div className="space-y-3">
      {/* Title and Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h1 className="text-xl md:text-3xl font-bold truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile: Show compact buttons */}
          <div className="flex md:hidden gap-2">
            {onEditLayout && (
              <Button variant="outline" size="icon" onClick={onEditLayout}>
                <Settings2 className="h-4 w-4" />
              </Button>
            )}
            {uploadButton}
            {addButton}
          </div>
          {/* Desktop: Show full buttons */}
          <div className="hidden md:flex gap-2">
            {onEditLayout && (
              <Button variant="outline" onClick={onEditLayout}>
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            )}
            {uploadButton}
            {addButton}
          </div>
        </div>
      </div>

      {/* Selection Actions */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <div className="flex-1" />
          {canDelete && onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Delete</span>
            </Button>
          )}
          {onAssign && (
            <Button variant="secondary" size="sm" onClick={onAssign}>
              <Users className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Assign</span>
            </Button>
          )}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Mobile Filter Sheet */}
        <div className="md:hidden">
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full" />
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh]">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  Filters
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                      Clear All
                      <X className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                {activeFilters ? (
                  activeFilters.map((filter) => (
                    <div key={filter.id}>
                      <label className="text-sm font-medium mb-2 block">{filter.label}</label>
                      <MultiSelectFilter
                        title={filter.label}
                        options={filter.options}
                        selectedValues={filter.selectedValues}
                        onSelectionChange={filter.onSelectionChange}
                      />
                    </div>
                  ))
                ) : (
                  <>
                    {filterOptions?.owners && onOwnersChange && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Owner</label>
                        <MultiSelectFilter
                          title="Owner"
                          options={filterOptions.owners}
                          selectedValues={selectedOwners}
                          onSelectionChange={onOwnersChange}
                        />
                      </div>
                    )}
                    {filterOptions?.statuses && onStatusesChange && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Status</label>
                        <MultiSelectFilter
                          title="Status"
                          options={filterOptions.statuses}
                          selectedValues={selectedStatuses}
                          onSelectionChange={onStatusesChange}
                        />
                      </div>
                    )}
                    {filterOptions?.products && onProductsChange && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Product</label>
                        <MultiSelectFilter
                          title="Product"
                          options={filterOptions.products}
                          selectedValues={selectedProducts}
                          onSelectionChange={onProductsChange}
                        />
                      </div>
                    )}
                    {filterOptions?.propertyTypes && onPropertyTypesChange && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Property Type</label>
                        <MultiSelectFilter
                          title="Property Type"
                          options={filterOptions.propertyTypes}
                          selectedValues={selectedPropertyTypes}
                          onSelectionChange={onPropertyTypesChange}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="mt-6">
                <Button
                  className="w-full"
                  onClick={() => setFiltersOpen(false)}
                >
                  Apply Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
 
        {/* Desktop Filters */}
        <div className="hidden md:block">
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>
 
      {/* Desktop Filter Pills */}
      <div className="hidden md:flex flex-wrap gap-2">
        {activeFilters ? (
          activeFilters.map((filter) => (
            <MultiSelectFilter
              key={filter.id}
              title={filter.label}
              options={filter.options}
              selectedValues={filter.selectedValues}
              onSelectionChange={filter.onSelectionChange}
            />
          ))
        ) : (
          <>
            {filterOptions?.owners && onOwnersChange && (
              <MultiSelectFilter
                title="Owner"
                options={filterOptions.owners}
                selectedValues={selectedOwners}
                onSelectionChange={onOwnersChange}
              />
            )}
            {filterOptions?.statuses && onStatusesChange && (
              <MultiSelectFilter
                title="Status"
                options={filterOptions.statuses}
                selectedValues={selectedStatuses}
                onSelectionChange={onStatusesChange}
              />
            )}
            {filterOptions?.products && onProductsChange && (
              <MultiSelectFilter
                title="Product"
                options={filterOptions.products}
                selectedValues={selectedProducts}
                onSelectionChange={onProductsChange}
              />
            )}
            {filterOptions?.propertyTypes && onPropertyTypesChange && (
              <MultiSelectFilter
                title="Property Type"
                options={filterOptions.propertyTypes}
                selectedValues={selectedPropertyTypes}
                onSelectionChange={onPropertyTypesChange}
              />
            )}
          </>
        )}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
