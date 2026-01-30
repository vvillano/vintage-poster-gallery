'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Poster } from '@/types/poster';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const [posters, setPosters] = useState<Poster[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, analyzed: 0, pending: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [skuQuery, setSkuQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [postersRes, statsRes] = await Promise.all([
        fetch('/api/posters'),
        fetch('/api/posters?stats=true'),
      ]);

      if (!postersRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const postersData = await postersRes.json();
      const statsData = await statsRes.json();

      setPosters(postersData.posters || []);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchData();
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/posters?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error('Search failed');

      const data = await res.json();
      setPosters(data.posters || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSkuLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!skuQuery.trim()) return;
    router.push(`/open?sku=${encodeURIComponent(skuQuery.trim())}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <Link
            href="/upload"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition"
          >
            + Upload New Item
          </Link>
        </div>

        {/* Search Bars */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {/* Local Search */}
          <form onSubmit={handleSearch}>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Search Local Items
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Artist, title, technique..."
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <button
                type="submit"
                className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg transition"
              >
                Search
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    fetchData();
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg transition"
                >
                  Clear
                </button>
              )}
            </div>
          </form>

          {/* SKU Lookup */}
          <form onSubmit={handleSkuLookup}>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              Find by SKU (from Shopify)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={skuQuery}
                onChange={(e) => setSkuQuery(e.target.value)}
                placeholder="Enter SKU..."
                className="flex-1 px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
              >
                Find
              </button>
            </div>
          </form>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-slate-600">Total Items</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-green-600">{stats.analyzed}</div>
            <div className="text-sm text-slate-600">Analyzed</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-orange-600">{stats.pending}</div>
            <div className="text-sm text-slate-600">Pending Analysis</div>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      {posters.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-6xl mb-4">🖼️</div>
          <p className="text-slate-600 mb-4 text-lg">
            {searchQuery ? 'No items found matching your search' : 'No items uploaded yet'}
          </p>
          {!searchQuery && (
            <Link
              href="/upload"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Upload Your First Item
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {posters.map((poster) => (
            <Link
              key={poster.id}
              href={`/poster/${poster.id}`}
              className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow overflow-hidden group"
            >
              <div className="aspect-[3/4] relative bg-slate-100 overflow-hidden">
                <img
                  src={poster.imageUrl}
                  alt={poster.title || poster.fileName}
                  className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-slate-900 mb-1 line-clamp-1">
                  {poster.title || 'Untitled'}
                </h3>
                <p className="text-sm text-slate-600 mb-2 line-clamp-1">
                  {poster.artist || 'Unknown Artist'}
                </p>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">
                    {formatDate(poster.uploadDate)}
                  </span>
                  {poster.analysisCompleted ? (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                      ✓ Analyzed
                    </span>
                  ) : (
                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                      ⏳ Pending
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
