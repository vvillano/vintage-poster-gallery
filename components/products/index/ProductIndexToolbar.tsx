'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FilterState, FilterOptions, SortState, ColumnKey } from '@/types/product-index';
import FilterBar from './FilterBar';
import ColumnPicker from './ColumnPicker';

interface ProductIndexToolbarProps {
  search: string;
  onSearchChange: (search: string) => void;
  filters: FilterState;
  filterOptions: FilterOptions;
  onFiltersChange: (filters: FilterState) => void;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  enabledColumns: Set<ColumnKey>;
  onColumnsChange: (columns: Set<ColumnKey>) => void;
  totalResults: number;
}

export default function ProductIndexToolbar({
  search,
  onSearchChange,
  filters,
  filterOptions,
  onFiltersChange,
  sort,
  onSortChange,
  enabledColumns,
  onColumnsChange,
  totalResults,
}: ProductIndexToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);

  // Sync localSearch when external search changes (e.g. URL param)
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounced search
  const debouncedSearch = useCallback(
    (() => {
      let timeout: NodeJS.Timeout;
      return (value: string) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => onSearchChange(value), 300);
      };
    })(),
    [onSearchChange]
  );

  function handleSearchInput(value: string) {
    setLocalSearch(value);
    debouncedSearch(value);
  }

  function handleClearSearch() {
    setLocalSearch('');
    onSearchChange('');
  }

  // Sort options for the dropdown
  const sortOptions = [
    { label: 'Date Updated (Newest)', column: 'shopify_updated_at', order: 'desc' as const },
    { label: 'Date Updated (Oldest)', column: 'shopify_updated_at', order: 'asc' as const },
    { label: 'Date Created (Newest)', column: 'shopify_created_at', order: 'desc' as const },
    { label: 'Title (A-Z)', column: 'title', order: 'asc' as const },
    { label: 'Title (Z-A)', column: 'title', order: 'desc' as const },
    { label: 'Price (Low-High)', column: 'price', order: 'asc' as const },
    { label: 'Price (High-Low)', column: 'price', order: 'desc' as const },
    { label: 'Purchase Price (Low-High)', column: 'purchase_price', order: 'asc' as const },
    { label: 'Total COGS (High-Low)', column: 'total_cogs', order: 'desc' as const },
  ];

  const currentSortValue = `${sort.column}:${sort.order}`;

  return (
    <div className="space-y-3">
      {/* Row 1: Search + Sort + Columns + Result count */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search by title or SKU..."
            className="w-full pl-8 pr-8 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {localSearch && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Result count */}
        <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
          {totalResults.toLocaleString()} Results
        </span>

        {/* Sort dropdown */}
        <select
          value={currentSortValue}
          onChange={(e) => {
            const [column, order] = e.target.value.split(':');
            onSortChange({ column, order: order as 'asc' | 'desc' });
          }}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          {sortOptions.map((opt) => (
            <option key={`${opt.column}:${opt.order}`} value={`${opt.column}:${opt.order}`}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Column picker */}
        <ColumnPicker enabledColumns={enabledColumns} onChange={onColumnsChange} />
      </div>

      {/* Row 2: Filters */}
      <FilterBar filters={filters} filterOptions={filterOptions} onChange={onFiltersChange} />
    </div>
  );
}
