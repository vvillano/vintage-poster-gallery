'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Platform {
  id: number;
  name: string;
  url: string | null;
  searchUrlTemplate: string | null;
  isAcquisitionPlatform: boolean;
  isResearchSite: boolean;
  requiresSubscription: boolean;
  username: string | null;
  password: string | null;
  displayOrder: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    searchUrlTemplate: '',
    isAcquisitionPlatform: false,
    isResearchSite: false,
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
      isAcquisitionPlatform: false,
      isResearchSite: false,
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
      isAcquisitionPlatform: platform.isAcquisitionPlatform,
      isResearchSite: platform.isResearchSite,
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
        isAcquisitionPlatform: formData.isAcquisitionPlatform,
        isResearchSite: formData.isResearchSite,
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
          <h1 className="text-2xl font-bold text-slate-900">Platforms</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage acquisition platforms and price research sites. Configure credentials and search URLs.
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
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Platform Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Invaluable, eBay, WorthPoint"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
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
                  Lower numbers appear first in research buttons
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
                  placeholder="https://www.invaluable.com"
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
                  placeholder="https://invaluable.com/search?query={search}"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use {'{search}'} as placeholder for search terms
                </p>
              </div>
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
                  <span className="text-xs text-slate-500">(syncs to Shopify)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isResearchSite}
                    onChange={(e) => setFormData({ ...formData, isResearchSite: e.target.checked })}
                    className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500"
                  />
                  <span className="text-sm text-slate-700">Research Site</span>
                  <span className="text-xs text-slate-500">(shows in research buttons)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requiresSubscription}
                    onChange={(e) => setFormData({ ...formData, requiresSubscription: e.target.checked })}
                    className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                  />
                  <span className="text-sm text-slate-700">Requires Subscription</span>
                  <span className="text-xs text-slate-500">(displayed differently)</span>
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
          <h2 className="text-lg font-semibold text-slate-900">All Platforms</h2>
          <span className="text-sm text-slate-500">{platforms.length} platforms</span>
        </div>

        {platforms.length === 0 ? (
          <p className="text-slate-500 text-center py-8">
            No platforms yet. Add your first platform above.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {platforms.map((platform) => (
              <div
                key={platform.id}
                className="px-4 py-3 hover:bg-slate-50 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900">{platform.name}</span>
                      {platform.isAcquisitionPlatform && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                          Acquisition
                        </span>
                      )}
                      {platform.isResearchSite && (
                        <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">
                          Research
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
                        {showCredentials === platform.id ? 'Hide' : 'Show'} Credentials
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
        <h3 className="font-semibold text-blue-800 mb-2">About Platforms</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li><strong>Acquisition Platform</strong> - Where you buy posters (eBay, Invaluable, Rose Bowl). Syncs to Shopify as "Source".</li>
          <li><strong>Research Site</strong> - Used for price research. Shows as buttons on poster detail page.</li>
          <li><strong>Requires Subscription</strong> - Paid sites like WorthPoint. Displayed with different styling.</li>
          <li><strong>Search URL Template</strong> - Use {'{search}'} placeholder. Clicking research button opens this URL with poster title.</li>
        </ul>
      </div>
    </div>
  );
}
