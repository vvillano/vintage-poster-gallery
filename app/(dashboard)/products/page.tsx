'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ProductToolbar, { type ViewMode, type StatusFilter } from '@/components/products/ProductToolbar';
import ProductGrid from '@/components/products/ProductGrid';
import ProductTable from '@/components/products/ProductTable';
import type { BrowseProduct, BrowsePagination } from '@/types/browse-product';

export default function ProductsPage() {
  const [products, setProducts] = useState<BrowseProduct[]>([]);
  const [pagination, setPagination] = useState<BrowsePagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shopDomain, setShopDomain] = useState<string | null>(null);

  // Toolbar state
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('products-view-mode') as ViewMode) || 'grid';
    }
    return 'grid';
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cursor stack for back navigation
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  // Fetch shop domain for external links
  useEffect(() => {
    fetch('/api/shopify/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.config?.shopDomain) {
          setShopDomain(data.config.shopDomain);
        }
      })
      .catch(() => {});
  }, []);

  const fetchProducts = useCallback(async (options?: {
    pageInfo?: string;
    query?: string;
    status?: StatusFilter;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('limit', '50');

      if (options?.pageInfo) {
        params.set('page_info', options.pageInfo);
      } else {
        if (options?.query) params.set('q', options.query);
        if (options?.status && options.status !== 'all') params.set('status', options.status);
      }

      const res = await fetch(`/api/shopify/products/browse?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to load products');
      }

      const data = await res.json();
      setProducts(data.products);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      setProducts([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchProducts({ status: statusFilter, query: searchQuery });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(query: string) {
    setSearchQuery(query);
    setCursorStack([]);
    fetchProducts({ query, status: statusFilter });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleStatusChange(status: StatusFilter) {
    setStatusFilter(status);
    setCursorStack([]);
    fetchProducts({ query: searchQuery, status });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem('products-view-mode', mode);
  }

  function handleNextPage() {
    if (!pagination?.nextCursor) return;
    // Push current prev cursor to stack for back navigation
    if (pagination.prevCursor) {
      setCursorStack((prev) => [...prev, pagination.prevCursor!]);
    } else {
      // First page has no prev cursor, push empty string as marker
      setCursorStack((prev) => [...prev, '']);
    }
    fetchProducts({ pageInfo: pagination.nextCursor });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handlePrevPage() {
    if (cursorStack.length === 0) return;
    const newStack = [...cursorStack];
    const prevCursor = newStack.pop()!;
    setCursorStack(newStack);

    if (prevCursor === '') {
      // Going back to first page (no cursor)
      fetchProducts({ query: searchQuery, status: statusFilter });
    } else {
      fetchProducts({ pageInfo: prevCursor });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Products</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/products/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            + New Product
          </Link>
        </div>
      </div>

      <ProductToolbar
        viewMode={viewMode}
        statusFilter={statusFilter}
        onSearch={handleSearch}
        onStatusChange={handleStatusChange}
        onViewModeChange={handleViewModeChange}
        isLoading={loading}
      />

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-slate-600">Loading products...</p>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <ProductGrid products={products} shopDomain={shopDomain} />
      ) : (
        <ProductTable products={products} shopDomain={shopDomain} />
      )}

      {/* Pagination */}
      {!loading && products.length > 0 && pagination && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-slate-600">
            Showing {products.length} products
            {cursorStack.length > 0 && ` (page ${cursorStack.length + 1})`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={cursorStack.length === 0}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={!pagination.hasNext}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
