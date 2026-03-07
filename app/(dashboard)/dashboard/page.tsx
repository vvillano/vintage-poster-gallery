'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface DashboardStats {
  shopify: { active: number; draft: number; archived: number; total: number };
  research: { total: number; analyzed: number; pending: number };
  recentProducts: { id: string; title: string; status: string; updatedAt: string; imageUrl: string | null }[];
  recentResearch: { id: number; title: string; artist: string | null; createdAt: string; imageUrl: string | null }[];
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-700 bg-green-100',
  draft: 'text-yellow-700 bg-yellow-100',
  archived: 'text-slate-500 bg-slate-100',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      })
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error || 'Failed to load dashboard'}</p>
        </div>
      </div>
    );
  }

  const researchPercent = stats.research.total > 0
    ? Math.round((stats.research.analyzed / stats.research.total) * 100)
    : 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of your vintage poster business</p>
      </div>

      {/* 1. Inventory Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="text-3xl font-bold text-blue-600">{stats.shopify.total.toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">Total Products</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="text-3xl font-bold text-green-600">{stats.shopify.active.toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">Active</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="text-3xl font-bold text-yellow-600">{stats.shopify.draft.toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">Draft</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="text-3xl font-bold text-slate-500">{stats.shopify.archived.toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">Archived</div>
        </div>
      </div>

      {/* 2. Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-sm font-medium text-blue-700 transition"
          >
            <span>+</span> Upload Research Item
          </Link>
          <Link
            href="/products/new"
            className="flex items-center gap-2 px-4 py-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-sm font-medium text-green-700 transition"
          >
            <span>+</span> Create Product
          </Link>
          <Link
            href="/import"
            className="flex items-center gap-2 px-4 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg text-sm font-medium text-purple-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Import from Shopify
          </Link>
          <Link
            href="/products"
            className="flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            Browse Products
          </Link>
        </div>
      </div>

      {/* Build Info */}
      {process.env.NEXT_PUBLIC_BUILD_SHA && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-6 flex items-center gap-4 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Latest Build</span>
          <span className="flex items-center gap-1.5">
            <span className="text-slate-400">Commit</span>
            <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono">
              {process.env.NEXT_PUBLIC_BUILD_SHA.slice(0, 7)}
            </code>
          </span>
          {process.env.NEXT_PUBLIC_DEPLOYMENT_ID && (
            <span className="flex items-center gap-1.5">
              <span className="text-slate-400">Deploy</span>
              <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono">
                {process.env.NEXT_PUBLIC_DEPLOYMENT_ID.replace(/^dpl_/, '').slice(0, 9)}
              </code>
            </span>
          )}
          {process.env.NEXT_PUBLIC_BUILD_REF && (
            <span className="text-slate-400">{process.env.NEXT_PUBLIC_BUILD_REF}</span>
          )}
        </div>
      )}

      {/* 3. Research Status + Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Research Status */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Research Status</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Completion</span>
                <span className="font-semibold text-slate-900">{researchPercent}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all"
                  style={{ width: `${researchPercent}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xl font-bold text-blue-600">{stats.research.total}</div>
                <div className="text-xs text-slate-500">Total</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xl font-bold text-green-600">{stats.research.analyzed}</div>
                <div className="text-xs text-slate-500">Analyzed</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xl font-bold text-orange-600">{stats.research.pending}</div>
                <div className="text-xs text-slate-500">Pending</div>
              </div>
            </div>
            <Link
              href="/research"
              className="block text-center text-sm text-blue-600 hover:text-blue-800 font-medium mt-2"
            >
              Go to Research
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Recent Activity</h2>
          <div className="space-y-1 max-h-[280px] overflow-y-auto">
            {stats.recentProducts.map((p) => (
              <Link
                key={`product-${p.id}`}
                href={`/products/${p.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden flex-shrink-0">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt="" width={40} height={40} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">N/A</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{p.title}</p>
                  <p className="text-xs text-slate-400">
                    Product updated {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_COLORS[p.status] || ''}`}>
                  {p.status}
                </span>
              </Link>
            ))}
            {stats.recentResearch.map((r) => (
              <Link
                key={`research-${r.id}`}
                href={`/poster/${r.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden flex-shrink-0">
                  {r.imageUrl ? (
                    <Image src={r.imageUrl} alt="" width={40} height={40} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">N/A</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{r.title}</p>
                  <p className="text-xs text-slate-400">
                    Research item{r.artist ? ` by ${r.artist}` : ''} added {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0">
                  research
                </span>
              </Link>
            ))}
            {stats.recentProducts.length === 0 && stats.recentResearch.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
