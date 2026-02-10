'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface MigrationConfig {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  successLink?: { href: string; label: string };
}

interface MigrationStatusInfo {
  completed: boolean;
  details?: string;
}

interface SerperStatus {
  configured: boolean;
  provider: string;
  message: string;
  webTestResult?: {
    success: boolean;
    resultCount?: number;
    error?: string;
  };
  lensTestResult?: {
    success: boolean;
    resultCount?: number;
    error?: string;
  };
}

const MIGRATIONS: MigrationConfig[] = [
  // Newest first
  {
    id: 'record-source',
    name: 'Record Source Tracking',
    description: 'Add record_source and expires_at columns for tracking where records come from (Shopify import, direct upload, price research). Enables 30-day auto-cleanup of unlinked research records.',
    endpoint: '/api/migrate/record-source',
  },
  {
    id: 'platforms-sellers',
    name: 'Platforms & Sellers Refactoring',
    description: 'Implements the new acquisition tracking model: Platforms = WHERE you buy (marketplaces, venues, aggregators), Sellers = WHO you buy from (auction houses, dealers, individuals). Adds canResearchPrices to platforms, canResearchAt to sellers, renames dealers to sellers, and seeds common platforms.',
    endpoint: '/api/migrate/platforms-sellers',
    successLink: { href: '/settings/platforms', label: 'Manage Platforms' },
  },
  {
    id: 'dealer-category',
    name: 'Dealer Category Field',
    description: 'Add category field to dealers table for filtering by purpose: dealer (auctions/galleries), research (museums/institutions), or platform (marketplaces). Enables Research vs Valuation mode separation.',
    endpoint: '/api/migrate/dealer-category',
    successLink: { href: '/settings/dealers', label: 'Manage Dealers' },
  },
  {
    id: 'acquisition-tracking',
    name: 'Acquisition Tracking',
    description: 'Add source tracking columns: source_dealer_id (WHO you bought from), acquisition_platform_id (WHERE you bought), dealer_name (for Shopify matching), and platform_type (marketplace, venue, aggregator).',
    endpoint: '/api/migrate/acquisition-tracking',
  },
  {
    id: 'shopify-refresh',
    name: 'Shopify Refresh Fields',
    description: 'Add shopify_reference_images and item_notes columns. Enables pulling reference images from Shopify and storing research-relevant notes separately from internal notes.',
    endpoint: '/api/migrate/shopify-refresh',
  },
  {
    id: 'dealers',
    name: 'Dealer Database',
    description: 'Create dealers table for tracking auction houses, galleries, and specialized dealers. Includes reliability tiers, attribution/pricing weights, specializations, and seller linking.',
    endpoint: '/api/migrate/dealers',
    successLink: { href: '/settings/dealers', label: 'Manage Dealers' },
  },
  {
    id: 'attribution-basis',
    name: 'Attribution Basis Field',
    description: 'Add attribution_basis field to track HOW artist was identified: visible_signature, printed_credit, stylistic_analysis, external_knowledge, or none. Prevents false confidence from knowledge-based attributions.',
    endpoint: '/api/migrate/attribution-basis',
  },
  {
    id: 'product-value-sync',
    name: 'Product Value Sync (Colors)',
    description: 'Add colors managed list and colors field to posters. Enables AI-suggested color identification synced with Shopify.',
    endpoint: '/api/migrate/product-value-sync',
    successLink: { href: '/settings/lists', label: 'Manage Colors' },
  },
  {
    id: 'platform-consolidation',
    name: 'Platform Consolidation',
    description: 'Consolidate Platform Credentials and Research Sites into a unified platforms table. Merges data from both old tables and adds acquisition/research flags.',
    endpoint: '/api/migrate/platform-consolidation',
    successLink: { href: '/settings/platforms', label: 'Manage Platforms' },
  },
  {
    id: 'publication-books',
    name: 'Publications & Books',
    description: 'Add publication confidence fields and create books table for antique print sources. Enables tracking book sources (natural history, atlases, etc.) with author and contributor info.',
    endpoint: '/api/migrate/publication-books',
    successLink: { href: '/settings/lists', label: 'Manage Books' },
  },
  {
    id: 'printer-publisher',
    name: 'Printers & Publishers',
    description: 'Create printers and publishers tables for verification. Enables linking posters to verified printer/publisher records with Wikipedia links.',
    endpoint: '/api/migrate/printer-publisher',
    successLink: { href: '/settings/lists', label: 'Manage Printers & Publishers' },
  },
  {
    id: 'artist-profiles',
    name: 'Artist Profiles & Linking',
    description: 'Add enhanced artist profile fields (Wikipedia URL, bio, image, verified status) and enable poster-to-artist linking for confirmed attributions.',
    endpoint: '/api/migrate/artist-profiles',
    successLink: { href: '/settings/lists', label: 'Manage Artists' },
  },
  {
    id: 'seed-artists',
    name: 'Seed Artists from Shopify',
    description: 'Import all artist names from Shopify catalog into the artists table. Safe to run multiple times (skips duplicates).',
    endpoint: '/api/migrate/seed-artists',
    successLink: { href: '/settings/lists', label: 'View Artists' },
  },
  {
    id: 'artist-verification',
    name: 'Artist Verification Fields',
    description: 'Add enhanced artist identification fields: confidence score (0-100%), signature text, and verification checklist.',
    endpoint: '/api/migrate/artist-verification',
  },
  {
    id: 'managed-lists',
    name: 'Managed Lists',
    description: 'Create tables for Media Types, Artists, Internal Tags, Source Platforms, Locations, and Countries.',
    endpoint: '/api/migrate/managed-lists',
    successLink: { href: '/settings/lists', label: 'Go to Managed Lists' },
  },
];

