'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Poster } from '@/types/poster';
import Link from 'next/link';
import Image from 'next/image';

// Migration banner component
function MigrationBanner() {
  const [pendingMigrations, setPendingMigrations] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check for pending migrations
    fetch('/api/migrate/status')
      .then(res => res.json())
      .then(data => {
        if (data.status) {
          const pending = Object.entries(data.status)
            .filter(([, info]) => !(info as { completed: boolean }).completed)
            .map(([name]) => name);
          setPendingMigrations(pending);
        }
      })
      .catch(() => {
        // Ignore errors - migrations might not be set up yet
      });
  }, []);

  if (dismissed || pendingMigrations.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔧</span>
          <div>
            <h3 className="font-semibold text-amber-800">Database Migrations Available</h3>
            <p className="text-sm text-amber-700 mt-1">
              {pendingMigrations.length} migration{pendingMigrations.length > 1 ? 's' : ''} pending: {pendingMigrations.map(m => m.replace(/-/g, ' ')).join(', ')}
            </p>
            <Link
              href="/settings/migrate"
              className="inline-block mt-2 text-sm font-medium text-amber-800 hover:text-amber-900 underline"
            >
              Run Migrations →
            </Link>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-600 hover:text-amber-800"
          title="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [posters, setPosters] = useState<Poster[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, analyzed: 0, pending: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [skuQuery, setSkuQuery] = useState('');
  const [hoveredPoster, setHoveredPoster] = useState<{ id: number; imageUrl: string; title: string } | null>(null);
  const [previewPos, setPreviewPos] = useState<{ left: number; centerY: number; flipped: boolean } | null>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchData();
    return () => {
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

  // Dismiss hover preview on scroll
  useEffect(() => {
    const dismiss = () => {
      setHoveredPoster(null);
      setPreviewPos(null);
    };
    window.addEventListener('scroll', dismiss, true);
    return () => window.removeEventListener('scroll', dismiss, true);
  }, []);

  const handleMouseEnter = useCallback((poster: Poster, e: React.MouseEvent) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const previewWidth = 384;
    const centerY = rect.top + rect.height / 2;

    // Place to the right of the card; flip left if it would overflow viewport
    let left = rect.right + 10;
    let flipped = false;
    if (left + previewWidth > window.innerWidth) {
      left = rect.left - previewWidth - 10;
      flipped = true;
    }

    setHoveredPoster({
      id: poster.id,
      imageUrl: poster.imageUrl,
      title: poster.title || poster.fileName,
    });
    setPreviewPos({ left, centerY, flipped });
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    const nextEl = e.relatedTarget as Element | null;
    if (nextEl && typeof nextEl.closest === 'function' && nextEl.closest('.hover-preview')) {
      return;
    }
    leaveTimeoutRef.current = setTimeout(() => {
      setHoveredPoster(null);
      setPreviewPos(null);
    }, 50);
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
      {/* Migration notification banner */}
      <MigrationBanner />

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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {posters.map((poster) => (
            <Link
              key={poster.id}
              href={`/poster/${poster.id}`}
              className="bg-white rounded-lg shadow-sm hover:shadow-md hover:ring-2 hover:ring-blue-300 transition-all overflow-hidden"
              onMouseEnter={(e) => handleMouseEnter(poster, e)}
              onMouseLeave={handleMouseLeave}
            >
              <div className="aspect-[3/4] relative bg-slate-100 overflow-hidden">
                <Image
                  src={poster.imageUrl}
                  alt={poster.title || poster.fileName}
                  width={200}
                  height={267}
                  className="object-cover w-full h-full"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                  loading="lazy"
                />
              </div>
              <div className="p-2">
                <h3 className="font-semibold text-xs text-slate-900 line-clamp-1">
                  {poster.title || 'Untitled'}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {poster.artist || 'Unknown Artist'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Floating hover preview (fixed positioning, outside grid) */}
      {hoveredPoster && previewPos && (() => {
        const previewHeight = 512; // approximate max height for w-96 aspect-[3/4]
        const margin = 8;
        const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
        let top = previewPos.centerY - previewHeight / 2;
        top = Math.max(margin, Math.min(top, viewportH - previewHeight - margin));
        const pointerY = Math.max(12, Math.min(previewPos.centerY - top, previewHeight - 12));

        return (
          <div
            className="hover-preview fixed z-[9999] pointer-events-none"
            style={{ top, left: previewPos.left }}
          >
            {/* Pointer arrow */}
            <div
              className={`hover-preview-pointer ${previewPos.flipped ? 'flip' : ''}`}
              style={{ top: pointerY }}
            />
            <div className="w-96 bg-white border border-slate-200 rounded-[5px] shadow-2xl overflow-hidden">
              <div className="aspect-[3/4]">
                <img
                  src={hoveredPoster.imageUrl}
                  alt={hoveredPoster.title}
                  className="w-full h-full object-cover"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
