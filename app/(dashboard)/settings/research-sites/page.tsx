'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { ResearchSite } from '@/types/poster';

export default function ResearchSitesPage() {
  const [sites, setSites] = useState<ResearchSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingSite, setEditingSite] = useState<ResearchSite | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    urlTemplate: '',
    requiresSubscription: false,
    username: '',
    password: '',
    displayOrder: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetchSites();
  }, []);

  async function fetchSites() {
    try {
      setError('');
      const res = await fetch('/api/research-sites');
      if (!res.ok) throw new Error('Failed to fetch research sites');
      const data = await res.json();
      setSites(data.sites);
    } catch (err) {
      setError('Failed to load research sites');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      urlTemplate: '',
      requiresSubscription: false,
      username: '',
      password: '',
      displayOrder: 0,
    });
    setEditingSite(null);
    setShowForm(false);
  }

  function startEdit(site: ResearchSite) {
    setEditingSite(site);
    setFormData({
      name: site.name,
      urlTemplate: site.urlTemplate,
      requiresSubscription: site.requiresSubscription,
      username: site.username || '',
      password: site.password || '',
      displayOrder: site.displayOrder,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.urlTemplate.trim()) return;

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const body = {
        ...formData,
        name: formData.name.trim(),
        urlTemplate: formData.urlTemplate.trim(),
        username: formData.username.trim() || null,
        password: formData.password || null,
      };

      let res;
      if (editingSite) {
        res = await fetch(`/api/research-sites/${editingSite.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/research-sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save site');
      }

      setSuccess(editingSite ? `"${formData.name}" updated` : `"${formData.name}" added`);
      resetForm();
      fetchSites();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save site');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(site: ResearchSite) {
    if (!confirm(`Are you sure you want to delete "${site.name}"?`)) {
      return;
    }

    try {
      setDeleting(site.id);
      setError('');
      setSuccess('');

      const res = await fetch(`/api/research-sites/${site.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete site');
      }

      setSuccess(`"${site.name}" deleted`);
      fetchSites();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete site');
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
          <h1 className="text-2xl font-bold text-slate-900">Research Sites</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage price research sites for comparable sales. URLs with {'{search}'} will auto-fill the search query.
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
            {editingSite ? `Edit "${editingSite.name}"` : 'Add New Site'}
          </h2>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm"
            >
              + Add Site
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Site Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Worthpoint"
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
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                URL Template *
              </label>
              <input
                type="text"
                value={formData.urlTemplate}
                onChange={(e) => setFormData({ ...formData, urlTemplate: e.target.value })}
                placeholder="https://example.com/search?q={search}"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Use {'{search}'} as a placeholder for the search query. Leave it out for static links.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requiresSubscription"
                checked={formData.requiresSubscription}
                onChange={(e) => setFormData({ ...formData, requiresSubscription: e.target.checked })}
                className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500"
              />
              <label htmlFor="requiresSubscription" className="text-sm text-slate-700">
                Requires subscription (shown in violet instead of gray)
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Username (optional)
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Login username"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password (optional)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Login password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting || !formData.name.trim() || !formData.urlTemplate.trim()}
                className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Saving...' : editingSite ? 'Update Site' : 'Add Site'}
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

      {/* Sites List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">All Sites</h2>
          <span className="text-sm text-slate-500">{sites.length} sites</span>
        </div>

        {sites.length === 0 ? (
          <p className="text-slate-500 text-center py-8">
            No research sites yet. Add your first site above.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {sites.map((site) => (
              <div
                key={site.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{site.name}</span>
                    {site.requiresSubscription && (
                      <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">
                        Subscription
                      </span>
                    )}
                    {(site.username || site.password) && (
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                        Has Credentials
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 truncate font-mono mt-0.5">
                    {site.urlTemplate}
                  </p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => startEdit(site)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(site)}
                    disabled={deleting === site.id}
                    className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1 rounded transition disabled:opacity-50"
                  >
                    {deleting === site.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Info */}
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
        <h3 className="font-semibold text-violet-800 mb-2">How Research Sites Work</h3>
        <ul className="text-sm text-violet-700 space-y-1">
          <li>- Sites appear on each poster's "Price Research & Sales" section</li>
          <li>- URLs with {'{search}'} automatically fill in the poster's search query</li>
          <li>- Subscription sites show in violet; free sites show in gray</li>
          <li>- Hover over a site button on a poster to see and copy stored credentials</li>
          <li>- Lower display order numbers appear first</li>
        </ul>
      </div>
    </div>
  );
}
