'use client';

import { useState, useEffect } from 'react';
import type { Poster, ComparableSale, ResearchSite } from '@/types/poster';
import { RELIABILITY_TIERS } from '@/types/dealer';

interface ValuationSearchResult {
  title: string;
  url: string;
  snippet?: string;
  domain: string;
  source: 'lens' | 'web';
  price?: string;
  priceValue?: number;
  currency?: string;
  thumbnail?: string;
  dealerId?: number;
  dealerName?: string;
  reliabilityTier?: number;
  dealerCategory?: string;
  isKnownDealer: boolean;
  // Visual verification fields
  visualMatch?: number;        // 0-100 visual similarity score
  sameImage?: boolean;         // High confidence this is the same poster
  sameArtist?: boolean;        // Same artist/style but different work
  visuallyVerified: boolean;   // Whether visual verification was performed
  visualExplanation?: string;  // Brief explanation from Claude
}

interface ValuationSearchResponse {
  success: boolean;
  results: ValuationSearchResult[];
  unknownDomains: string[];
  totalResults: number;
  creditsUsed: number;
  visualVerification?: {
    enabled: boolean;
    resultsVerified: number;
    confirmedMatches: number;
    highMatchCount: number;
  };
  parsedResults?: {
    priceSummary: {
      currentListings: { low: number; high: number; average: number; count: number } | null;
      soldPrices: { low: number; high: number; average: number; count: number; sources: string[] } | null;
      allPrices: { price: number; currency: string; status: string; source: string; url: string }[];
    };
  };
}

interface ValuationPanelProps {
  poster: Poster;
  onUpdate: () => void;
}

