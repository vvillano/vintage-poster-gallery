'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface ListStatus {
  pmAppCount: number;
  localCount: number;
  onlyInPMApp: number;
  onlyInLocal: number;
  inBoth: number;
  lastSynced: string | null;
  onlyInPMAppItems?: string[];
  onlyInLocalItems?: string[];
}

interface SyncStatus {
  ok: boolean;
  configured: boolean;
  config?: {
    baseUrl: string;
    shop: string;
  };
  error?: string;
  lists?: Record<string, ListStatus>;
  summary?: {
    totalPMApp: number;
    totalLocal: number;
    totalOnlyInPMApp: number;
    totalOnlyInLocal: number;
    needsPull: boolean;
    needsPush: boolean;
  };
  customLists?: Array<{
    id: string;
    title: string;
    type: string;
    count: number;
  }>;
}

interface PullResult {
  listType: string;
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const LIST_TYPE_LABELS: Record<string, string> = {
  sources: 'Sources → Platforms',
  artists: 'Artists',
  medium: 'Medium → Media Types',
  colors: 'Colors',
  internalTags: 'Internal Tags',
  locations: 'Locations',
  countries: 'Countries',
  otherTags: 'Available Tags',
  sellers: 'Sellers',
};

export default function PMSyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState<string | null>(null);
  const [pullResults, setPullResults] = useState<PullResult[] | null>(null);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  function toggleRow(listType: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(listType)) {
        next.delete(listType);
      } else {
        next.add(listType);
      }
      return next;
    });
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/pm-app/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setError('Failed to fetch sync status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePull(listType: string) {
    setPulling(listType);
    setPullResults(null);
    setError('');

    try {
      const res = await fetch('/api/pm-app/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listTypes: listType === 'all' ? ['all'] : [listType],
          mode: 'add-only',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to pull');
      }

      setPullResults(data.results);
      // Refresh status after pull
      fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull from PM App');
    } finally {
      setPulling(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-slate-200 rounded w-2/3 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/settings" className="text-slate-500 hover:text-slate-700">
            Settings
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-900 font-medium">PM App Sync</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">PM App Sync</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sync managed lists between Research App and PM App (Product Management).
        </p>
      </div>

      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Connection Status</h2>

        {!status?.configured ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-800 font-medium">PM App API Key Not Configured</p>
            <p className="text-sm text-amber-700 mt-1">
              Add <code className="bg-amber-100 px-1 rounded">PM_APP_API_KEY</code> to your
              environment variables to enable sync.
            </p>
          </div>
        ) : status.error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Connection Error</p>
            <p className="text-sm text-red-700 mt-1">{status.error}</p>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Connected to PM App
            </p>
            <p className="text-sm text-green-700 mt-1">
              Shop: {status.config?.shop}
            </p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Pull Results */}
      {pullResults && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-900 mb-2">Pull Results</h3>
          <div className="space-y-2">
            {pullResults.map((result) => (
              <div key={result.listType} className="text-sm">
                <span className="font-medium">{LIST_TYPE_LABELS[result.listType] || result.listType}:</span>
                <span className="ml-2 text-green-700">{result.created} created</span>
                <span className="ml-2 text-slate-500">{result.skipped} skipped</span>
                {result.failed > 0 && (
                  <span className="ml-2 text-red-600">{result.failed} failed</span>
                )}
                {result.errors && result.errors.length > 0 && (
                  <div className="mt-1 ml-4 text-xs text-red-500">
                    {result.errors.map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setPullResults(null)}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Actions */}
      {status?.configured && !status.error && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Bulk Actions</h2>
          <div className="flex gap-4">
            <button
              onClick={() => handlePull('all')}
              disabled={pulling !== null}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pulling === 'all' ? 'Pulling...' : 'Pull All from PM App'}
            </button>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              Refresh Status
            </button>
          </div>
          {status.summary && (
            <p className="text-sm text-slate-500 mt-3">
              {status.summary.totalOnlyInPMApp > 0
                ? `${status.summary.totalOnlyInPMApp} items available to pull from PM App`
                : 'All PM App items are already synced'}
            </p>
          )}
        </div>
      )}

      {/* List Status Table */}
      {status?.lists && (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Sync Status by List</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    List Type
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                    PM App
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Local
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                    To Pull
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                    To Push
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {Object.entries(status.lists).map(([listType, listStatus]) => {
                  const isExpanded = expandedRows.has(listType);
                  const hasDifferences = listStatus.onlyInPMApp > 0 || listStatus.onlyInLocal > 0;

                  return (
                    <React.Fragment key={listType}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {hasDifferences && (
                              <button
                                onClick={() => toggleRow(listType)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            )}
                            <span className="text-sm font-medium text-slate-900">
                              {LIST_TYPE_LABELS[listType] || listType}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-sm text-slate-700">{listStatus.pmAppCount}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-sm text-slate-700">{listStatus.localCount}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {listStatus.onlyInPMApp > 0 ? (
                            <button
                              onClick={() => toggleRow(listType)}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                            >
                              +{listStatus.onlyInPMApp}
                            </button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {listStatus.onlyInLocal > 0 ? (
                            <button
                              onClick={() => toggleRow(listType)}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200"
                            >
                              +{listStatus.onlyInLocal}
                            </button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handlePull(listType)}
                            disabled={pulling !== null || listStatus.onlyInPMApp === 0}
                            className="text-sm text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 disabled:cursor-not-allowed"
                          >
                            {pulling === listType ? 'Pulling...' : 'Pull'}
                          </button>
                        </td>
                      </tr>
                      {/* Expanded details row */}
                      {isExpanded && hasDifferences && (
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="grid grid-cols-2 gap-6">
                              {/* Items to Pull (only in PM App) */}
                              <div>
                                <h4 className="text-sm font-medium text-blue-800 mb-2">
                                  To Pull (in PM App, not local): {listStatus.onlyInPMApp}
                                </h4>
                                {listStatus.onlyInPMAppItems && listStatus.onlyInPMAppItems.length > 0 ? (
                                  <ul className="text-sm text-slate-600 space-y-1 max-h-48 overflow-y-auto">
                                    {listStatus.onlyInPMAppItems.map((item, i) => (
                                      <li key={i} className="flex items-center gap-2">
                                        <span className="text-blue-500">+</span>
                                        {item}
                                      </li>
                                    ))}
                                    {listStatus.onlyInPMApp > 50 && (
                                      <li className="text-slate-400 italic">
                                        ...and {listStatus.onlyInPMApp - 50} more
                                      </li>
                                    )}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-slate-400">None</p>
                                )}
                              </div>
                              {/* Items to Push (only in Local) */}
                              <div>
                                <h4 className="text-sm font-medium text-amber-800 mb-2">
                                  To Push (in local, not PM App): {listStatus.onlyInLocal}
                                </h4>
                                {listStatus.onlyInLocalItems && listStatus.onlyInLocalItems.length > 0 ? (
                                  <ul className="text-sm text-slate-600 space-y-1 max-h-48 overflow-y-auto">
                                    {listStatus.onlyInLocalItems.map((item, i) => (
                                      <li key={i} className="flex items-center gap-2">
                                        <span className="text-amber-500">→</span>
                                        {item}
                                      </li>
                                    ))}
                                    {listStatus.onlyInLocal > 50 && (
                                      <li className="text-slate-400 italic">
                                        ...and {listStatus.onlyInLocal - 50} more
                                      </li>
                                    )}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-slate-400">None</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Custom Lists */}
      {status?.customLists && status.customLists.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">PM App Custom Lists</h2>
          <p className="text-sm text-slate-500 mb-4">
            These custom lists exist in PM App but don't have a direct mapping in Research App yet.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {status.customLists.map((list) => (
              <div
                key={list.id}
                className="border border-slate-200 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{list.title}</span>
                  <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                    {list.type}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{list.count} values</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-slate-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">How Sync Works</h2>
        <ul className="text-sm text-slate-600 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-indigo-600 mt-0.5">•</span>
            <span>
              <strong>Pull:</strong> Fetches items from PM App and creates them locally if they don't
              exist. Matching is case-insensitive.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-600 mt-0.5">•</span>
            <span>
              <strong>Push:</strong> Creates Shopify metaobjects that PM App can read. (Not yet
              fully implemented)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-600 mt-0.5">•</span>
            <span>
              <strong>Sources</strong> from PM App map to <strong>Platforms</strong> in Research App
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-600 mt-0.5">•</span>
            <span>
              <strong>Medium</strong> from PM App maps to <strong>Media Types</strong> in Research
              App
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
