'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type {
  Dealer,
  DealerType,
  DealerRegion,
  DealerSpecialization,
} from '@/types/dealer';
import {
  DEALER_TYPE_LABELS,
  RELIABILITY_TIERS,
  SPECIALIZATION_LABELS,
  SPECIALIZATION_CATEGORIES,
  getDefaultsForDealerType,
} from '@/types/dealer';
import type { PrivateSeller } from '@/types/poster';

const DEALER_TYPES: { value: DealerType; label: string }[] = [
  { value: 'auction_house', label: 'Auction House' },
  { value: 'poster_dealer', label: 'Poster Dealer' },
  { value: 'book_dealer', label: 'Book Dealer' },
  { value: 'print_dealer', label: 'Print Dealer' },
  { value: 'map_dealer', label: 'Map Dealer' },
  { value: 'ephemera_dealer', label: 'Ephemera Dealer' },
  { value: 'photography_dealer', label: 'Photography Dealer' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'aggregator', label: 'Aggregator' },
  { value: 'museum', label: 'Museum/Institution' },
];

const REGIONS: { value: DealerRegion; label: string }[] = [
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

export default function DealerDatabasePage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [sellers, setSellers] = useState<PrivateSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filter state
  const [filterType, setFilterType] = useState<DealerType | ''>('');
  const [filterRegion, setFilterRegion] = useState<DealerRegion | ''>('');
  const [filterTier, setFilterTier] = useState<number | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Seed info
  const [seedInfo, setSeedInfo] = useState<{
    currentDealerCount: number;
    defaultDealerCount: number;
    needsSeeding: boolean;
  } | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingDealer, setEditingDealer] = useState<Dealer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'poster_dealer' as DealerType,
    website: '',
    country: '',
    city: '',
    region: '' as DealerRegion | '',
    email: '',
    phone: '',
    reliabilityTier: 3,
    attributionWeight: 0.7,
    pricingWeight: 0.7,
    canResearch: true,
    canPrice: true,
    canProcure: false,
    canBeSource: true,
    searchUrlTemplate: '',
    searchSoldUrlTemplate: '',
    specializations: [] as DealerSpecialization[],
    linkedSellerId: null as number | null,
    notes: '',
    isActive: true,
  });

  useEffect(() => {
    fetchDealers();
    fetchSellers();
    fetchSeedInfo();
  }, []);

  async function fetchDealers() {
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);
      if (filterRegion) params.append('region', filterRegion);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/dealers?${params}`);
      if (!res.ok) throw new Error('Failed to fetch dealers');
      const data = await res.json();
      setDealers(data.items);
    } catch (err) {
      setError('Failed to load dealers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSellers() {
    try {
      const res = await fetch('/api/private-sellers');
      if (!res.ok) throw new Error('Failed to fetch sellers');
      const data = await res.json();
      setSellers(data.items);
    } catch (err) {
      console.error('Failed to load sellers:', err);
    }
  }

  async function fetchSeedInfo() {
    try {
      const res = await fetch('/api/dealers/seed');
      if (!res.ok) throw new Error('Failed to fetch seed info');
      const data = await res.json();
      setSeedInfo(data);
    } catch (err) {
      console.error('Failed to fetch seed info:', err);
    }
  }

  async function handleSeedDealers() {
    if (!confirm('This will add the default dealers to your database. Existing dealers will not be duplicated. Continue?')) {
      return;
    }

    try {
      setSeeding(true);
      setError('');
      const res = await fetch('/api/dealers/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });

      if (!res.ok) throw new Error('Failed to seed dealers');
      const data = await res.json();

      setSuccess(`Seeded ${data.created} dealers (${data.skipped} already existed)`);
      fetchDealers();
      fetchSeedInfo();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed dealers');
    } finally {
      setSeeding(false);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      type: 'poster_dealer',
      website: '',
      country: '',
      city: '',
      region: '',
      email: '',
      phone: '',
      reliabilityTier: 3,
      attributionWeight: 0.7,
      pricingWeight: 0.7,
      canResearch: true,
      canPrice: true,
      canProcure: false,
      canBeSource: true,
      searchUrlTemplate: '',
      searchSoldUrlTemplate: '',
      specializations: [],
      linkedSellerId: null,
      notes: '',
      isActive: true,
    });
    setEditingDealer(null);
    setShowForm(false);
  }

  function startEdit(dealer: Dealer) {
    setEditingDealer(dealer);
    setFormData({
      name: dealer.name,
      type: dealer.type,
      website: dealer.website || '',
      country: dealer.country || '',
      city: dealer.city || '',
      region: dealer.region || '',
      email: dealer.email || '',
      phone: dealer.phone || '',
      reliabilityTier: dealer.reliabilityTier,
      attributionWeight: dealer.attributionWeight,
      pricingWeight: dealer.pricingWeight,
      canResearch: dealer.canResearch,
      canPrice: dealer.canPrice,
      canProcure: dealer.canProcure,
      canBeSource: dealer.canBeSource,
      searchUrlTemplate: dealer.searchUrlTemplate || '',
      searchSoldUrlTemplate: dealer.searchSoldUrlTemplate || '',
      specializations: dealer.specializations,
      linkedSellerId: dealer.linkedSellerId ?? null,
      notes: dealer.notes || '',
      isActive: dealer.isActive,
    });
    setShowForm(true);
  }

  function handleTypeChange(newType: DealerType) {
    const defaults = getDefaultsForDealerType(newType);
    setFormData({
      ...formData,
      type: newType,
      reliabilityTier: defaults.reliabilityTier ?? formData.reliabilityTier,
      attributionWeight: defaults.attributionWeight ?? formData.attributionWeight,
      pricingWeight: defaults.pricingWeight ?? formData.pricingWeight,
      canResearch: defaults.canResearch ?? formData.canResearch,
      canPrice: defaults.canPrice ?? formData.canPrice,
      canProcure: defaults.canProcure ?? formData.canProcure,
      canBeSource: defaults.canBeSource ?? formData.canBeSource,
    });
  }

  function toggleSpecialization(spec: DealerSpecialization) {
    if (formData.specializations.includes(spec)) {
      setFormData({
        ...formData,
        specializations: formData.specializations.filter(s => s !== spec),
      });
    } else {
      setFormData({
        ...formData,
        specializations: [...formData.specializations, spec],
      });
    }
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
        type: formData.type,
        website: formData.website.trim() || null,
        country: formData.country.trim() || null,
        city: formData.city.trim() || null,
        region: formData.region || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        reliabilityTier: formData.reliabilityTier,
        attributionWeight: formData.attributionWeight,
        pricingWeight: formData.pricingWeight,
        canResearch: formData.canResearch,
        canPrice: formData.canPrice,
        canProcure: formData.canProcure,
        canBeSource: formData.canBeSource,
        searchUrlTemplate: formData.searchUrlTemplate.trim() || null,
        searchSoldUrlTemplate: formData.searchSoldUrlTemplate.trim() || null,
        specializations: formData.specializations,
        linkedSellerId: formData.linkedSellerId,
        notes: formData.notes.trim() || null,
        isActive: formData.isActive,
      };

      let res;
      if (editingDealer) {
        res = await fetch(`/api/dealers?id=${editingDealer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/dealers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save dealer');
      }

      setSuccess(editingDealer ? `"${formData.name}" updated` : `"${formData.name}" added`);
      resetForm();
      fetchDealers();
      fetchSeedInfo();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dealer');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(dealer: Dealer) {
    if (!confirm(`Are you sure you want to delete "${dealer.name}"?`)) {
      return;
    }

    try {
      setDeleting(dealer.id);
      setError('');

      const res = await fetch(`/api/dealers?id=${dealer.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete dealer');
      }

      setSuccess(`"${dealer.name}" deleted`);
      fetchDealers();
      fetchSeedInfo();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dealer');
    } finally {
      setDeleting(null);
    }
  }

  // Apply filters
  useEffect(() => {
    setLoading(true);
    fetchDealers();
  }, [filterType, filterRegion, searchTerm]);

  // Filter by tier client-side (since server filter is limited)
  const filteredDealers = filterTier
    ? dealers.filter(d => d.reliabilityTier === filterTier)
    : dealers;

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
          <h1 className="text-2xl font-bold text-slate-900">Dealer Database</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage dealers, auction houses, and galleries for research and attribution.
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

      {/* Seed Panel */}
      {seedInfo && seedInfo.needsSeeding && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
          <h3 className="font-semibold text-violet-800 mb-2">Get Started with Default Dealers</h3>
          <p className="text-sm text-violet-700 mb-3">
            Your database is empty. Seed it with {seedInfo.defaultDealerCount} curated dealers including
            major auction houses, specialized poster dealers, book dealers, and more.
          </p>
          <button
            onClick={handleSeedDealers}
            disabled={seeding}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-300 transition"
          >
            {seeding ? 'Seeding...' : 'Seed Default Dealers'}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search dealers..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as DealerType | '')}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
            >
              <option value="">All Types</option>
              {DEALER_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value as DealerRegion | '')}
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
          {seedInfo && !seedInfo.needsSeeding && (
            <button
              onClick={handleSeedDealers}
              disabled={seeding}
              className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition disabled:opacity-50"
            >
              {seeding ? 'Seeding...' : 'Add Missing Defaults'}
            </button>
          )}
        </div>
      </div>

      {/* Add/Edit Form */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingDealer ? `Edit "${editingDealer.name}"` : 'Add New Dealer'}
          </h2>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm"
            >
              + Add Dealer
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Dealer name"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => handleTypeChange(e.target.value as DealerType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                >
                  {DEALER_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Location */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="United States"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="New York"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value as DealerRegion | '' })}
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
                  value={formData.reliabilityTier}
                  onChange={(e) => setFormData({ ...formData, reliabilityTier: parseInt(e.target.value) })}
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
                  <span className="text-xs text-slate-500 ml-1">({(formData.attributionWeight * 100).toFixed(0)}%)</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  value={formData.attributionWeight}
                  onChange={(e) => setFormData({ ...formData, attributionWeight: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pricing Weight
                  <span className="text-xs text-slate-500 ml-1">({(formData.pricingWeight * 100).toFixed(0)}%)</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  value={formData.pricingWeight}
                  onChange={(e) => setFormData({ ...formData, pricingWeight: parseFloat(e.target.value) })}
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
                    checked={formData.canResearch}
                    onChange={(e) => setFormData({ ...formData, canResearch: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">Research</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canPrice}
                    onChange={(e) => setFormData({ ...formData, canPrice: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">Pricing</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canProcure}
                    onChange={(e) => setFormData({ ...formData, canProcure: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">Procurement</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canBeSource}
                    onChange={(e) => setFormData({ ...formData, canBeSource: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">Acquisition Source</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
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
                            formData.specializations.includes(spec)
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
                  value={formData.searchUrlTemplate}
                  onChange={(e) => setFormData({ ...formData, searchUrlTemplate: e.target.value })}
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
                  value={formData.searchSoldUrlTemplate}
                  onChange={(e) => setFormData({ ...formData, searchSoldUrlTemplate: e.target.value })}
                  placeholder="https://example.com/sold?q={query}"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none font-mono text-sm"
                />
              </div>
            </div>

            {/* Contact & Links */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Link to Seller</label>
                <select
                  value={formData.linkedSellerId || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    linkedSellerId: e.target.value ? parseInt(e.target.value) : null
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                >
                  <option value="">-- Not linked --</option>
                  {sellers.map(seller => (
                    <option key={seller.id} value={seller.id}>{seller.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting || !formData.name.trim()}
                className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Saving...' : editingDealer ? 'Update Dealer' : 'Add Dealer'}
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

      {/* Dealers List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            All Dealers
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({filteredDealers.length} of {dealers.length})
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600"></div>
          </div>
        ) : filteredDealers.length === 0 ? (
          <p className="text-slate-500 text-center py-8">
            {dealers.length === 0
              ? 'No dealers yet. Add your first dealer or seed the default list above.'
              : 'No dealers match your filters.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDealers.map((dealer) => (
              <div key={dealer.id} className="px-4 py-3 hover:bg-slate-50 group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900">{dealer.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getTierBadgeColor(dealer.reliabilityTier)}`}>
                        Tier {dealer.reliabilityTier}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                        {DEALER_TYPE_LABELS[dealer.type]}
                      </span>
                      {dealer.region && (
                        <span className="text-xs text-slate-500">{dealer.region}</span>
                      )}
                      {!dealer.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Inactive</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {dealer.website && (
                        <a href={dealer.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mr-3">
                          {dealer.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      )}
                      {dealer.city && dealer.country && `${dealer.city}, ${dealer.country}`}
                      {!dealer.city && dealer.country && dealer.country}
                    </div>
                    {dealer.specializations.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {dealer.specializations.slice(0, 6).map(spec => (
                          <span key={spec} className="text-xs px-2 py-0.5 bg-violet-50 text-violet-700 rounded">
                            {SPECIALIZATION_LABELS[spec]}
                          </span>
                        ))}
                        {dealer.specializations.length > 6 && (
                          <span className="text-xs text-slate-500">+{dealer.specializations.length - 6} more</span>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2 text-xs">
                      {dealer.canResearch && <span className="text-emerald-600">Research</span>}
                      {dealer.canPrice && <span className="text-blue-600">Pricing</span>}
                      {dealer.canProcure && <span className="text-amber-600">Procurement</span>}
                      {dealer.canBeSource && <span className="text-violet-600">Source</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition ml-4">
                    <button
                      onClick={() => startEdit(dealer)}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(dealer)}
                      disabled={deleting === dealer.id}
                      className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1 rounded transition disabled:opacity-50"
                    >
                      {deleting === dealer.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">About the Dealer Database</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>- <strong>Tier 1-2</strong>: Major auction houses and specialized dealers - highest reliability for attribution</li>
          <li>- <strong>Tier 3</strong>: Museums and institutions - excellent for research, not for pricing</li>
          <li>- <strong>Tier 4-5</strong>: Marketplaces and aggregators - useful for pricing and discovery</li>
          <li>- <strong>Tier 6</strong>: General sites - lower reliability, use with caution</li>
          <li>- Link a dealer to a Seller when you have a buying relationship with them</li>
          <li>- Search URL templates enable quick dealer searches from poster pages (Phase 2)</li>
        </ul>
      </div>
    </div>
  );
}
