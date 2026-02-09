'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { PlatformType } from '@/types/poster';

interface Platform {
  id: number;
  name: string;
  url: string | null;
  searchUrlTemplate: string | null;
  searchSoldUrlTemplate: string | null;
  platformType: PlatformType;
  isAcquisitionPlatform: boolean;
  isResearchSite: boolean;
  canResearchPrices: boolean;
  requiresSubscription: boolean;
  username: string | null;
  password: string | null;
  displayOrder: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PLATFORM_TYPES: { value: PlatformType; label: string; description: string }[] = [
  { value: 'marketplace', label: 'Marketplace', description: 'Online platforms connecting buyers/sellers (eBay, Invaluable)' },
  { value: 'venue', label: 'Venue', description: 'Physical locations (Rose Bowl, flea markets, antique malls)' },
  { value: 'aggregator', label: 'Aggregator', description: 'Price databases and archives (WorthPoint)' },
  { value: 'direct', label: 'Direct', description: 'Bought directly from seller, no platform' },
];

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filter state
  const [filterType, setFilterType] = useState<PlatformType | ''>('');
  const [showAcquisitionOnly, setShowAcquisitionOnly] = useState(false);
  const [showResearchOnly, setShowResearchOnly] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    searchUrlTemplate: '',
    searchSoldUrlTemplate: '',
    platformType: 'marketplace' as PlatformType,
    isAcquisitionPlatform: true,
    isResearchSite: false,
    canResearchPrices: false,
    requiresSubscription: false,
    username: '',
    password: '',
    displayOrder: 0,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showCredentials, setShowCredentials] = useState<number | null>(null);

  useEffect(() => {
    fetchPlatforms();
  }, []);

  async function fetchPlatforms() {
    try {
      setError('');
      const res = await fetch('/api/platforms');
      if (!res.ok) throw new Error('Failed to fetch platforms');
      const data = await res.json();
      setPlatforms(data.items);
    } catch (err) {
      setError('Failed to load platforms');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      url: '',
      searchUrlTemplate: '',
      searchSoldUrlTemplate: '',
      platformType: 'marketplace',
      isAcquisitionPlatform: true,
      isResearchSite: false,
      canResearchPrices: false,
      requiresSubscription: false,
      username: '',
      password: '',
      displayOrder: 0,
      notes: '',
    });
    setEditingPlatform(null);
    setShowForm(false);
  }

  function startEdit(platform: Platform) {
    setEditingPlatform(platform);
    setFormData({
      name: platform.name,
      url: platform.url || '',
      searchUrlTemplate: platform.searchUrlTemplate || '',
      searchSoldUrlTemplate: platform.searchSoldUrlTemplate || '',
      platformType: platform.platformType || 'marketplace',
      isAcquisitionPlatform: platform.isAcquisitionPlatform,
      isResearchSite: platform.isResearchSite,
      canResearchPrices: platform.canResearchPrices,
      requiresSubscription: platform.requiresSubscription,
      username: platform.username || '',
      password: platform.password || '',
      displayOrder: platform.displayOrder || 0,
      notes: platform.notes || '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const body = {
        name: formData.name.trim(),
        url: formData.url.trim() || null,
        searchUrlTemplate: formData.searchUrlTemplate.trim() || null,
        searchSoldUrlTemplate: formData.searchSoldUrlTemplate.trim() || null,
        platformType: formData.platformType,
        isAcquisitionPlatform: formData.isAcquisitionPlatform,
        isResearchSite: formData.isResearchSite,
        canResearchPrices: formData.canResearchPrices,
        requiresSubscription: formData.requiresSubscription,
        username: formData.username.trim() || null,
        password: formData.password || null,
        displayOrder: formData.displayOrder || 0,
        notes: formData.notes.trim() || null,
      };

      let res;
      if (editingPlatform) {
        res = await fetch(`/api/platforms?id=${editingPlatform.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/platforms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save platform');
      }

      setSuccess(editingPlatform ? `"${formData.name}" updated` : `"${formData.name}" added`);
      resetForm();
      fetchPlatforms();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save platform');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(platform: Platform) {
    if (!confirm(`Are you sure you want to delete "${platform.name}"?`)) {
      return;
    }

    try {
      setDeleting(platform.id);
      setError('');
      setSuccess('');

      const res = await fetch(`/api/platforms?id=${platform.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete platform');
      }

      setSuccess(`"${platform.name}" deleted`);
      fetchPlatforms();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete platform');
    } finally {
      setDeleting(null);
    }
  }

  // Filter platforms
  const filteredPlatforms = platforms.filter(p => {
    if (filterType && p.platformType !== filterType) return false;
    if (showAcquisitionOnly && !p.isAcquisitionPlatform) return false;
    if (showResearchOnly && !p.canResearchPrices) return false;
    return true;
  });

  const getPlatformTypeBadgeColor = (type: PlatformType) => {
    switch (type) {
      case 'marketplace': return 'bg-blue-100 text-blue-700';
      case 'venue': return 'bg-amber-100 text-amber-700';
      case 'aggregator': return 'bg-violet-100 text-violet-700';
      case 'direct': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Database</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage platforms (WHERE you buy) - marketplaces, venues, and aggregators.
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

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as PlatformType | '')}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
            >
              <option value="">All Types</option>
              {PLATFORM_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAcquisitionOnly}
                onChange={(e) => setShowAcquisitionOnly(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Acquisition Only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showResearchOnly}
                onChange={(e) => setShowResearchOnly(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Price Research Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingPlatform ? `Edit "${editingPlatform.name}"` : 'Add Platform'}
          </h2>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm"
            >
              + Add Platform
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Platform Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., eBay, Rose Bowl, WorthPoint"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Platform Type *
                </label>
                <select
                  value={formData.platformType}
                  onChange={(e) => setFormData({ ...formData, platformType: e.target.value as PlatformType })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                >
                  {PLATFORM_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {PLATFORM_TYPES.find(t => t.value === formData.platformType)?.description}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Lower numbers appear first
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Main URL
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://www.ebay.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Search URL Template
                </label>
                <input
                  type="text"
                  value={formData.searchUrlTemplate}
                  onChange={(e) => setFormData({ ...formData, searchUrlTemplate: e.target.value })}
                  placeholder="https://ebay.com/sch/i.html?_nkw={query}"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use {'{query}'} as placeholder for search terms
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Sold/Completed Search URL Template
                <span className="text-xs text-slate-500 ml-1">(for price research)</span>
              </label>
              <input
                type="text"
                value={formData.searchSoldUrlTemplate}
                onChange={(e) => setFormData({ ...formData, searchSoldUrlTemplate: e.target.value })}
                placeholder="https://ebay.com/sch/i.html?_nkw={query}&LH_Complete=1&LH_Sold=1"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                URL template to search for sold items - used for valuation research
              </p>
            </div>

            {/* Purpose checkboxes */}
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-slate-700 mb-2">Platform Purpose:</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isAcquisitionPlatform}
                    onChange={(e) => setFormData({ ...formData, isAcquisitionPlatform: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Acquisition Platform</span>
                  <span className="text-xs text-slate-500">(syncs to Shopify as "Source")</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canResearchPrices}
                    onChange={(e) => setFormData({ ...formData, canResearchPrices: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700">Can Research Prices</span>
                  <span className="text-xs text-slate-500">(shows in valuation research)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isResearchSite}
                    onChange={(e) => setFormData({ ...formData, isResearchSite: e.target.checked })}
                    className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500"
                  />
                  <span className="text-sm text-slate-700">Research Site (legacy)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requiresSubscription}
                    onChange={(e) => setFormData({ ...formData, requiresSubscription: e.target.checked })}
                    className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                  />
                  <span className="text-sm text-slate-700">Requires Subscription</span>
                </label>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Login username/email"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Login password"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes about this platform..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting || !formData.name.trim()}
                className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Saving...' : editingPlatform ? 'Update Platform' : 'Add Platform'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 text-slate-600 hover:text-slate-900 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Platforms List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            All Platforms
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({filteredPlatforms.length} of {platforms.length})
            </span>
          </h2>
        </div>

        {filteredPlatforms.length === 0 ? (
          <p className="text-slate-500 text-center py-8">
            {platforms.length === 0
              ? 'No platforms yet. Add your first platform above.'
              : 'No platforms match your filters.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPlatforms.map((platform) => (
              <div
                key={platform.id}
                className="px-4 py-3 hover:bg-slate-50 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900">{platform.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${getPlatformTypeBadgeColor(platform.platformType)}`}>
                        {PLATFORM_TYPES.find(t => t.value === platform.platformType)?.label || platform.platformType}
                      </span>
                      {platform.isAcquisitionPlatform && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                          Acquisition
                        </span>
                      )}
                      {platform.canResearchPrices && (
                        <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                          Price Research
                        </span>
                      )}
                      {platform.requiresSubscription && (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                          Subscription
                        </span>
                      )}
                      {(platform.username || platform.password) && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                          Has Credentials
                        </span>
                      )}
                    </div>
                    {platform.url && (
                      <a
                        href={platform.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline truncate block mt-0.5"
                      >
                        {platform.url}
                      </a>
                    )}
                    {platform.searchUrlTemplate && (
                      <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                        Search: {platform.searchUrlTemplate}
                      </p>
                    )}
                    {platform.searchSoldUrlTemplate && (
                      <p className="text-xs text-emerald-500 font-mono mt-0.5 truncate">
                        Sold: {platform.searchSoldUrlTemplate}
                      </p>
                    )}
                    {platform.notes && (
                      <p className="text-sm text-slate-500 mt-0.5">{platform.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                    {(platform.username || platform.password) && (
                      <button
                        onClick={() => setShowCredentials(showCredentials === platform.id ? null : platform.id)}
                        className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded transition"
                      >
                        {showCredentials === platform.id ? 'Hide' : 'Show'}
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(platform)}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(platform)}
                      disabled={deleting === platform.id}
                      className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1 rounded transition disabled:opacity-50"
                    >
                      {deleting === platform.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
                {showCredentials === platform.id && (platform.username || platform.password) && (
                  <div className="mt-2 p-2 bg-green-50 rounded border border-green-200 text-sm">
                    {platform.username && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">Username:</span>
                        <span className="font-mono text-slate-900">{platform.username}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(platform.username!)}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                    {platform.password && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-slate-600">Password:</span>
                        <span className="font-mono text-slate-900">{platform.password}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(platform.password!)}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">About the Platform Database</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>- <strong>Platforms</strong> = WHERE you buy (marketplaces, venues, aggregators)</li>
          <li>- <strong>Marketplace</strong>: Online platforms like eBay, Invaluable, Live Auctioneers</li>
          <li>- <strong>Venue</strong>: Physical locations like Rose Bowl, flea markets, antique malls</li>
          <li>- <strong>Aggregator</strong>: Price databases like WorthPoint</li>
          <li>- <strong>Direct</strong>: Bought directly from seller, no platform intermediary</li>
          <li>- <strong>Acquisition Platform</strong>: Syncs to Shopify as "Source" dropdown</li>
          <li>- <strong>Can Research Prices</strong>: Shows in valuation research for pricing</li>
          <li>- <strong>Sold Search URL</strong>: Template for searching completed/sold listings</li>
        </ul>
      </div>
    </div>
  );
}