type MigrationStatus = 'idle' | 'running' | 'success' | 'error';

interface MigrationState {
  status: MigrationStatus;
  results: string[];
  error: string;
}

export default function MigratePage() {
  const [states, setStates] = useState<Record<string, MigrationState>>(() => {
    const initial: Record<string, MigrationState> = {};
    MIGRATIONS.forEach((m) => {
      initial[m.id] = { status: 'idle', results: [], error: '' };
    });
    return initial;
  });
  const [completedStatus, setCompletedStatus] = useState<Record<string, MigrationStatusInfo>>({});
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Serper API status
  const [serperStatus, setSerperStatus] = useState<SerperStatus | null>(null);
  const [loadingSerper, setLoadingSerper] = useState(true);
  const [testingWeb, setTestingWeb] = useState(false);
  const [testingLens, setTestingLens] = useState(false);

  // Check Serper API configuration on mount
  useEffect(() => {
    async function checkSerperStatus() {
      try {
        const res = await fetch('/api/research/search');
        if (res.ok) {
          const data = await res.json();
          setSerperStatus({
            configured: data.configured,
            provider: data.provider || 'serper',
            message: data.message,
          });
        }
      } catch (err) {
        console.error('Failed to check Serper status:', err);
        setSerperStatus({
          configured: false,
          provider: 'serper',
          message: 'Failed to check configuration',
        });
      } finally {
        setLoadingSerper(false);
      }
    }
    checkSerperStatus();
  }, []);

  // Test Serper web search
  async function testWebSearch() {
    setTestingWeb(true);
    try {
      const res = await fetch('/api/research/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'vintage poster',
          maxResults: 5,
        }),
      });
      const data = await res.json();

      if (data.error || (data.errors && data.errors.length > 0)) {
        setSerperStatus(prev => prev ? {
          ...prev,
          webTestResult: {
            success: false,
            error: data.error || data.errors?.[0] || 'Search failed',
          },
        } : null);
      } else {
        setSerperStatus(prev => prev ? {
          ...prev,
          webTestResult: {
            success: true,
            resultCount: data.totalResults || data.results?.length || 0,
          },
        } : null);
      }
    } catch (err) {
      setSerperStatus(prev => prev ? {
        ...prev,
        webTestResult: {
          success: false,
          error: err instanceof Error ? err.message : 'Test failed',
        },
      } : null);
    } finally {
      setTestingWeb(false);
    }
  }

  // Test Serper Lens (visual search) with a sample image
  async function testLensSearch() {
    setTestingLens(true);
    try {
      // Use a public domain test image
      const res = await fetch('/api/research/lens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/VanGogh-starry_night_ballance1.jpg/300px-VanGogh-starry_night_ballance1.jpg',
          includeKnownDealers: false,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setSerperStatus(prev => prev ? {
          ...prev,
          lensTestResult: {
            success: false,
            error: data.error,
          },
        } : null);
      } else {
        setSerperStatus(prev => prev ? {
          ...prev,
          lensTestResult: {
            success: true,
            resultCount: data.totalResults || data.results?.length || 0,
          },
        } : null);
      }
    } catch (err) {
      setSerperStatus(prev => prev ? {
        ...prev,
        lensTestResult: {
          success: false,
          error: err instanceof Error ? err.message : 'Test failed',
        },
      } : null);
    } finally {
      setTestingLens(false);
    }
  }

  // Check which migrations have been completed on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/migrate/status');
        if (res.ok) {
          const data = await res.json();
          setCompletedStatus(data.status || {});
        }
      } catch (err) {
        console.error('Failed to check migration status:', err);
      } finally {
        setLoadingStatus(false);
      }
    }
    checkStatus();
  }, []);

  async function runMigration(migration: MigrationConfig) {
    setStates((prev) => ({
      ...prev,
      [migration.id]: { status: 'running', results: [], error: '' },
    }));

    try {
      const res = await fetch(migration.endpoint, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Migration failed');
      }

      setStates((prev) => ({
        ...prev,
        [migration.id]: {
          status: 'success',
          results: data.results || [],
          error: '',
        },
      }));

      // Refresh completion status after successful migration
      try {
        const statusRes = await fetch('/api/migrate/status');
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setCompletedStatus(statusData.status || {});
        }
      } catch {
        // Ignore status refresh errors
      }
    } catch (err) {
      setStates((prev) => ({
        ...prev,
        [migration.id]: {
          status: 'error',
          results: [],
          error: err instanceof Error ? err.message : 'Migration failed',
        },
      }));
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/settings" className="text-amber-600 hover:text-amber-700">
          ← Back to Settings
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">Database Migrations</h1>

      {/* Serper API Status (Google Search + Lens) */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-lg font-semibold text-slate-900">
            Serper API (Google Search + Lens)
          </h2>
          {!loadingSerper && serperStatus && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
              serperStatus.configured
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {serperStatus.configured ? (
                <>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Configured
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Not Configured
                </>
              )}
            </span>
          )}
        </div>
        <p className="text-slate-600 text-sm mb-3">
          Powers visual-first research workflow: Google Lens for image search + web search for text queries. 10x cheaper than Google CSE with more features.
        </p>

        {loadingSerper ? (
          <div className="text-slate-500 text-sm">Checking configuration...</div>
        ) : serperStatus ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">{serperStatus.message}</p>

            {serperStatus.configured && (
              <div className="space-y-2">
                {/* Web Search Test */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={testWebSearch}
                    disabled={testingWeb}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                  >
                    {testingWeb ? 'Testing...' : 'Test Web Search'}
                  </button>

                  {serperStatus.webTestResult && (
                    <div className={`text-sm ${serperStatus.webTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                      {serperStatus.webTestResult.success ? (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Web search working! Found {serperStatus.webTestResult.resultCount} results
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {serperStatus.webTestResult.error}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Lens (Visual) Search Test */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={testLensSearch}
                    disabled={testingLens}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50"
                  >
                    {testingLens ? 'Testing...' : 'Test Visual Search (Lens)'}
                  </button>

                  {serperStatus.lensTestResult && (
                    <div className={`text-sm ${serperStatus.lensTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                      {serperStatus.lensTestResult.success ? (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Lens working! Found {serperStatus.lensTestResult.resultCount} visual matches
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {serperStatus.lensTestResult.error}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!serperStatus.configured && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-xs">
                <p className="font-medium mb-1">Setup Instructions:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://serper.dev" target="_blank" rel="noopener noreferrer" className="underline">serper.dev</a></li>
                  <li>Sign up for a free account (2,500 free credits)</li>
                  <li>Copy your API key</li>
                  <li>Add to environment: <code className="bg-yellow-100 px-1">SERPER_API_KEY=your_key</code></li>
                </ol>
                <p className="mt-2 text-yellow-700">
                  Pricing: ~$0.30-1.00 per 1,000 searches (10x cheaper than Google CSE)
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        {MIGRATIONS.map((migration) => {
          const state = states[migration.id];
          const completed = completedStatus[migration.id];

          return (
            <div key={migration.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-lg font-semibold text-slate-900">
                  {migration.name}
                </h2>
                {!loadingStatus && completed?.completed && state.status === 'idle' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Completed
                  </span>
                )}
              </div>
              <p className="text-slate-600 text-sm mb-2">{migration.description}</p>
              {!loadingStatus && completed?.completed && completed.details && state.status === 'idle' && (
                <p className="text-xs text-slate-500 mb-4">{completed.details}</p>
              )}
              {!completed?.details && <div className="mb-2" />}

              {state.status === 'idle' && (
                <button
                  onClick={() => runMigration(migration)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm ${
                    completed?.completed
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                >
                  {completed?.completed ? 'Run Again' : 'Run Migration'}
                </button>
              )}

              {state.status === 'running' && (
                <div className="flex items-center gap-3 text-amber-600">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Running migration...
                </div>
              )}

              {state.status === 'success' && (
                <div>
                  <div className="flex items-center gap-2 text-green-600 mb-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="font-medium text-sm">Completed successfully!</span>
                  </div>
                  {state.results.length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-3 mb-3">
                      <ul className="text-xs text-slate-600 space-y-1">
                        {state.results.map((result, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="text-green-500">✓</span> {result}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {migration.successLink && (
                    <Link
                      href={migration.successLink.href}
                      className="text-amber-600 hover:text-amber-700 font-medium text-sm"
                    >
                      {migration.successLink.label} →
                    </Link>
                  )}
                </div>
              )}

              {state.status === 'error' && (
                <div>
                  <div className="flex items-center gap-2 text-red-600 mb-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    <span className="font-medium text-sm">Migration failed</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs mb-3">
                    {state.error}
                  </div>
                  <button
                    onClick={() => runMigration(migration)}
                    className="px-3 py-1.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Maintenance Section */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Maintenance</h2>
        <CleanupExpiredResearch />
      </div>
    </div>
  );
}

// Component for cleanup expired research records
function CleanupExpiredResearch() {
  const [status, setStatus] = useState<'idle' | 'previewing' | 'cleaning' | 'done' | 'error'>('idle');
  const [preview, setPreview] = useState<{ count: number; records: any[] } | null>(null);
  const [result, setResult] = useState<{ deletedCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setStatus('previewing');
    setError(null);
    try {
      const res = await fetch('/api/cleanup/expired-research');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to preview');
      setPreview({ count: data.count, records: data.records || [] });
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }

  async function handleCleanup() {
    setStatus('cleaning');
    setError(null);
    try {
      const res = await fetch('/api/cleanup/expired-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cleanup');
      setResult({ deletedCount: data.deletedCount });
      setPreview(null);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-2">Cleanup Expired Research Records</h3>
      <p className="text-sm text-slate-600 mb-4">
        Delete research records older than 30 days that are not linked to Shopify.
        This includes direct uploads and price research records that were never connected to a product.
      </p>

      <div className="flex gap-3">
        <button
          onClick={handlePreview}
          disabled={status === 'previewing' || status === 'cleaning'}
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 text-sm font-medium"
        >
          {status === 'previewing' ? 'Loading...' : 'Preview'}
        </button>
        {preview && preview.count > 0 && (
          <button
            onClick={handleCleanup}
            disabled={status === 'cleaning'}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
          >
            {status === 'cleaning' ? 'Deleting...' : `Delete ${preview.count} Records`}
          </button>
        )}
      </div>

      {preview && (
        <div className="mt-4">
          {preview.count === 0 ? (
            <p className="text-sm text-green-600">No expired research records found.</p>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-800 mb-2">
                Found {preview.count} expired research record(s):
              </p>
              <ul className="text-xs text-amber-700 space-y-1 max-h-40 overflow-y-auto">
                {preview.records.slice(0, 10).map((r: any) => (
                  <li key={r.id}>
                    #{r.id} - {r.fileName} ({r.recordSource || 'unknown'})
                  </li>
                ))}
                {preview.records.length > 10 && (
                  <li className="text-amber-600">...and {preview.records.length - 10} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {status === 'done' && result && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-700">
            Successfully deleted {result.deletedCount} expired research record(s).
          </p>
        </div>
      )}

      {status === 'error' && error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
