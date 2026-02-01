'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { PrivateSeller, PlatformIdentity, SellerType } from '@/types/poster';

const SELLER_TYPES: { value: SellerType; label: string }[] = [
  { value: 'individual', label: 'Individual' },
  { value: 'dealer', label: 'Dealer' },
  { value: 'auction_house', label: 'Auction House' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'bookstore', label: 'Bookstore' },
  { value: 'other', label: 'Other' },
];

export default function SellerDirectoryPage() {
  const [activeTab, setActiveTab] = useState<'sellers' | 'identities'>('sellers');

  // Private Sellers state
  const [sellers, setSellers] = useState<PrivateSeller[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(true);

  // Platform Identities state
  const [identities, setIdentities] = useState<PlatformIdentity[]>([]);
  const [loadingIdentities, setLoadingIdentities] = useState(true);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Seller form state
  const [showSellerForm, setShowSellerForm] = useState(false);
  const [editingSeller, setEditingSeller] = useState<PrivateSeller | null>(null);
  const [sellerFormData, setSellerFormData] = useState({
    name: '',
    sellerType: 'dealer' as SellerType,
    email: '',
    phone: '',
    url: '',
    username: '',
    password: '',
    notes: '',
  });
  const [submittingSeller, setSubmittingSeller] = useState(false);
  const [deletingSeller, setDeletingSeller] = useState<number | null>(null);
  const [showSellerCredentials, setShowSellerCredentials] = useState<number | null>(null);

  // Identity form state
  const [showIdentityForm, setShowIdentityForm] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState<PlatformIdentity | null>(null);
  const [identityFormData, setIdentityFormData] = useState({
    platformName: '',
    platformUsername: '',
    sellerId: null as number | null,
    notes: '',
  });
  const [submittingIdentity, setSubmittingIdentity] = useState(false);
  const [deletingIdentity, setDeletingIdentity] = useState<number | null>(null);

  useEffect(() => {
    fetchSellers();
    fetchIdentities();
  }, []);

  async function fetchSellers() {
    try {
      const res = await fetch('/api/private-sellers?includeIdentities=true');
      if (!res.ok) throw new Error('Failed to fetch sellers');
      const data = await res.json();
      setSellers(data.items);
    } catch (err) {
      setError('Failed to load sellers');
      console.error(err);
    } finally {
      setLoadingSellers(false);
    }
  }

  async function fetchIdentities() {
    try {
      const res = await fetch('/api/platform-identities?includeSeller=true');
      if (!res.ok) throw new Error('Failed to fetch identities');
      const data = await res.json();
      setIdentities(data.items);
    } catch (err) {
      setError('Failed to load platform identities');
      console.error(err);
    } finally {
      setLoadingIdentities(false);
    }
  }

  // Seller form handlers
  function resetSellerForm() {
    setSellerFormData({
      name: '',
      sellerType: 'dealer',
      email: '',
      phone: '',
      url: '',
      username: '',
      password: '',
      notes: '',
    });
    setEditingSeller(null);
    setShowSellerForm(false);
  }

  function startEditSeller(seller: PrivateSeller) {
    setEditingSeller(seller);
    setSellerFormData({
      name: seller.name,
      sellerType: seller.sellerType,
      email: seller.email || '',
      phone: seller.phone || '',
      url: seller.url || '',
      username: seller.username || '',
      password: seller.password || '',
      notes: seller.notes || '',
    });
    setShowSellerForm(true);
  }

  async function handleSubmitSeller(e: React.FormEvent) {
    e.preventDefault();
    if (!sellerFormData.name.trim()) return;

    try {
      setSubmittingSeller(true);
      setError('');
      setSuccess('');

      const body = {
        name: sellerFormData.name.trim(),
        sellerType: sellerFormData.sellerType,
        email: sellerFormData.email.trim() || null,
        phone: sellerFormData.phone.trim() || null,
        url: sellerFormData.url.trim() || null,
        username: sellerFormData.username.trim() || null,
        password: sellerFormData.password || null,
        notes: sellerFormData.notes.trim() || null,
      };

      let res;
      if (editingSeller) {
        res = await fetch(`/api/private-sellers?id=${editingSeller.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/private-sellers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save seller');
      }

      setSuccess(editingSeller ? `"${sellerFormData.name}" updated` : `"${sellerFormData.name}" added`);
      resetSellerForm();
      fetchSellers();
      fetchIdentities(); // Refresh to update linked seller names

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save seller');
    } finally {
      setSubmittingSeller(false);
    }
  }

  async function handleDeleteSeller(seller: PrivateSeller) {
    if (!confirm(`Are you sure you want to delete "${seller.name}"? Platform identities linked to this seller will become unlinked.`)) {
      return;
    }

    try {
      setDeletingSeller(seller.id);
      setError('');
      setSuccess('');

      const res = await fetch(`/api/private-sellers?id=${seller.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete seller');
      }

      setSuccess(`"${seller.name}" deleted`);
      fetchSellers();
      fetchIdentities();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete seller');
    } finally {
      setDeletingSeller(null);
    }
  }

  // Identity form handlers
  function resetIdentityForm() {
    setIdentityFormData({
      platformName: '',
      platformUsername: '',
      sellerId: null,
      notes: '',
    });
    setEditingIdentity(null);
    setShowIdentityForm(false);
  }

  function startEditIdentity(identity: PlatformIdentity) {
    setEditingIdentity(identity);
    setIdentityFormData({
      platformName: identity.platformName,
      platformUsername: identity.platformUsername,
      sellerId: identity.sellerId || null,
      notes: identity.notes || '',
    });
    setShowIdentityForm(true);
  }

  async function handleSubmitIdentity(e: React.FormEvent) {
    e.preventDefault();
    if (!identityFormData.platformName.trim() || !identityFormData.platformUsername.trim()) return;

    try {
      setSubmittingIdentity(true);
      setError('');
      setSuccess('');

      const body = {
        platformName: identityFormData.platformName.trim(),
        platformUsername: identityFormData.platformUsername.trim(),
        sellerId: identityFormData.sellerId,
        notes: identityFormData.notes.trim() || null,
      };

      let res;
      if (editingIdentity) {
        res = await fetch(`/api/platform-identities?id=${editingIdentity.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/platform-identities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save identity');
      }

      setSuccess(editingIdentity
        ? `Identity "${identityFormData.platformUsername}" updated`
        : `Identity "${identityFormData.platformUsername}" added`
      );
      resetIdentityForm();
      fetchIdentities();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save identity');
    } finally {
      setSubmittingIdentity(false);
    }
  }

  async function handleDeleteIdentity(identity: PlatformIdentity) {
    if (!confirm(`Are you sure you want to delete "${identity.platformUsername}" on ${identity.platformName}?`)) {
      return;
    }

    try {
      setDeletingIdentity(identity.id);
      setError('');
      setSuccess('');

      const res = await fetch(`/api/platform-identities?id=${identity.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete identity');
      }

      setSuccess(`Identity deleted`);
      fetchIdentities();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete identity');
    } finally {
      setDeletingIdentity(null);
    }
  }

  async function linkIdentityToSeller(identityId: number, sellerId: number | null) {
    try {
      setError('');
      const res = await fetch(`/api/platform-identities?id=${identityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to link identity');
      }

      setSuccess(sellerId ? 'Identity linked to seller' : 'Identity unlinked');
      fetchIdentities();
      fetchSellers();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link identity');
    }
  }

  const unlinkedIdentities = identities.filter(i => !i.sellerId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Seller Directory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage private sellers and link platform usernames to real identities.
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

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('sellers')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sellers'
                ? 'border-violet-500 text-violet-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Private Sellers
            <span className="ml-2 bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">
              {sellers.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('identities')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'identities'
                ? 'border-violet-500 text-violet-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Platform Identities
            <span className="ml-2 bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">
              {identities.length}
            </span>
            {unlinkedIdentities.length > 0 && (
              <span className="ml-1 bg-amber-100 text-amber-700 py-0.5 px-2 rounded-full text-xs">
                {unlinkedIdentities.length} unlinked
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Private Sellers Tab */}
      {activeTab === 'sellers' && (
        <>
          {/* Seller Form */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingSeller ? `Edit "${editingSeller.name}"` : 'Add Private Seller'}
              </h2>
              {!showSellerForm && (
                <button
                  onClick={() => setShowSellerForm(true)}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm"
                >
                  + Add Seller
                </button>
              )}
            </div>

            {showSellerForm && (
              <form onSubmit={handleSubmitSeller} className="space-y-4" autoComplete="off">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={sellerFormData.name}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, name: e.target.value })}
                      placeholder="Business or person name"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Type
                    </label>
                    <select
                      value={sellerFormData.sellerType}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, sellerType: e.target.value as SellerType })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    >
                      {SELLER_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={sellerFormData.email}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, email: e.target.value })}
                      placeholder="contact@example.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={sellerFormData.phone}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={sellerFormData.url}
                    onChange={(e) => setSellerFormData({ ...sellerFormData, url: e.target.value })}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Login Username
                    </label>
                    <input
                      type="text"
                      value={sellerFormData.username}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, username: e.target.value })}
                      placeholder="For their website login"
                      autoComplete="new-password"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Login Password
                    </label>
                    <input
                      type="password"
                      value={sellerFormData.password}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, password: e.target.value })}
                      placeholder="For their website login"
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
                    value={sellerFormData.notes}
                    onChange={(e) => setSellerFormData({ ...sellerFormData, notes: e.target.value })}
                    placeholder="Any additional notes..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submittingSeller || !sellerFormData.name.trim()}
                    className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
                  >
                    {submittingSeller ? 'Saving...' : editingSeller ? 'Update Seller' : 'Add Seller'}
                  </button>
                  <button
                    type="button"
                    onClick={resetSellerForm}
                    className="px-6 py-2 text-slate-600 hover:text-slate-900 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Sellers List */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">All Private Sellers</h2>
            </div>

            {loadingSellers ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600"></div>
              </div>
            ) : sellers.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                No sellers yet. Add your first seller above.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {sellers.map((seller) => (
                  <div key={seller.id} className="px-4 py-3 hover:bg-slate-50 group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-900">{seller.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                            {SELLER_TYPES.find(t => t.value === seller.sellerType)?.label || seller.sellerType}
                          </span>
                          {(seller.username || seller.password) && (
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                              Has Credentials
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-500 mt-1 space-y-0.5">
                          {seller.email && <div>Email: {seller.email}</div>}
                          {seller.phone && <div>Phone: {seller.phone}</div>}
                          {seller.url && (
                            <div>
                              <a href={seller.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {seller.url}
                              </a>
                            </div>
                          )}
                        </div>
                        {seller.platformIdentities && seller.platformIdentities.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {seller.platformIdentities.map(identity => (
                              <span key={identity.id} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                {identity.platformName}: {identity.platformUsername}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition ml-4">
                        {(seller.username || seller.password) && (
                          <button
                            onClick={() => setShowSellerCredentials(showSellerCredentials === seller.id ? null : seller.id)}
                            className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1 rounded transition"
                          >
                            {showSellerCredentials === seller.id ? 'Hide' : 'Show'}
                          </button>
                        )}
                        <button
                          onClick={() => startEditSeller(seller)}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSeller(seller)}
                          disabled={deletingSeller === seller.id}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1 rounded transition disabled:opacity-50"
                        >
                          {deletingSeller === seller.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                    {showSellerCredentials === seller.id && (seller.username || seller.password) && (
                      <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200 text-sm">
                        {seller.username && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600">Username:</span>
                            <span className="font-mono text-slate-900">{seller.username}</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(seller.username!)}
                              className="text-xs text-amber-600 hover:underline"
                            >
                              Copy
                            </button>
                          </div>
                        )}
                        {seller.password && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-slate-600">Password:</span>
                            <span className="font-mono text-slate-900">{seller.password}</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(seller.password!)}
                              className="text-xs text-amber-600 hover:underline"
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
        </>
      )}

      {/* Platform Identities Tab */}
      {activeTab === 'identities' && (
        <>
          {/* Identity Form */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingIdentity ? `Edit "${editingIdentity.platformUsername}"` : 'Add Platform Identity'}
              </h2>
              {!showIdentityForm && (
                <button
                  onClick={() => setShowIdentityForm(true)}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm"
                >
                  + Add Identity
                </button>
              )}
            </div>

            {showIdentityForm && (
              <form onSubmit={handleSubmitIdentity} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Platform *
                    </label>
                    <input
                      type="text"
                      value={identityFormData.platformName}
                      onChange={(e) => setIdentityFormData({ ...identityFormData, platformName: e.target.value })}
                      placeholder="e.g., eBay, Invaluable"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={identityFormData.platformUsername}
                      onChange={(e) => setIdentityFormData({ ...identityFormData, platformUsername: e.target.value })}
                      placeholder="vintageposterking"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Link to Seller
                  </label>
                  <select
                    value={identityFormData.sellerId || ''}
                    onChange={(e) => setIdentityFormData({
                      ...identityFormData,
                      sellerId: e.target.value ? parseInt(e.target.value) : null
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                  >
                    <option value="">-- Not linked --</option>
                    {sellers.map(seller => (
                      <option key={seller.id} value={seller.id}>{seller.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Link this username to a real seller when you discover their identity
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={identityFormData.notes}
                    onChange={(e) => setIdentityFormData({ ...identityFormData, notes: e.target.value })}
                    placeholder="Any notes about this identity..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submittingIdentity || !identityFormData.platformName.trim() || !identityFormData.platformUsername.trim()}
                    className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
                  >
                    {submittingIdentity ? 'Saving...' : editingIdentity ? 'Update Identity' : 'Add Identity'}
                  </button>
                  <button
                    type="button"
                    onClick={resetIdentityForm}
                    className="px-6 py-2 text-slate-600 hover:text-slate-900 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Unlinked Identities Alert */}
          {unlinkedIdentities.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800 mb-2">
                {unlinkedIdentities.length} Unlinked {unlinkedIdentities.length === 1 ? 'Identity' : 'Identities'}
              </h3>
              <p className="text-sm text-amber-700 mb-3">
                These platform usernames aren't linked to a seller yet. Link them when you discover who they are.
              </p>
              <div className="flex flex-wrap gap-2">
                {unlinkedIdentities.slice(0, 10).map(identity => (
                  <span key={identity.id} className="text-xs px-2 py-1 bg-white border border-amber-300 text-amber-800 rounded">
                    {identity.platformName}: {identity.platformUsername}
                  </span>
                ))}
                {unlinkedIdentities.length > 10 && (
                  <span className="text-xs text-amber-600">+{unlinkedIdentities.length - 10} more</span>
                )}
              </div>
            </div>
          )}

          {/* Identities List */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">All Platform Identities</h2>
            </div>

            {loadingIdentities ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600"></div>
              </div>
            ) : identities.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                No platform identities yet. They will be created automatically from Shopify imports.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {identities.map((identity) => (
                  <div key={identity.id} className="px-4 py-3 hover:bg-slate-50 group">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                            {identity.platformName}
                          </span>
                          <span className="font-medium text-slate-900">{identity.platformUsername}</span>
                          {identity.seller ? (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                              → {identity.seller.name}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                              Unlinked
                            </span>
                          )}
                        </div>
                        {identity.notes && (
                          <p className="text-sm text-slate-500 mt-1">{identity.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition ml-4">
                        {!identity.sellerId && sellers.length > 0 && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                linkIdentityToSeller(identity.id, parseInt(e.target.value));
                              }
                            }}
                            value=""
                            className="text-xs border border-slate-200 rounded px-2 py-1"
                          >
                            <option value="">Link to...</option>
                            {sellers.map(seller => (
                              <option key={seller.id} value={seller.id}>{seller.name}</option>
                            ))}
                          </select>
                        )}
                        {identity.sellerId && (
                          <button
                            onClick={() => linkIdentityToSeller(identity.id, null)}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded transition"
                          >
                            Unlink
                          </button>
                        )}
                        <button
                          onClick={() => startEditIdentity(identity)}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteIdentity(identity)}
                          disabled={deletingIdentity === identity.id}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1 rounded transition disabled:opacity-50"
                        >
                          {deletingIdentity === identity.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">About the Seller Directory</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>- <strong>Private Sellers</strong> are actual people or businesses (dealers, auction houses, galleries)</li>
          <li>- <strong>Platform Identities</strong> are usernames on platforms (eBay, Invaluable, etc.)</li>
          <li>- One seller can have multiple platform identities (same person on different platforms)</li>
          <li>- Identities start unlinked and can be linked to a seller when you discover who they are</li>
          <li>- Platform identities are auto-created from Shopify imports when seller name looks like a username</li>
        </ul>
      </div>
    </div>
  );
}
