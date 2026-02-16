'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type {
  Seller,
  SellerType,
  SellerRegion,
  SellerSpecialization,
} from '@/types/seller';
import {
  SELLER_TYPE_LABELS,
  RELIABILITY_TIERS,
  SPECIALIZATION_LABELS,
  SPECIALIZATION_CATEGORIES,
  getDefaultsForSellerType,
  getSellerTierBadgeColor,
} from '@/types/seller';
import type { PlatformIdentity } from '@/types/poster';
import type { Platform } from '@/types/platform';

const SELLER_TYPES: { value: SellerType; label: string }[] = [
  { value: 'auction_house', label: 'Auction House' },
  { value: 'dealer', label: 'Dealer' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'bookstore', label: 'Bookstore' },
  { value: 'individual', label: 'Individual Seller' },
  { value: 'other', label: 'Other' },
];

const REGIONS: { value: SellerRegion; label: string }[] = [
  { value: 'North America', label: 'North America' },
  { value: 'Europe', label: 'Europe' },
  { value: 'UK', label: 'UK' },
  { value: 'France', label: 'France' },
  { value: 'Germany', label: 'Germany' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Japan', label: 'Japan' },
  { value: 'Asia', label: 'Asia' },
  { value: 'Global', label: 'Global' },
  { value: 'Other', label: 'Other' },
];

export default function SellerDatabasePage() {
  const [activeTab, setActiveTab] = useState<'sellers' | 'identities'>('sellers');

  // Sellers state
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(true);

  // Platforms state (for linking individual sellers)
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(true);

  // Platform Identities state
  const [identities, setIdentities] = useState<PlatformIdentity[]>([]);
  const [loadingIdentities, setLoadingIdentities] = useState(true);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filter state
  const [filterType, setFilterType] = useState<SellerType | ''>('');
  const [filterRegion, setFilterRegion] = useState<SellerRegion | ''>('');
  const [filterTier, setFilterTier] = useState<number | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Seller form state
  const [showSellerForm, setShowSellerForm] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [submittingSeller, setSubmittingSeller] = useState(false);
  const [deletingSeller, setDeletingSeller] = useState<number | null>(null);
  const [showSellerCredentials, setShowSellerCredentials] = useState<number | null>(null);

  const [sellerFormData, setSellerFormData] = useState({
    name: '',
    type: 'dealer' as SellerType,
    website: '',
    platformId: null as number | null,
    linkedSellerId: null as number | null,
    country: '',
    city: '',
    region: '' as SellerRegion | '',
    email: '',
    phone: '',
    reliabilityTier: 3,
    attributionWeight: 0.7,
    pricingWeight: 0.7,
    canResearchAt: true,
    searchUrlTemplate: '',
    searchSoldUrlTemplate: '',
    specializations: [] as SellerSpecialization[],
    username: '',
    password: '',
    notes: '',
    isActive: true,
  });

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
    fetchPlatforms();
  }, []);

  // Re-fetch sellers when filters change
  useEffect(() => {
    setLoadingSellers(true);
    fetchSellers();
  }, [filterType, filterRegion, searchTerm]);

  async function fetchSellers() {
    try {
      const params = new URLSearchParams();
      params.append('includePlatform', 'true'); // Include platform join data
      if (filterType) params.append('type', filterType);
      if (filterRegion) params.append('region', filterRegion);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/sellers?${params}`);
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

  async function fetchPlatforms() {
    try {
      const res = await fetch('/api/platforms?isActive=true');
      if (!res.ok) throw new Error('Failed to fetch platforms');
      const data = await res.json();
      setPlatforms(data.items || []);
    } catch (err) {
      console.error('Failed to load platforms:', err);
    } finally {
      setLoadingPlatforms(false);
    }
  }

  // Seller form handlers
  function resetSellerForm() {
    setSellerFormData({
      name: '',
      type: 'dealer',
      website: '',
      platformId: null,
      linkedSellerId: null,
      country: '',
      city: '',
      region: '',
      email: '',
      phone: '',
      reliabilityTier: 3,
      attributionWeight: 0.7,
      pricingWeight: 0.7,
      canResearchAt: true,
      searchUrlTemplate: '',
      searchSoldUrlTemplate: '',
      specializations: [],
      username: '',
      password: '',
      notes: '',
      isActive: true,
    });
    setEditingSeller(null);
    setShowSellerForm(false);
  }

  function startEditSeller(seller: Seller) {
    setEditingSeller(seller);
    setSellerFormData({
      name: seller.name,
      type: seller.type,
      website: seller.website || '',
      platformId: seller.platformId || null,
      linkedSellerId: seller.linkedSellerId || null,
      country: seller.country || '',
      city: seller.city || '',
      region: seller.region || '',
      email: seller.email || '',
      phone: seller.phone || '',
      reliabilityTier: seller.reliabilityTier,
      attributionWeight: seller.attributionWeight,
      pricingWeight: seller.pricingWeight,
      canResearchAt: seller.canResearchAt,
      searchUrlTemplate: seller.searchUrlTemplate || '',
      searchSoldUrlTemplate: seller.searchSoldUrlTemplate || '',
      specializations: seller.specializations,
      username: seller.username || '',
      password: seller.password || '',
      notes: seller.notes || '',
      isActive: seller.isActive,
    });
    setShowSellerForm(true);
  }

  function handleTypeChange(newType: SellerType) {
    const defaults = getDefaultsForSellerType(newType);
    setSellerFormData({
      ...sellerFormData,
      type: newType,
      reliabilityTier: defaults.reliabilityTier ?? sellerFormData.reliabilityTier,
      attributionWeight: defaults.attributionWeight ?? sellerFormData.attributionWeight,
      pricingWeight: defaults.pricingWeight ?? sellerFormData.pricingWeight,
      canResearchAt: defaults.canResearchAt ?? sellerFormData.canResearchAt,
    });
  }

  function toggleSpecialization(spec: SellerSpecialization) {
    if (sellerFormData.specializations.includes(spec)) {
      setSellerFormData({
        ...sellerFormData,
        specializations: sellerFormData.specializations.filter(s => s !== spec),
      });
    } else {
      setSellerFormData({
        ...sellerFormData,
        specializations: [...sellerFormData.specializations, spec],
      });
    }
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
        type: sellerFormData.type,
        website: sellerFormData.website.trim() || null,
        platformId: sellerFormData.platformId,
        linkedSellerId: sellerFormData.linkedSellerId,
        country: sellerFormData.country.trim() || null,
        city: sellerFormData.city.trim() || null,
        region: sellerFormData.region || null,
        email: sellerFormData.email.trim() || null,
        phone: sellerFormData.phone.trim() || null,
        reliabilityTier: sellerFormData.reliabilityTier,
        attributionWeight: sellerFormData.attributionWeight,
        pricingWeight: sellerFormData.pricingWeight,
        canResearchAt: sellerFormData.canResearchAt,
        searchUrlTemplate: sellerFormData.searchUrlTemplate.trim() || null,
        searchSoldUrlTemplate: sellerFormData.searchSoldUrlTemplate.trim() || null,
        specializations: sellerFormData.specializations,
        username: sellerFormData.username.trim() || null,
        password: sellerFormData.password || null,
        notes: sellerFormData.notes.trim() || null,
        isActive: sellerFormData.isActive,
      };

      let res;
      if (editingSeller) {
        res = await fetch(`/api/sellers?id=${editingSeller.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/sellers', {
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

  async function handleDeleteSeller(seller: Seller) {
    if (!confirm(`Are you sure you want to delete "${seller.name}"?`)) {
      return;
    }

    try {
      setDeletingSeller(seller.id);
      setError('');

      const res = await fetch(`/api/sellers?id=${seller.id}`, { method: 'DELETE' });
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

  // Filter sellers by tier (client-side since it's not a server filter)
  const filteredSellers = filterTier
    ? sellers.filter(s => s.reliabilityTier === filterTier)
    : sellers;

  const unlinkedIdentities = identities.filter(i => !i.sellerId);

  const getTierBadgeColor = (tier: number) => {
    switch (tier) {
      case 1: return 'bg-emerald-100 text-emerald-800';
      case 2: return 'bg-blue-100 text-blue-800';
      case 3: return 'bg-violet-100 text-violet-800';
      case 4: return 'bg-amber-100 text-amber-800';
      case 5: return 'bg-orange-100 text-orange-800';
      case 6: return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Seller Database</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage sellers (WHO you buy from) - auction houses, dealers, galleries, and individuals.
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
            Sellers
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

      {/* Sellers Tab */}
      {activeTab === 'sellers' && (
        <>
          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search sellers..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as SellerType | '')}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                >
                  <option value="">All Types</option>
                  {SELLER_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                <select
                  value={filterRegion}
                  onChange={(e) => setFilterRegion(e.target.value as SellerRegion | '')}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                >
                  <option value="">All Regions</option>
                  {REGIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tier</label>
                <select
                  value={filterTier}
                  onChange={(e) => setFilterTier(e.target.value ? parseInt(e.target.value) : '')}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                >
                  <option value="">All Tiers</option>
                  {[1, 2, 3, 4, 5, 6].map(tier => (
                    <option key={tier} value={tier}>Tier {tier}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Add/Edit Form */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingSeller ? `Edit "${editingSeller.name}"` : 'Add New Seller'}
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
                {/* Basic Info */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={sellerFormData.name}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, name: e.target.value })}
                      placeholder="Seller name"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                    <select
                      value={sellerFormData.type}
                      onChange={(e) => handleTypeChange(e.target.value as SellerType)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    >
                      {SELLER_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
                    <input
                      type="url"
                      value={sellerFormData.website}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, website: e.target.value })}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                {/* Platform Link (especially useful for individual sellers) */}
                {(sellerFormData.type === 'individual' || sellerFormData.platformId) && (
                  <div className="grid gap-4 md:grid-cols-2 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Platform
                        <span className="text-xs text-slate-500 ml-1">(where they sell)</span>
                      </label>
                      <select
                        value={sellerFormData.platformId || ''}
                        onChange={(e) => setSellerFormData({
                          ...sellerFormData,
                          platformId: e.target.value ? parseInt(e.target.value) : null
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-white"
                      >
                        <option value="">-- No platform --</option>
                        {platforms.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        Which platform does this seller primarily operate on?
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Linked Seller
                        <span className="text-xs text-slate-500 ml-1">(if known dealer)</span>
                      </label>
                      <select
                        value={sellerFormData.linkedSellerId || ''}
                        onChange={(e) => setSellerFormData({
                          ...sellerFormData,
                          linkedSellerId: e.target.value ? parseInt(e.target.value) : null
                        })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-white"
                      >
                        <option value="">-- Not linked --</option>
                        {sellers.filter(s => s.id !== editingSeller?.id && s.type !== 'individual').map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        Link to their main seller record if this is a known dealer's platform username
                      </p>
                    </div>
                  </div>
                )}

                {/* Location */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={sellerFormData.country}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, country: e.target.value })}
                      placeholder="United States"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={sellerFormData.city}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, city: e.target.value })}
                      placeholder="New York"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                    <select
                      value={sellerFormData.region}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, region: e.target.value as SellerRegion | '' })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    >
                      <option value="">Select region...</option>
                      {REGIONS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Reliability & Weights */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Reliability Tier
                      <span className="text-xs text-slate-500 ml-1">(1=highest)</span>
                    </label>
                    <select
                      value={sellerFormData.reliabilityTier}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, reliabilityTier: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    >
                      {Object.entries(RELIABILITY_TIERS).map(([tier, info]) => (
                        <option key={tier} value={tier}>{info.label} - {info.description}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Attribution Weight
                      <span className="text-xs text-slate-500 ml-1">({(sellerFormData.attributionWeight * 100).toFixed(0)}%)</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="0.95"
                      step="0.05"
                      value={sellerFormData.attributionWeight}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, attributionWeight: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Pricing Weight
                      <span className="text-xs text-slate-500 ml-1">({(sellerFormData.pricingWeight * 100).toFixed(0)}%)</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="0.95"
                      step="0.05"
                      value={sellerFormData.pricingWeight}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, pricingWeight: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Capabilities */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Capabilities</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sellerFormData.canResearchAt}
                        onChange={(e) => setSellerFormData({ ...sellerFormData, canResearchAt: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">Can Research At</span>
                      <span className="text-xs text-slate-500">(has searchable archive)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sellerFormData.isActive}
                        onChange={(e) => setSellerFormData({ ...sellerFormData, isActive: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">Active</span>
                    </label>
                  </div>
                </div>

                {/* Specializations */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Specializations</label>
                  <div className="space-y-3">
                    {Object.entries(SPECIALIZATION_CATEGORIES).map(([key, category]) => (
                      <div key={key}>
                        <div className="text-xs text-slate-500 mb-1">{category.label}</div>
                        <div className="flex flex-wrap gap-1">
                          {category.options.map(spec => (
                            <button
                              key={spec}
                              type="button"
                              onClick={() => toggleSpecialization(spec)}
                              className={`text-xs px-2 py-1 rounded transition ${
                                sellerFormData.specializations.includes(spec)
                                  ? 'bg-violet-100 text-violet-800 border border-violet-300'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {SPECIALIZATION_LABELS[spec]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Search URLs */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Search URL Template
                      <span className="text-xs text-slate-500 ml-1">(use {'{query}'})</span>
                    </label>
                    <input
                      type="text"
                      value={sellerFormData.searchUrlTemplate}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, searchUrlTemplate: e.target.value })}
                      placeholder="https://example.com/search?q={query}"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Sold Search URL Template
                      <span className="text-xs text-slate-500 ml-1">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={sellerFormData.searchSoldUrlTemplate}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, searchSoldUrlTemplate: e.target.value })}
                      placeholder="https://example.com/sold?q={query}"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none font-mono text-sm"
                    />
                  </div>
                </div>

                {/* Contact */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={sellerFormData.email}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, email: e.target.value })}
                      placeholder="contact@example.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={sellerFormData.phone}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                {/* Credentials */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Login Username
                      <span className="text-xs text-slate-500 ml-1">(for their website)</span>
                    </label>
                    <input
                      type="text"
                      value={sellerFormData.username}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, username: e.target.value })}
                      placeholder="Your login username"
                      autoComplete="new-password"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Login Password
                      <span className="text-xs text-slate-500 ml-1">(for their website)</span>
                    </label>
                    <input
                      type="password"
                      value={sellerFormData.password}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, password: e.target.value })}
                      placeholder="Your login password"
                      autoComplete="new-password"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    value={sellerFormData.notes}
                    onChange={(e) => setSellerFormData({ ...sellerFormData, notes: e.target.value })}
                    placeholder="Any additional notes..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Actions */}
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
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                All Sellers
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({filteredSellers.length} of {sellers.length})
                </span>
              </h2>
            </div>

            {loadingSellers ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600"></div>
              </div>
            ) : filteredSellers.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                {sellers.length === 0
                  ? 'No sellers yet. Add your first seller above.'
                  : 'No sellers match your filters.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredSellers.map((seller) => (
                  <div key={seller.id} className="px-4 py-3 hover:bg-slate-50 group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-900">{seller.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getTierBadgeColor(seller.reliabilityTier)}`}>
                            Tier {seller.reliabilityTier}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {SELLER_TYPE_LABELS[seller.type]}
                          </span>
                          {seller.platformId && (
                            <span className="text-xs px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded">
                              on {seller.platform?.name || platforms.find(p => p.id === seller.platformId)?.name || 'Platform'}
                            </span>
                          )}
                          {seller.linkedSellerId && (
                            <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded">
                              → {seller.linkedSeller?.name || sellers.find(s => s.id === seller.linkedSellerId)?.name || 'Linked'}
                            </span>
                          )}
                          {seller.region && (
                            <span className="text-xs text-slate-500">{seller.region}</span>
                          )}
                          {seller.canResearchAt && (
                            <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">Research</span>
                          )}
                          {!seller.isActive && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Inactive</span>
                          )}
                          {(seller.username || seller.password) && (
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">Has Credentials</span>
                          )}
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                          {seller.website && (
                            <a href={seller.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mr-3">
                              {seller.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            </a>
                          )}
                          {seller.city && seller.country && `${seller.city}, ${seller.country}`}
                          {!seller.city && seller.country && seller.country}
                        </div>
                        {seller.specializations && seller.specializations.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {seller.specializations.slice(0, 6).map(spec => (
                              <span key={spec} className="text-xs px-2 py-0.5 bg-violet-50 text-violet-700 rounded">
                                {SPECIALIZATION_LABELS[spec]}
                              </span>
                            ))}
                            {seller.specializations.length > 6 && (
                              <span className="text-xs text-slate-500">+{seller.specializations.length - 6} more</span>
                            )}
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
        <h3 className="font-semibold text-blue-800 mb-2">About the Seller Database</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>- <strong>Sellers</strong> = WHO you buy from (auction houses, dealers, galleries, individuals)</li>
          <li>- <strong>Tier 1-2</strong>: Major auction houses and specialized dealers - highest reliability for attribution</li>
          <li>- <strong>Tier 3-4</strong>: Established and general dealers - good reliability</li>
          <li>- <strong>Tier 5-6</strong>: Newer dealers and individuals - variable reliability</li>
          <li>- <strong>Platform Identities</strong> are usernames on platforms (eBay, Invaluable, etc.)</li>
          <li>- One seller can have multiple platform identities (same person on different platforms)</li>
          <li>- Sellers with "Can Research At" have searchable archives for identification research</li>
          <li>- Search URL templates enable quick seller searches from poster pages</li>
        </ul>
      </div>
    </div>
  );
}
