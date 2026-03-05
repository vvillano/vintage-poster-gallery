'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import ProductIndexToolbar from '@/components/products/index/ProductIndexToolbar';
import ProductIndexTable from '@/components/products/index/ProductIndexTable';
import ProductIndexPagination from '@/components/products/index/ProductIndexPagination';
import SyncStatusBar from '@/components/products/index/SyncStatusBar';
import {
  DEFAULT_VISIBLE_COLUMNS,
  type ColumnKey,
  type FilterState,
  type FilterOptions,
  type SortState,
  type IndexProduct,
  type IndexPagination,
  type SyncStatus,
} from '@/types/product-index';

const EMPTY_FILTERS: FilterState = {
  status: '',
  productType: '',
  artist: '',
  country: '',
  platform: '',
  tags: '',
  hasImage: '',
  tagInclude: '',
  tagExclude: '',
  channelInclude: '',
  channelExclude: '',
};

const EMPTY_FILTER_OPTIONS: FilterOptions = {
  productTypes: [],
  artists: [],
  countries: [],
  platforms: [],
  tags: [],
  internalTags: [],
  channels: [],
};

const DEFAULT_SORT: SortState = { column: 'shopify_updated_at', order: 'desc' };

const STORAGE_KEY = 'products-index-columns';
const FILTERS_STORAGE_KEY = 'products-index-filters';

function loadColumns(): Set<ColumnKey> {
  if (typeof window === 'undefined') return new Set(DEFAULT_VISIBLE_COLUMNS);
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ColumnKey[];
      return new Set(parsed);
    }
  } catch { /* ignore */ }
  return new Set(DEFAULT_VISIBLE_COLUMNS);
}

function saveColumns(columns: Set<ColumnKey>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...columns]));
}

interface PersistedFilterState {
  q: string;
  filters: FilterState;
  sort: SortState;
  page: number;
  pageSize: number;
}

function loadPersistedFilters(): PersistedFilterState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    if (stored) return JSON.parse(stored) as PersistedFilterState;
  } catch { /* ignore */ }
  return null;
}

function savePersistedFilters(state: PersistedFilterState) {
  try {
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-slate-600">Loading products...</p>
        </div>
      </div>
    }>
      <ProductsPageInner />
    </Suspense>
  );
}

function ProductsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL params take priority; if none present, restore from sessionStorage
  const hasUrlParams = searchParams.toString().length > 0;
  const persisted = hasUrlParams ? null : loadPersistedFilters();

  const [search, setSearch] = useState(
    searchParams.get('q') || persisted?.q || ''
  );
  const [filters, setFilters] = useState<FilterState>({
    status: searchParams.get('status') || persisted?.filters.status || '',
    productType: searchParams.get('product_type') || persisted?.filters.productType || '',
    artist: searchParams.get('artist') || persisted?.filters.artist || '',
    country: searchParams.get('country') || persisted?.filters.country || '',
    platform: searchParams.get('platform') || persisted?.filters.platform || '',
    tags: searchParams.get('tags') || persisted?.filters.tags || '',
    hasImage: searchParams.get('has_image') || persisted?.filters.hasImage || '',
    tagInclude: searchParams.get('tag_include') || persisted?.filters.tagInclude || '',
    tagExclude: searchParams.get('tag_exclude') || persisted?.filters.tagExclude || '',
    channelInclude: searchParams.get('channel_include') || persisted?.filters.channelInclude || '',
    channelExclude: searchParams.get('channel_exclude') || persisted?.filters.channelExclude || '',
  });
  const [sort, setSort] = useState<SortState>({
    column: searchParams.get('sort') || persisted?.sort.column || DEFAULT_SORT.column,
    order: (searchParams.get('order') as 'asc' | 'desc') || persisted?.sort.order || DEFAULT_SORT.order,
  });
  const [page, setPage] = useState(parseInt(searchParams.get('page') || String(persisted?.page || 1)));
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get('pageSize') || String(persisted?.pageSize || 50)));

  // Data
  const [products, setProducts] = useState<IndexProduct[]>([]);
  const [pagination, setPagination] = useState<IndexPagination>({ page: 1, pageSize: 50, totalResults: 0, totalPages: 0 });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(EMPTY_FILTER_OPTIONS);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Column visibility
  const [enabledColumns, setEnabledColumns] = useState<Set<ColumnKey>>(loadColumns);

  // Fetch filter options and sync status on mount
  useEffect(() => {
    fetch('/api/products-index/filters')
      .then((res) => res.ok ? res.json() : EMPTY_FILTER_OPTIONS)
      .then(setFilterOptions)
      .catch(() => {});

    fetch('/api/products-index/sync')
      .then((res) => res.ok ? res.json() : null)
      .then(setSyncStatus)
      .catch(() => {});
  }, []);

  // Build URL params and fetch products
  const fetchProducts = useCallback(async (opts: {
    q?: string;
    filters?: FilterState;
    sort?: SortState;
    page?: number;
    pageSize?: number;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (opts.q) params.set('q', opts.q);
      if (opts.filters?.status) params.set('status', opts.filters.status);
      if (opts.filters?.productType) params.set('product_type', opts.filters.productType);
      if (opts.filters?.artist) params.set('artist', opts.filters.artist);
      if (opts.filters?.country) params.set('country', opts.filters.country);
      if (opts.filters?.platform) params.set('platform', opts.filters.platform);
      if (opts.filters?.tags) params.set('tags', opts.filters.tags);
      if (opts.filters?.hasImage) params.set('has_image', opts.filters.hasImage);
      if (opts.filters?.tagInclude) params.set('tag_include', opts.filters.tagInclude);
      if (opts.filters?.tagExclude) params.set('tag_exclude', opts.filters.tagExclude);
      if (opts.filters?.channelInclude) params.set('channel_include', opts.filters.channelInclude);
      if (opts.filters?.channelExclude) params.set('channel_exclude', opts.filters.channelExclude);
      if (opts.sort) {
        params.set('sort', opts.sort.column);
        params.set('order', opts.sort.order);
      }
      params.set('page', String(opts.page || 1));
      params.set('pageSize', String(opts.pageSize || 50));

      const res = await fetch(`/api/products-index/browse?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to load products');
      }

      const data = await res.json();
      setProducts(data.products);
      setPagination(data.pagination);

      // Update URL (shallow, no reload)
      const urlParams = new URLSearchParams();
      if (opts.q) urlParams.set('q', opts.q);
      if (opts.filters?.status) urlParams.set('status', opts.filters.status);
      if (opts.filters?.productType) urlParams.set('product_type', opts.filters.productType);
      if (opts.filters?.artist) urlParams.set('artist', opts.filters.artist);
      if (opts.filters?.country) urlParams.set('country', opts.filters.country);
      if (opts.filters?.platform) urlParams.set('platform', opts.filters.platform);
      if (opts.filters?.tags) urlParams.set('tags', opts.filters.tags);
      if (opts.filters?.hasImage) urlParams.set('has_image', opts.filters.hasImage);
      if (opts.filters?.tagInclude) urlParams.set('tag_include', opts.filters.tagInclude);
      if (opts.filters?.tagExclude) urlParams.set('tag_exclude', opts.filters.tagExclude);
      if (opts.filters?.channelInclude) urlParams.set('channel_include', opts.filters.channelInclude);
      if (opts.filters?.channelExclude) urlParams.set('channel_exclude', opts.filters.channelExclude);
      if (opts.sort && opts.sort.column !== DEFAULT_SORT.column) urlParams.set('sort', opts.sort.column);
      if (opts.sort && opts.sort.order !== DEFAULT_SORT.order) urlParams.set('order', opts.sort.order);
      if ((opts.page || 1) > 1) urlParams.set('page', String(opts.page));
      if ((opts.pageSize || 50) !== 50) urlParams.set('pageSize', String(opts.pageSize));

      // Persist filter state to sessionStorage for tab lifetime
      savePersistedFilters({
        q: opts.q || '',
        filters: opts.filters || EMPTY_FILTERS,
        sort: opts.sort || DEFAULT_SORT,
        page: opts.page || 1,
        pageSize: opts.pageSize || 50,
      });

      const qs = urlParams.toString();
      router.replace(qs ? `/products?${qs}` : '/products', { scroll: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Initial fetch
  useEffect(() => {
    fetchProducts({ q: search, filters, sort, page, pageSize });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handlers that update state and refetch
  function handleSearchChange(q: string) {
    setSearch(q);
    setPage(1);
    fetchProducts({ q, filters, sort, page: 1, pageSize });
  }

  function handleFiltersChange(newFilters: FilterState) {
    setFilters(newFilters);
    setPage(1);
    fetchProducts({ q: search, filters: newFilters, sort, page: 1, pageSize });
  }

  function handleSortChange(newSort: SortState) {
    setSort(newSort);
    setPage(1);
    fetchProducts({ q: search, filters, sort: newSort, page: 1, pageSize });
  }

  function handleTableSort(newSort: SortState) {
    handleSortChange(newSort);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchProducts({ q: search, filters, sort, page: newPage, pageSize });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handlePageSizeChange(newPageSize: number) {
    setPageSize(newPageSize);
    setPage(1);
    fetchProducts({ q: search, filters, sort, page: 1, pageSize: newPageSize });
  }

  function handleColumnsChange(columns: Set<ColumnKey>) {
    setEnabledColumns(columns);
    saveColumns(columns);
  }

  function handleSyncComplete() {
    // Refresh everything
    fetch('/api/products-index/sync')
      .then((res) => res.ok ? res.json() : null)
      .then(setSyncStatus)
      .catch(() => {});
    fetch('/api/products-index/filters')
      .then((res) => res.ok ? res.json() : EMPTY_FILTER_OPTIONS)
      .then(setFilterOptions)
      .catch(() => {});
    fetchProducts({ q: search, filters, sort, page: 1, pageSize });
    setPage(1);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        <div className="flex items-center gap-3">
          <SyncStatusBar syncStatus={syncStatus} onSyncComplete={handleSyncComplete} />
          <Link
            href="/products/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap"
          >
            + New Product
          </Link>
        </div>
      </div>

      {/* Toolbar: search, filters, sort, column picker */}
      <div className="mb-4">
        <ProductIndexToolbar
          search={search}
          onSearchChange={handleSearchChange}
          filters={filters}
          filterOptions={filterOptions}
          onFiltersChange={handleFiltersChange}
          sort={sort}
          onSortChange={handleSortChange}
          enabledColumns={enabledColumns}
          onColumnsChange={handleColumnsChange}
          totalResults={pagination.totalResults}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-slate-600">Loading products...</p>
            </div>
          </div>
        ) : (
          <ProductIndexTable
            products={products}
            enabledColumns={enabledColumns}
            sort={sort}
            onSort={handleTableSort}
          />
        )}
      </div>

      {/* Pagination */}
      {!loading && pagination.totalResults > 0 && (
        <div className="mt-4">
          <ProductIndexPagination
            pagination={pagination}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}
    </div>
  );
}
