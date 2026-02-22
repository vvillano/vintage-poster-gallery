'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface ShopifyConfigState {
  configured: boolean;
  shopDomain?: string;
  accessToken?: string;
  apiVersion?: string;
  updatedAt?: string;
}

export default function ShopifySettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div></div>}>
      <ShopifySettingsContent />
    </Suspense>
  );
}

function ShopifySettingsContent() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<ShopifyConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{ updated: number; errors: number } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state for OAuth
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    shopDomain: '',
    clientId: '',
    clientSecret: '',
  });

  useEffect(() => {
    fetchConfig();

    // Handle OAuth callback messages
    const errorParam = searchParams.get('error');
    const successParam = searchParams.get('success');

    if (errorParam) {
      setError(errorParam);
      // Clear URL params
      window.history.replaceState({}, '', '/settings/shopify');
    }
    if (successParam) {
      setSuccess(successParam);
      // Clear URL params
      window.history.replaceState({}, '', '/settings/shopify');
      setTimeout(() => setSuccess(''), 5000);
    }
  }, [searchParams]);

  async function fetchConfig() {
    try {
      setError('');
      const res = await fetch('/api/shopify/config');
      if (!res.ok) throw new Error('Failed to fetch configuration');
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      setError('Failed to load configuration');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.shopDomain || !formData.clientId || !formData.clientSecret) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const res = await fetch('/api/shopify/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to initiate OAuth');
      }

      // Redirect to Shopify OAuth authorization page
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate OAuth');
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect from Shopify? This will not affect your imported items.')) {
      return;
    }

    try {
      setError('');
      const res = await fetch('/api/shopify/config', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');

      setSuccess('Disconnected from Shopify');
      setConfig({ configured: false });
      setFormData({ shopDomain: '', clientId: '', clientSecret: '' });

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }

  async function handleTestConnection() {
    try {
      setTesting(true);
      setError('');
      setSuccess('');

      const res = await fetch('/api/shopify/config');
      const data = await res.json();

      if (data.configured) {
        setSuccess('Connection is working');
      } else {
        setError('Not connected to Shopify');
      }

      setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
    } catch (err) {
      setError('Connection test failed');
    } finally {
      setTesting(false);
    }
  }

  async function handleRefreshAll() {
    if (!confirm('This will refresh Shopify data (SKU, title, status, metafields) for all linked items. AI analysis will NOT be affected. Continue?')) {
      return;
    }

    try {
      setRefreshing(true);
      setError('');
      setSuccess('');
      setRefreshResult(null);

      const res = await fetch('/api/shopify/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Refresh failed');
      }

      setRefreshResult({ updated: data.updated, errors: data.errors });
      setSuccess(`Updated ${data.updated} item${data.updated !== 1 ? 's' : ''} from Shopify`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shopify Integration</h1>
          <p className="text-sm text-slate-500 mt-1">
            Connect to Shopify to import products and sync descriptions, tags, and metadata.
          </p>
        </div>
        <Link
          href="/settings"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Back to Settings
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

      {/* Connection Status */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Connection Status</h2>
          {config?.configured && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Connected
            </span>
          )}
          {!config?.configured && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
              Not Connected
            </span>
          )}
        </div>

        {config?.configured && (
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500 w-24">Store:</span>
              <span className="text-sm font-medium text-slate-900">{config.shopDomain}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500 w-24">API Token:</span>
              <span className="text-sm font-mono text-slate-600">{config.accessToken}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500 w-24">API Version:</span>
              <span className="text-sm text-slate-600">{config.apiVersion}</span>
            </div>
            {config.updatedAt && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-500 w-24">Last Updated:</span>
                <span className="text-sm text-slate-600">
                  {new Date(config.updatedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          {config?.configured ? (
            <>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition text-sm"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm"
              >
                {showForm ? 'Cancel' : 'Update Credentials'}
              </button>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Connect to Shopify
            </button>
          )}
        </div>
      </div>

      {/* Connection Form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {config?.configured ? 'Update Credentials' : 'Connect to Shopify'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Shop Domain *
              </label>
              <input
                type="text"
                value={formData.shopDomain}
                onChange={(e) => setFormData({ ...formData, shopDomain: e.target.value })}
                placeholder="yourstore.myshopify.com"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Your Shopify store domain (e.g., yourstore.myshopify.com)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client ID *
              </label>
              <input
                type="text"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                placeholder="ba588d37895fffff200c7aee9962780c"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                From your Dev Dashboard app → Settings → Credentials
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client Secret *
              </label>
              <input
                type="password"
                value={formData.clientSecret}
                onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                placeholder="shpss_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                From your Dev Dashboard app → Settings → Credentials (click reveal)
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !formData.shopDomain || !formData.clientId || !formData.clientSecret}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
              >
                {saving ? 'Redirecting to Shopify...' : 'Connect with Shopify'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 text-slate-600 hover:text-slate-900 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Setup Instructions */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-semibold text-green-800 mb-3">How to Get Your API Credentials</h3>
        <ol className="text-sm text-green-700 space-y-2 list-decimal list-inside">
          <li>Go to the <a href="https://partners.shopify.com" target="_blank" rel="noopener noreferrer" className="underline">Shopify Partners Dashboard</a> or Dev Dashboard</li>
          <li>Click <strong>Apps</strong> → Create or select your app</li>
          <li>Go to <strong>Configuration</strong> in the left sidebar</li>
          <li>Under <strong>URLs</strong>, add the callback URL:
            <code className="block bg-green-100 px-2 py-1 rounded mt-1 text-xs break-all">
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/shopify/oauth/callback
            </code>
          </li>
          <li>Under <strong>Admin API access scopes</strong>, enable:
            <code className="bg-green-100 px-1 rounded">read_products</code>,{' '}
            <code className="bg-green-100 px-1 rounded">write_products</code>,{' '}
            <code className="bg-green-100 px-1 rounded">read_inventory</code>,{' '}
            <code className="bg-green-100 px-1 rounded">write_inventory</code>,{' '}
            <code className="bg-green-100 px-1 rounded">read_metaobjects</code>,{' '}
            <code className="bg-green-100 px-1 rounded">write_metaobjects</code>
          </li>
          <li>Click <strong>Save and release</strong></li>
          <li>Go to <strong>Settings</strong> in the left sidebar</li>
          <li>Copy the <strong>Client ID</strong> and reveal/copy the <strong>Client Secret</strong></li>
        </ol>
      </div>

      {/* What You Can Do */}
      {config?.configured && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="font-semibold text-slate-900 mb-3">What You Can Do</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/import"
              className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              <span className="text-2xl">📥</span>
              <div>
                <h4 className="font-medium text-slate-900">Import from Shopify</h4>
                <p className="text-sm text-slate-500">
                  Browse and import products from your Shopify store
                </p>
              </div>
            </Link>
            <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50">
              <span className="text-2xl">🔄</span>
              <div>
                <h4 className="font-medium text-slate-900">Sync Data</h4>
                <p className="text-sm text-slate-500">
                  Pull/push data from each item&apos;s detail page
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Refresh */}
      {config?.configured && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h3 className="font-semibold text-slate-900 mb-2">Refresh All from Shopify</h3>
          <p className="text-sm text-slate-600 mb-4">
            Update Shopify data for all linked items. This pulls the latest SKU, title, status, price,
            and metafields (artist, dimensions, condition, etc.) from Shopify.
            <span className="font-medium text-slate-700"> AI analysis and descriptions are NOT affected.</span>
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={handleRefreshAll}
              disabled={refreshing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition text-sm flex items-center gap-2"
            >
              {refreshing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Refreshing...
                </>
              ) : (
                <>
                  <span>🔄</span>
                  Refresh All Items
                </>
              )}
            </button>

            {refreshResult && (
              <span className="text-sm text-slate-600">
                {refreshResult.updated} updated
                {refreshResult.errors > 0 && (
                  <span className="text-red-600 ml-2">({refreshResult.errors} errors)</span>
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