// Build marketplace search query with all relevant context
function buildMarketplaceQuery(poster: Poster): string {
  const parts: string[] = [];

  // Product type
  if (poster.productType && poster.productType !== 'Unknown') {
    parts.push(poster.productType);
  }

  // Artist (if known and confident)
  if (poster.artist && poster.artist !== 'Unknown' && (poster.artistConfidenceScore || 0) > 60) {
    parts.push(poster.artist);
  }

  // Title - clean up common descriptors
  let title = poster.title || '';
  title = title
    .replace(/\s*linen[\s-]*backed\s*/gi, ' ')
    .replace(/\s*paper[\s-]*backed\s*/gi, ' ')
    .replace(/\s*(original\s*)?poster\s*/gi, ' ')
    .replace(/\s*(original\s*)?vintage\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (title) {
    parts.push(title);
  }

  // Year (if known)
  const yearMatch = poster.estimatedDate?.match(/\b(1[89]\d{2}|20[0-2]\d)\b/);
  if (yearMatch) {
    parts.push(yearMatch[1]);
  }

  return parts.join(' ');
}

export default function ValuationPanel({ poster, onUpdate }: ValuationPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search state
  const [searchConfigured, setSearchConfigured] = useState<boolean | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ValuationSearchResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [enableVisualVerification, setEnableVisualVerification] = useState(true);

  // Research sites for manual search
  const [researchSites, setResearchSites] = useState<ResearchSite[]>([]);
  const [researchQuery, setResearchQuery] = useState('');
  const [copiedCredential, setCopiedCredential] = useState<string | null>(null);

  // Add dealer state
  const [addingDealer, setAddingDealer] = useState<string | null>(null); // domain being added
  const [addDealerName, setAddDealerName] = useState('');
  const [addDealerType, setAddDealerType] = useState('poster_dealer');
  const [addDealerSaving, setAddDealerSaving] = useState(false);
  const [recentlyAddedDomains, setRecentlyAddedDomains] = useState<Set<string>>(new Set());

  // Sales log state
  const [showAddSale, setShowAddSale] = useState(false);
  const [addingSale, setAddingSale] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [newSale, setNewSale] = useState({
    date: '',
    price: '',
    currency: 'USD',
    source: '',
    condition: '',
    url: '',
    notes: '',
  });

  // Initialize queries when expanded
  useEffect(() => {
    if (expanded) {
      const query = buildMarketplaceQuery(poster);
      setSearchQuery(query);
      setResearchQuery(query);
      checkSearchConfig();
      fetchResearchSites();
    }
  }, [expanded, poster]);

  async function checkSearchConfig() {
    try {
      const res = await fetch('/api/research/search');
      const data = await res.json();
      setSearchConfigured(data.configured ?? false);
    } catch {
      setSearchConfigured(false);
    }
  }

  async function fetchResearchSites() {
    try {
      const res = await fetch('/api/platforms?isResearchSite=true');
      if (res.ok) {
        const data = await res.json();
        setResearchSites(data.platforms || []);
      }
    } catch (err) {
      console.error('Failed to fetch research sites:', err);
    }
  }

  // Search for pricing data (excludes research-only sources)
  async function handleValuationSearch() {
    if (!searchConfigured) {
      setError('Serper API is not configured. Add SERPER_API_KEY to use this feature.');
      return;
    }

    try {
      setSearching(true);
      setError('');
      setSearchResults(null);

      // Use comprehensive search with excludeCategories to skip research-only sources
      const res = await fetch('/api/research/comprehensive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: poster.imageUrl,
          query: searchQuery,
          maxLensResults: 15,
          maxWebResults: 15,
          includeWebSearch: true,
          parseWithAI: true,
          posterContext: {
            title: poster.title || '',
            artist: poster.artist !== 'Unknown' ? poster.artist : undefined,
            date: poster.estimatedDate,
          },
          // Exclude research-only sources (museums, LOC, etc.)
          excludeCategories: ['research'],
          // Visual verification
          enableVisualVerification,
          maxVisualVerifications: 10,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        if (!data.configured) {
          setError('Serper API is not configured. Add SERPER_API_KEY to enable pricing search.');
        } else {
          throw new Error(data.error || 'Valuation search failed');
        }
        return;
      }

      setSearchResults(data);
      setSuccess(`Found ${data.totalResults} pricing results`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  // Calculate price summary from manual sales log
  function getPriceSummary(): { low: number; high: number; avg: number; count: number } | null {
    if (!poster?.comparableSales || poster.comparableSales.length === 0) return null;
    const prices = poster.comparableSales.map(s => s.price);
    return {
      low: Math.min(...prices),
      high: Math.max(...prices),
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      count: prices.length,
    };
  }

  // Add a comparable sale
  async function addComparableSale(e: React.FormEvent) {
    e.preventDefault();
    if (!poster || !newSale.date || !newSale.price || !newSale.source) return;

    try {
      setAddingSale(true);
      setError('');

      const res = await fetch(`/api/posters/${poster.id}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newSale.date,
          price: parseFloat(newSale.price),
          currency: newSale.currency,
          source: newSale.source,
          condition: newSale.condition || null,
          url: newSale.url || null,
          notes: newSale.notes || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to add sale');

      setSuccess('Sale record added');
      setNewSale({ date: '', price: '', currency: 'USD', source: '', condition: '', url: '', notes: '' });
      setShowAddSale(false);
      onUpdate();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sale');
    } finally {
      setAddingSale(false);
    }
  }

  // Delete a comparable sale
  async function deleteComparableSale(saleId: string) {
    if (!poster) return;

    try {
      setDeletingSaleId(saleId);
      const res = await fetch(`/api/posters/${poster.id}/sales/${saleId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete sale');

      setSuccess('Sale deleted');
      onUpdate();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sale');
    } finally {
      setDeletingSaleId(null);
    }
  }

  // Start adding a new dealer from unknown domain
  function startAddingDealer(domain: string) {
    // Try to extract a name from the domain
    const nameParts = domain.replace(/\.(com|net|org|co\.uk|de|fr|it)$/, '').split('.');
    const suggestedName = nameParts[nameParts.length - 1]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    setAddDealerName(suggestedName);
    setAddingDealer(domain);
  }

  // Save the new dealer
  async function handleAddDealer() {
    if (!addingDealer || !addDealerName.trim()) return;

    try {
      setAddDealerSaving(true);
      setError('');

      const res = await fetch('/api/dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addDealerName.trim(),
          type: addDealerType,
          website: `https://${addingDealer}`,
          reliabilityTier: 4, // Default to tier 4 for new discoveries
          canResearch: true,
          canPrice: true,
          canBeSource: true,
          isActive: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Handle duplicate dealer case with helpful message
        if (res.status === 409) {
          throw new Error(data.message || `Dealer already exists: ${data.existingName}`);
        }
        throw new Error(data.error || 'Failed to add dealer');
      }

      // Mark as added
      setRecentlyAddedDomains(prev => new Set([...prev, addingDealer]));
      setSuccess(`Added ${addDealerName} to dealer database`);
      setAddingDealer(null);
      setAddDealerName('');

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add dealer');
    } finally {
      setAddDealerSaving(false);
    }
  }

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

  // Visual match helpers
  const getVisualMatchColor = (result: ValuationSearchResult) => {
    if (!result.visuallyVerified) return 'text-slate-400';
    if (result.sameImage || (result.visualMatch ?? 0) >= 85) return 'text-green-600';
    if ((result.visualMatch ?? 0) >= 60) return 'text-blue-600';
    if ((result.visualMatch ?? 0) >= 40) return 'text-amber-600';
    return 'text-slate-400';
  };

  const getVisualMatchLabel = (result: ValuationSearchResult) => {
    if (!result.visuallyVerified) return 'Not verified';
    if (result.sameImage || (result.visualMatch ?? 0) >= 85) return 'Same poster';
    if ((result.visualMatch ?? 0) >= 60) return 'Likely match';
    if (result.sameArtist || (result.visualMatch ?? 0) >= 40) return 'Different work';
    return 'Low match';
  };

  const getVisualMatchIcon = (result: ValuationSearchResult) => {
    if (!result.visuallyVerified) return '🔍';
    if (result.sameImage || (result.visualMatch ?? 0) >= 85) return '✓';
    if ((result.visualMatch ?? 0) >= 60) return '~';
    if (result.sameArtist || (result.visualMatch ?? 0) >= 40) return '⚠';
    return '✗';
  };

  const priceSummary = getPriceSummary();

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">💰</span>
          <span className="font-semibold text-slate-900">Valuation</span>
          {priceSummary && (
            <span className="text-sm text-slate-500">
              ${priceSummary.avg.toLocaleString()} avg ({priceSummary.count} sales)
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 p-4 space-y-6">
          {/* Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
              {success}
            </div>
          )}

          {/* Auto Search for Pricing */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-medium text-green-900 flex items-center gap-2">
                  <span>🔍</span> Search for Prices
                </div>
                <div className="text-xs text-green-600">
                  Finds current listings and sold prices from dealers & marketplaces
                </div>
              </div>
              <button
                onClick={handleValuationSearch}
                disabled={searching || searchConfigured === false}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                  searchConfigured
                    ? 'bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {searching ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Searching...
                  </>
                ) : (
                  <>
                    <span>💵</span>
                    Find Prices
                  </>
                )}
              </button>
            </div>

            {/* Search Query */}
            <div className="bg-white rounded p-2 border border-green-100">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search terms..."
                className="w-full text-sm bg-transparent outline-none"
              />
            </div>

            {/* Visual Verification Toggle */}
            <div className="mt-2 flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-green-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableVisualVerification}
                  onChange={(e) => setEnableVisualVerification(e.target.checked)}
                  className="rounded border-green-300 text-green-600 focus:ring-green-500"
                />
                <span>Visual verification</span>
              </label>
              <span className="text-[10px] text-green-600">
                (Uses AI to confirm results show this poster, not just same artist)
              </span>
            </div>

            {/* Visual Verification Stats */}
            {searchResults?.visualVerification && (
              <div className="mt-3 p-2 bg-white rounded border border-green-100 flex items-center gap-4">
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-green-600">✓</span>
                  <span className="text-green-700 font-medium">{searchResults.visualVerification.confirmedMatches}</span>
                  <span className="text-green-600">confirmed</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-blue-600">~</span>
                  <span className="text-blue-700 font-medium">{searchResults.visualVerification.highMatchCount - searchResults.visualVerification.confirmedMatches}</span>
                  <span className="text-blue-600">likely matches</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-400">🔍</span>
                  <span className="text-slate-600">{searchResults.visualVerification.resultsVerified} verified</span>
                </div>
              </div>
            )}

            {/* Search Results - Current Listings */}
            {searchResults?.parsedResults?.priceSummary && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {searchResults.parsedResults.priceSummary.currentListings && (
                    <div className="bg-white rounded p-3 border border-green-100">
                      <div className="font-medium text-green-800 text-sm mb-1">Current Listings</div>
                      <div className="text-lg font-bold text-green-700">
                        ${searchResults.parsedResults.priceSummary.currentListings.low.toLocaleString()} -
                        ${searchResults.parsedResults.priceSummary.currentListings.high.toLocaleString()}
                      </div>
                      <div className="text-xs text-green-600">
                        {searchResults.parsedResults.priceSummary.currentListings.count} listings found
                      </div>
                      <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                        {searchResults.parsedResults.priceSummary.allPrices
                          .filter(p => p.status === 'for_sale')
                          .slice(0, 5)
                          .map((p, idx) => (
                            <a
                              key={idx}
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-green-700 hover:text-green-900 hover:underline truncate"
                            >
                              → ${p.price.toLocaleString()} @ {p.source}
                            </a>
                          ))}
                      </div>
                    </div>
                  )}
                  {searchResults.parsedResults.priceSummary.soldPrices && (
                    <div className="bg-white rounded p-3 border border-amber-100">
                      <div className="font-medium text-amber-800 text-sm mb-1">Sold Prices</div>
                      <div className="text-lg font-bold text-amber-700">
                        ${searchResults.parsedResults.priceSummary.soldPrices.low.toLocaleString()} -
                        ${searchResults.parsedResults.priceSummary.soldPrices.high.toLocaleString()}
                      </div>
                      <div className="text-xs text-amber-600">
                        {searchResults.parsedResults.priceSummary.soldPrices.count} sales found
                      </div>
                      <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                        {searchResults.parsedResults.priceSummary.allPrices
                          .filter(p => p.status === 'sold' || p.status === 'out_of_stock' || p.status === 'auction_result')
                          .slice(0, 5)
                          .map((p, idx) => (
                            <a
                              key={idx}
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-amber-700 hover:text-amber-900 hover:underline truncate"
                            >
                              → ${p.price.toLocaleString()} @ {p.source}
                            </a>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* All Results List */}
                {searchResults.results.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-green-600 cursor-pointer hover:text-green-800">
                      View all {searchResults.results.length} results
                    </summary>
                    <div className="mt-2 max-h-64 overflow-y-auto space-y-2">
                      {searchResults.results.map((result, idx) => (
                        <div
                          key={idx}
                          className={`bg-white rounded p-2 border flex gap-2 ${
                            result.sameImage || (result.visualMatch ?? 0) >= 85
                              ? 'border-green-300 bg-green-50/50'
                              : (result.visualMatch ?? 0) >= 60
                              ? 'border-blue-200'
                              : result.visuallyVerified && (result.visualMatch ?? 0) < 40
                              ? 'border-slate-200 opacity-60'
                              : 'border-green-100'
                          }`}
                        >
                          {result.thumbnail && (
                            <div className="relative flex-shrink-0">
                              <img
                                src={result.thumbnail}
                                alt=""
                                className="w-12 h-12 object-cover rounded"
                              />
                              {/* Visual match badge on thumbnail */}
                              {result.visuallyVerified && (
                                <span
                                  className={`absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                                    result.sameImage || (result.visualMatch ?? 0) >= 85
                                      ? 'bg-green-500 text-white'
                                      : (result.visualMatch ?? 0) >= 60
                                      ? 'bg-blue-500 text-white'
                                      : (result.visualMatch ?? 0) >= 40
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-slate-400 text-white'
                                  }`}
                                  title={result.visualExplanation || getVisualMatchLabel(result)}
                                >
                                  {result.visualMatch ?? 0}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-green-700 hover:underline line-clamp-1"
                            >
                              {result.title}
                            </a>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {result.price && (
                                <span className="text-xs font-medium text-green-600">
                                  {result.price}
                                </span>
                              )}
                              <span className="text-xs text-slate-400">
                                {result.isKnownDealer ? result.dealerName : result.domain}
                              </span>
                              {result.reliabilityTier && (
                                <span className={`px-1 py-0.5 rounded text-[10px] ${getTierBadgeColor(result.reliabilityTier)}`}>
                                  T{result.reliabilityTier}
                                </span>
                              )}
                              {/* Visual match indicator */}
                              {result.visuallyVerified && (
                                <span
                                  className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] ${getVisualMatchColor(result)} bg-slate-100`}
                                  title={result.visualExplanation}
                                >
                                  {getVisualMatchIcon(result)} {getVisualMatchLabel(result)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Unknown Dealers - Add to Database */}
                {searchResults.unknownDomains.length > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 rounded border border-amber-200">
                    <div className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1">
                      <span>🏪</span>
                      New sources found ({searchResults.unknownDomains.length}) - Click to add to dealer database:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchResults.unknownDomains.slice(0, 8).map((domain, idx) => (
                        recentlyAddedDomains.has(domain) ? (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded"
                          >
                            <span>✓</span> {domain}
                          </span>
                        ) : addingDealer === domain ? (
                          <div key={idx} className="flex items-center gap-2 bg-white rounded p-2 border border-amber-300">
                            <input
                              type="text"
                              value={addDealerName}
                              onChange={(e) => setAddDealerName(e.target.value)}
                              placeholder="Dealer name"
                              className="px-2 py-1 border border-slate-200 rounded text-xs w-32"
                              autoFocus
                            />
                            <select
                              value={addDealerType}
                              onChange={(e) => setAddDealerType(e.target.value)}
                              className="px-2 py-1 border border-slate-200 rounded text-xs"
                            >
                              <optgroup label="Dealers">
                                <option value="poster_dealer">Poster Dealer</option>
                                <option value="auction_house">Auction House</option>
                                <option value="gallery">Gallery</option>
                                <option value="print_dealer">Print Dealer</option>
                                <option value="book_dealer">Book Dealer</option>
                                <option value="map_dealer">Map Dealer</option>
                                <option value="ephemera_dealer">Ephemera Dealer</option>
                                <option value="photography_dealer">Photography Dealer</option>
                              </optgroup>
                              <optgroup label="Platforms">
                                <option value="marketplace">Marketplace</option>
                                <option value="aggregator">Aggregator</option>
                              </optgroup>
                              <optgroup label="Research">
                                <option value="museum">Museum / Institution</option>
                              </optgroup>
                            </select>
                            <button
                              onClick={handleAddDealer}
                              disabled={addDealerSaving || !addDealerName.trim()}
                              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-green-300"
                            >
                              {addDealerSaving ? '...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setAddingDealer(null)}
                              className="px-2 py-1 text-slate-500 text-xs hover:text-slate-700"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            key={idx}
                            onClick={() => startAddingDealer(domain)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded hover:bg-amber-200 transition"
                          >
                            <span className="text-green-600">+</span> {domain}
                          </button>
                        )
                      ))}
                    </div>
                    {searchResults.unknownDomains.length > 8 && (
                      <div className="text-xs text-amber-600 mt-2">
                        +{searchResults.unknownDomains.length - 8} more sources found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Where to Buy Now - Image + Marketplace Search */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
              <span>🛒</span> Where to Buy Now
            </h4>
            <p className="text-xs text-slate-600 mb-3">
              Quick links to find this item on marketplaces
            </p>

            {/* Image Search */}
            {poster.imageUrl && (
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">Image Search</p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(poster.imageUrl)}&q=${encodeURIComponent(searchQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded transition"
                  >
                    Google Lens
                  </a>
                  <a
                    href={`https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIVSP&sbisrc=UrlPaste&q=imgurl:${encodeURIComponent(poster.imageUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded transition"
                  >
                    Bing Visual
                  </a>
                  <a
                    href={`https://tineye.com/search?url=${encodeURIComponent(poster.imageUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded transition"
                  >
                    TinEye
                  </a>
                </div>
              </div>
            )}

            {/* Marketplace Search */}
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase mb-2">Marketplace Search</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm bg-yellow-500 hover:bg-yellow-600 text-slate-900 px-3 py-1.5 rounded transition"
                >
                  eBay
                </a>
                <a
                  href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(searchQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition"
                >
                  Google Shopping
                </a>
                <a
                  href={`https://www.liveauctioneers.com/search/?q=${encodeURIComponent(searchQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition"
                >
                  LiveAuctioneers
                </a>
                <a
                  href={`https://www.etsy.com/search?q=${encodeURIComponent(searchQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded transition"
                >
                  Etsy
                </a>
              </div>
            </div>
          </div>

          {/* Manual Research Links */}
          <div className="bg-violet-50 rounded-lg p-4">
            <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
              <span>📚</span> Price Research Sites
            </h4>

            {/* Editable search term */}
            <div className="flex items-center gap-2 mb-3 p-2 bg-white rounded border border-slate-200">
              <input
                type="text"
                value={researchQuery}
                onChange={(e) => setResearchQuery(e.target.value)}
                className="text-sm text-slate-600 flex-1 bg-transparent outline-none"
                placeholder="Enter search terms..."
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(researchQuery);
                  setSuccess('Search term copied!');
                  setTimeout(() => setSuccess(''), 2000);
                }}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition whitespace-nowrap"
              >
                Copy
              </button>
            </div>

            {/* Subscription sites */}
            {researchSites.filter(s => s.requiresSubscription).length > 0 && (
              <>
                <p className="text-xs text-slate-500 mb-2">Subscription sites:</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {researchSites.filter(s => s.requiresSubscription).map((site) => {
                    const siteUrl = site.urlTemplate.includes('{search}')
                      ? site.urlTemplate.replace('{search}', encodeURIComponent(researchQuery))
                      : site.urlTemplate;
                    const hasCredentials = site.username || site.password;
                    return (
                      <div key={site.id} className="relative group">
                        <a
                          href={siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm px-3 py-1.5 rounded transition bg-violet-600 hover:bg-violet-700 text-white inline-block"
                        >
                          {site.name}
                        </a>
                        {hasCredentials && (
                          <div className="hidden group-hover:block absolute left-0 top-full mt-1 z-50">
                            <div className="bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl min-w-[180px]">
                              <p className="text-slate-400 text-[10px] uppercase tracking-wide mb-2">Credentials</p>
                              {site.username && (
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <span className="text-slate-300">UN:</span>
                                  <span className="font-mono">{site.username}</span>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      navigator.clipboard.writeText(site.username || '');
                                      setCopiedCredential(`${site.id}-un`);
                                      setTimeout(() => setCopiedCredential(null), 1500);
                                    }}
                                    className="text-[10px] bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded"
                                  >
                                    {copiedCredential === `${site.id}-un` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                              )}
                              {site.password && (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-slate-300">PW:</span>
                                  <span className="font-mono">••••••</span>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      navigator.clipboard.writeText(site.password || '');
                                      setCopiedCredential(`${site.id}-pw`);
                                      setTimeout(() => setCopiedCredential(null), 1500);
                                    }}
                                    className="text-[10px] bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded"
                                  >
                                    {copiedCredential === `${site.id}-pw` ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Free sites */}
            {researchSites.filter(s => !s.requiresSubscription).length > 0 && (
              <>
                <p className="text-xs text-slate-500 mb-2">Free sites:</p>
                <div className="flex flex-wrap gap-2">
                  {researchSites.filter(s => !s.requiresSubscription).map((site) => {
                    const siteUrl = site.urlTemplate.includes('{search}')
                      ? site.urlTemplate.replace('{search}', encodeURIComponent(researchQuery))
                      : site.urlTemplate;
                    return (
                      <a
                        key={site.id}
                        href={siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm px-3 py-1.5 rounded transition bg-slate-100 hover:bg-slate-200 text-slate-700 inline-block"
                      >
                        {site.name}
                      </a>
                    );
                  })}
                </div>
              </>
            )}

            {researchSites.length === 0 && (
              <p className="text-sm text-slate-500">
                No research sites configured.{' '}
                <a href="/settings/platforms" className="text-violet-600 hover:underline">
                  Add sites in Settings
                </a>
              </p>
            )}
          </div>

          {/* Sales Log */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-slate-900 flex items-center gap-2">
                <span>📊</span> Sales Log
              </h4>
              <button
                onClick={() => setShowAddSale(!showAddSale)}
                className="text-sm bg-violet-600 hover:bg-violet-700 text-white px-3 py-1 rounded transition"
              >
                {showAddSale ? 'Cancel' : '+ Add Sale'}
              </button>
            </div>

            {/* Price Summary */}
            {priceSummary && (
              <div className="mb-4 p-3 bg-violet-50 rounded-lg">
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-xs text-slate-500">Low</p>
                    <p className="text-base font-bold text-red-600">${priceSummary.low.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">High</p>
                    <p className="text-base font-bold text-green-600">${priceSummary.high.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Average</p>
                    <p className="text-base font-bold text-violet-600">${priceSummary.avg.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Sales</p>
                    <p className="text-base font-bold text-slate-700">{priceSummary.count}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Add Sale Form */}
            {showAddSale && (
              <form onSubmit={addComparableSale} className="mb-4 p-4 bg-slate-50 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Date *</label>
                    <input
                      type="date"
                      value={newSale.date}
                      onChange={(e) => setNewSale({ ...newSale, date: e.target.value })}
                      required
                      className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Price *</label>
                    <div className="flex mt-1">
                      <select
                        value={newSale.currency}
                        onChange={(e) => setNewSale({ ...newSale, currency: e.target.value })}
                        className="px-2 py-2 text-sm border border-r-0 border-slate-300 rounded-l bg-slate-50"
                      >
                        <option value="USD">$</option>
                        <option value="EUR">€</option>
                        <option value="GBP">£</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        value={newSale.price}
                        onChange={(e) => setNewSale({ ...newSale, price: e.target.value })}
                        required
                        placeholder="0.00"
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-r focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Source *</label>
                  <select
                    value={newSale.source}
                    onChange={(e) => setNewSale({ ...newSale, source: e.target.value })}
                    required
                    className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                  >
                    <option value="">Select source...</option>
                    {researchSites.map((site) => (
                      <option key={site.id} value={site.name}>{site.name}</option>
                    ))}
                    <option value="Heritage Auctions">Heritage Auctions</option>
                    <option value="Christie's">Christie's</option>
                    <option value="Sotheby's">Sotheby's</option>
                    <option value="eBay">eBay</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Condition</label>
                  <input
                    type="text"
                    value={newSale.condition}
                    onChange={(e) => setNewSale({ ...newSale, condition: e.target.value })}
                    placeholder="e.g., Excellent, Good, Fair"
                    className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">URL</label>
                  <input
                    type="url"
                    value={newSale.url}
                    onChange={(e) => setNewSale({ ...newSale, url: e.target.value })}
                    placeholder="Link to the sale listing"
                    className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Notes</label>
                  <textarea
                    value={newSale.notes}
                    onChange={(e) => setNewSale({ ...newSale, notes: e.target.value })}
                    placeholder="Any additional details..."
                    rows={2}
                    className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingSale || !newSale.date || !newSale.price || !newSale.source}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingSale ? 'Adding...' : 'Add Sale Record'}
                </button>
              </form>
            )}

            {/* Sales List */}
            {poster.comparableSales && poster.comparableSales.length > 0 ? (
              <div className="space-y-2">
                {poster.comparableSales
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((sale) => (
                    <div
                      key={sale.id}
                      className="p-3 bg-slate-50 rounded-lg group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-bold text-violet-700">
                              {sale.currency === 'USD' ? '$' : sale.currency === 'EUR' ? '€' : '£'}
                              {sale.price.toLocaleString()}
                            </span>
                            <span className="text-sm text-slate-600">{sale.source}</span>
                            <span className="text-xs text-slate-400">
                              {new Date(sale.date).toLocaleDateString()}
                            </span>
                          </div>
                          {sale.condition && (
                            <p className="text-xs text-slate-500">Condition: {sale.condition}</p>
                          )}
                          {sale.notes && (
                            <p className="text-xs text-slate-500 mt-1">{sale.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                          {sale.url && (
                            <a
                              href={sale.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded"
                            >
                              View →
                            </a>
                          )}
                          <button
                            onClick={() => deleteComparableSale(sale.id)}
                            disabled={deletingSaleId === sale.id}
                            className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded disabled:opacity-50"
                          >
                            {deletingSaleId === sale.id ? '...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                No sales recorded yet. Use the search tools above to find comparable sales.
              </p>
            )}
          </div>

          {/* Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
            <strong>About Valuation:</strong>
            <p className="mt-1">
              Valuation search excludes research-only sources (museums, LOC) to focus on pricing data from dealers and marketplaces.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
