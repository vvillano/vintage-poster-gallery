'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { ShopifyProduct } from '@/types/poster';

interface ShopifyProductWithStatus extends ShopifyProduct {
  alreadyImported: boolean;
}

export default function ImportFromShopifyPage() {
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [products, setProducts] = useState<ShopifyProductWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    checkConfiguration();
  }, []);

  useEffect(() => {
    if (configured) {
      fetchProducts();
    }
  }, [configured, searchQuery, statusFilter]);

  async function checkConfiguration() {
    try {
      const res = await fetch('/api/shopify/config');
      const data = await res.json();
      setConfigured(data.configured);
      if (!data.configured) {
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to check Shopify configuration');
      setLoading(false);
    }
  }

  async function fetchProducts() {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '50');

      const res = await fetch(`/api/shopify/products?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch products');
      }

      const data = await res.json();
      setProducts(data.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(productId: string) {
    const newSelected = new Set(selected);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelected(newSelected);
  }

  function selectAll() {
    const importable = products.filter((p) => !p.alreadyImported);
    if (selected.size === importable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(importable.map((p) => p.id)));
    }
  }

  async function handleImport() {
    if (selected.size === 0) return;

    try {
      setImporting(true);
      setError('');
      setSuccess('');

      const res = await fetch('/api/shopify/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopifyProductIds: Array.from(selected),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setSuccess(`Imported ${data.imported} product${data.imported !== 1 ? 's' : ''}`);
      setSelected(new Set());

      // Refresh products to update "already imported" status
      fetchProducts();

      // If only one product imported, navigate to it
      if (data.imported === 1 && data.results[0]?.posterId) {
        setTimeout(() => {
          router.push(`/poster/${data.results[0].posterId}`);
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  // Not configured state
  if (configured === false) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">🔗</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Connect to Shopify</h1>
        <p className="text-slate-600 mb-6">
          To import products, you need to connect your Shopify store first.
        </p>
        <Link
          href="/settings/shopify"
          className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          Connect Shopify Store
        </Link>
      </div>
    );
  }

  // Loading state
  if (configured === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const importableProducts = products.filter((p) => !p.alreadyImported);
  const selectedCount = selected.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import from Shopify</h1>
          <p className="text-sm text-slate-500 mt-1">
            Select products to import for research and analysis
          </p>
        </div>
        <Link
          href="/settings/shopify"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Shopify Settings
        </Link>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={() => fetchProducts()}
            disabled={loading}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Selection Bar */}
      {importableProducts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={selectAll}
              className="text-sm text-green-600 hover:text-green-700"
            >
              {selected.size === importableProducts.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-sm text-slate-500">
              {selectedCount} of {importableProducts.length} selected
            </span>
          </div>
          <button
            onClick={handleImport}
            disabled={importing || selectedCount === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
          >
            {importing ? 'Importing...' : `Import Selected (${selectedCount})`}
          </button>
        </div>
      )}

      {/* Products Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No products found. Try adjusting your search or filters.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {products.map((product) => {
            const isSelected = selected.has(product.id);
            const isImported = product.alreadyImported;
            const firstImage = product.images[0];
            const firstVariant = product.variants[0];

            return (
              <div
                key={product.id}
                onClick={() => !isImported && toggleSelection(product.id)}
                className={`
                  relative border rounded-lg overflow-hidden cursor-pointer transition
                  ${isImported
                    ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                    : isSelected
                      ? 'border-green-500 ring-2 ring-green-200 bg-green-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }
                `}
              >
                {/* Selection checkbox */}
                {!isImported && (
                  <div className="absolute top-2 left-2 z-10">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center
                        ${isSelected
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'bg-white border-slate-300'
                        }
                      `}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                )}

                {/* Imported badge */}
                {isImported && (
                  <div className="absolute top-2 right-2 z-10">
                    <span className="text-xs px-2 py-1 bg-slate-200 text-slate-600 rounded">
                      Imported
                    </span>
                  </div>
                )}

                {/* Image */}
                <div className="aspect-square bg-slate-100 relative">
                  {firstImage ? (
                    <Image
                      src={firstImage.src}
                      alt={product.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      No Image
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="font-medium text-slate-900 text-sm line-clamp-2">
                    {product.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    {firstVariant?.sku && (
                      <span className="truncate">{firstVariant.sku}</span>
                    )}
                    <span
                      className={`
                        px-1.5 py-0.5 rounded
                        ${product.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : product.status === 'draft'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }
                      `}
                    >
                      {product.status}
                    </span>
                  </div>
                  {firstVariant?.price && (
                    <div className="mt-1 text-sm font-medium text-slate-700">
                      ${parseFloat(firstVariant.price).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
