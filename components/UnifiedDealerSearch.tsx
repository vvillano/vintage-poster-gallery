'use client';

import { useState, useEffect } from 'react';
import { Poster } from '@/types/poster';

// Search result interface matching the API response
interface SearchResult {
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
  isKnownDealer: boolean;
  isProductPage?: boolean;
  productIndicators?: string[];
  visualMatch?: number;
  sameImage?: boolean;
  sameArtist?: boolean;
  visuallyVerified: boolean;
  visualExplanation?: string;
}

interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  unknownDomains: string[];
  totalResults: number;
  creditsUsed: number;
  searchTime: number;
  visualVerification?: {
    enabled: boolean;
    resultsVerified: number;
    confirmedMatches: number;
    highMatchCount: number;
  };
  productPageStats?: {
    total: number;
    withPrice: number;
    needingPrice: number;
  };
  parsedResults?: {
    priceSummary: {
      currentListings: { low: number; high: number; average: number; count: number } | null;
      soldPrices: { low: number; high: number; average: number; count: number; sources: string[] } | null;
      allPrices: { price: number; currency: string; status: string; source: string; url: string }[];
    };
  };
}

type FilterType = 'all' | 'for_sale' | 'sold' | 'reference';

interface UnifiedDealerSearchProps {
  poster: Poster;
  onUpdate?: () => void;
}

export default function UnifiedDealerSearch({ poster, onUpdate }: UnifiedDealerSearchProps) {
  const [searchConfigured, setSearchConfigured] = useState<boolean | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [enableVisualVerification, setEnableVisualVerification] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add dealer state
  const [addingDealer, setAddingDealer] = useState<string | null>(null);
  const [addDealerName, setAddDealerName] = useState('');
  const [addDealerType, setAddDealerType] = useState('poster_dealer');
  const [addDealerSaving, setAddDealerSaving] = useState(false);
  const [recentlyAddedDomains, setRecentlyAddedDomains] = useState<Set<string>>(new Set());

  // Initialize search query from poster
  useEffect(() => {
    if (poster) {
      const parts: string[] = [];
      if (poster.title) parts.push(poster.title);
      if (poster.artist && poster.artist !== 'Unknown') parts.push(poster.artist);
      setSearchQuery(parts.join(' '));
    }
  }, [poster?.id]);

  // Check if search is configured
  useEffect(() => {
    fetch('/api/research/comprehensive')
      .then(res => res.json())
      .then(data => setSearchConfigured(data.configured))
      .catch(() => setSearchConfigured(false));
  }, []);

  // Perform search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter search terms');
      return;
    }

    setSearching(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/research/comprehensive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: poster.imageUrl,
          query: searchQuery,
          maxLensResults: 20,
          maxWebResults: 20,
          includeWebSearch: true,
          parseWithAI: true,
          posterContext: {
            title: poster.title || '',
            artist: poster.artist !== 'Unknown' ? poster.artist : undefined,
            date: poster.estimatedDate,
          },
          excludeCategories: ['research'], // Valuation focuses on commercial sources
          enableVisualVerification,
          maxVisualVerifications: 10,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      setSearchResults(data);
      setSuccess(`Found ${data.results.length} results`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Filter results based on active filter
  const getFilteredResults = (): SearchResult[] => {
    if (!searchResults?.results) return [];

    switch (activeFilter) {
      case 'for_sale':
        return searchResults.results.filter(r =>
          r.isProductPage && !r.snippet?.toLowerCase().includes('sold') &&
          !r.snippet?.toLowerCase().includes('out of stock')
        );
      case 'sold':
        return searchResults.results.filter(r =>
          r.snippet?.toLowerCase().includes('sold') ||
          r.snippet?.toLowerCase().includes('out of stock') ||
          r.snippet?.toLowerCase().includes('realized') ||
          r.snippet?.toLowerCase().includes('hammer price')
        );
      case 'reference':
        return searchResults.results.filter(r =>
          !r.isProductPage && !r.price
        );
      default:
        return searchResults.results;
    }
  };

  // Count results for each filter
  const getFilterCounts = () => {
    if (!searchResults?.results) return { all: 0, for_sale: 0, sold: 0, reference: 0 };

    const results = searchResults.results;
    return {
      all: results.length,
      for_sale: results.filter(r =>
        r.isProductPage && !r.snippet?.toLowerCase().includes('sold') &&
        !r.snippet?.toLowerCase().includes('out of stock')
      ).length,
      sold: results.filter(r =>
        r.snippet?.toLowerCase().includes('sold') ||
        r.snippet?.toLowerCase().includes('out of stock') ||
        r.snippet?.toLowerCase().includes('realized')
      ).length,
      reference: results.filter(r =>
        !r.isProductPage && !r.price
      ).length,
    };
  };

  // Start adding a dealer
  const startAddDealer = (domain: string) => {
    setAddingDealer(domain);
    // Capitalize first letter of each word for default name
    setAddDealerName(domain.replace(/\.(com|org|net|co\.uk)$/i, '').split(/[.-]/).map(
      word => word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' '));
  };

  // Handle adding a dealer
  const handleAddDealer = async () => {
    if (!addingDealer || !addDealerName.trim()) return;

    setAddDealerSaving(true);
    try {
      const res = await fetch('/api/dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addDealerName,
          website: `https://${addingDealer}`,
          type: addDealerType,
          reliabilityTier: 4,
          canResearch: true,
          canPrice: true,
          canBeSource: true,
          isActive: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(data.message || `Dealer already exists: ${data.existingName}`);
        }
        throw new Error(data.error || 'Failed to add dealer');
      }

      setRecentlyAddedDomains(prev => new Set([...prev, addingDealer]));
      setSuccess(`Added ${addDealerName} to dealer database`);
      setAddingDealer(null);
      setAddDealerName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add dealer');
    } finally {
      setAddDealerSaving(false);
    }
  };

  // Tier badge colors
  const getTierBadgeColor = (tier: number) => {
    switch (tier) {
      case 1: return 'bg-emerald-100 text-emerald-800';
      case 2: return 'bg-teal-100 text-teal-800';
      case 3: return 'bg-violet-100 text-violet-800';
      case 4: return 'bg-amber-100 text-amber-800';
      case 5: return 'bg-orange-100 text-orange-800';
      case 6: return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Visual match helpers
  const getVisualMatchColor = (result: SearchResult) => {
    if (!result.visuallyVerified) return 'text-slate-400';
    if (result.sameImage || (result.visualMatch ?? 0) >= 85) return 'text-green-600';
    if ((result.visualMatch ?? 0) >= 60) return 'text-blue-600';
    if ((result.visualMatch ?? 0) >= 40) return 'text-amber-600';
    return 'text-slate-400';
  };

  const getVisualMatchLabel = (result: SearchResult) => {
    if (!result.visuallyVerified) return 'Not verified';
    if (result.sameImage || (result.visualMatch ?? 0) >= 85) return 'Same poster';
    if ((result.visualMatch ?? 0) >= 60) return 'Likely match';
    if (result.sameArtist || (result.visualMatch ?? 0) >= 40) return 'Different work';
    return 'Low match';
  };

  const getVisualMatchIcon = (result: SearchResult) => {
    if (!result.visuallyVerified) return '🔍';
    if (result.sameImage || (result.visualMatch ?? 0) >= 85) return '✓';
    if ((result.visualMatch ?? 0) >= 60) return '~';
    if (result.sameArtist || (result.visualMatch ?? 0) >= 40) return '⚠';
    return '✗';
  };

  const filteredResults = getFilteredResults();
  const filterCounts = getFilterCounts();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold text-slate-900 mb-4">Dealer Research</h3>

      {/* Search Input */}
      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search terms..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchConfigured}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
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
          <span className="text-[10px] text-slate-500">
            (AI confirms results show this poster)
          </span>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Results Section */}
      {searchResults && (
        <>
          {/* Stats Bar */}
          <div className="mb-4 flex flex-wrap gap-4">
            {searchResults.visualVerification && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-600">✓ {searchResults.visualVerification.confirmedMatches}</span>
                <span className="text-slate-400">|</span>
                <span className="text-blue-600">~ {searchResults.visualVerification.highMatchCount - searchResults.visualVerification.confirmedMatches}</span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-500">🔍 {searchResults.visualVerification.resultsVerified} verified</span>
              </div>
            )}
            {searchResults.productPageStats && searchResults.productPageStats.total > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-amber-600">🏷️ {searchResults.productPageStats.total} product pages</span>
                <span className="text-green-600">💵 {searchResults.productPageStats.withPrice} with price</span>
              </div>
            )}
          </div>

          {/* Price Summary */}
          {searchResults.parsedResults?.priceSummary && (
            <div className="mb-4 grid grid-cols-2 gap-3">
              {searchResults.parsedResults.priceSummary.currentListings && (
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <div className="font-medium text-green-800 text-sm mb-1">Current Listings</div>
                  <div className="text-lg font-bold text-green-700">
                    ${searchResults.parsedResults.priceSummary.currentListings.low.toLocaleString()} - ${searchResults.parsedResults.priceSummary.currentListings.high.toLocaleString()}
                  </div>
                  <div className="text-xs text-green-600">
                    {searchResults.parsedResults.priceSummary.currentListings.count} listings
                  </div>
                </div>
              )}
              {searchResults.parsedResults.priceSummary.soldPrices && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="font-medium text-blue-800 text-sm mb-1">Sold Prices</div>
                  <div className="text-lg font-bold text-blue-700">
                    ${searchResults.parsedResults.priceSummary.soldPrices.low.toLocaleString()} - ${searchResults.parsedResults.priceSummary.soldPrices.high.toLocaleString()}
                  </div>
                  <div className="text-xs text-blue-600">
                    {searchResults.parsedResults.priceSummary.soldPrices.count} sales
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filter Chips */}
          <div className="mb-4 flex gap-2 flex-wrap">
            {(['all', 'for_sale', 'sold', 'reference'] as FilterType[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  activeFilter === filter
                    ? filter === 'for_sale' ? 'bg-green-600 text-white' :
                      filter === 'sold' ? 'bg-blue-600 text-white' :
                      filter === 'reference' ? 'bg-purple-600 text-white' :
                      'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filter === 'all' ? 'All' :
                 filter === 'for_sale' ? 'For Sale' :
                 filter === 'sold' ? 'Sold' :
                 'Reference'}
                <span className="ml-1.5 opacity-75">({filterCounts[filter]})</span>
              </button>
            ))}
          </div>

          {/* Results List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredResults.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No results match this filter</p>
            ) : (
              filteredResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`bg-white rounded p-3 border flex gap-3 ${
                    result.sameImage || (result.visualMatch ?? 0) >= 85
                      ? 'border-green-300 bg-green-50/50'
                      : (result.visualMatch ?? 0) >= 60
                      ? 'border-blue-200'
                      : result.visuallyVerified && (result.visualMatch ?? 0) < 40
                      ? 'border-slate-200 opacity-60'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Thumbnail */}
                  {result.thumbnail && (
                    <div className="relative flex-shrink-0">
                      <img
                        src={result.thumbnail}
                        alt=""
                        className="w-16 h-16 object-cover rounded"
                      />
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

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-slate-700 hover:text-green-600 hover:underline line-clamp-2"
                      >
                        {result.title}
                      </a>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {result.price ? (
                          <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                            {result.price}
                          </span>
                        ) : result.isProductPage ? (
                          <span
                            className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded"
                            title={result.productIndicators?.join(', ')}
                          >
                            🏷️ Price on site
                          </span>
                        ) : null}
                        {result.isKnownDealer && result.reliabilityTier && (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getTierBadgeColor(result.reliabilityTier)}`}>
                            T{result.reliabilityTier}
                          </span>
                        )}
                      </div>
                    </div>

                    {result.snippet && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">{result.snippet}</p>
                    )}

                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{result.isKnownDealer ? result.dealerName : result.domain}</span>
                      {!result.isKnownDealer && !recentlyAddedDomains.has(result.domain) && (
                        <button
                          onClick={() => startAddDealer(result.domain)}
                          className="text-green-600 hover:text-green-700 hover:underline"
                        >
                          + add
                        </button>
                      )}
                      {recentlyAddedDomains.has(result.domain) && (
                        <span className="text-green-600">✓ added</span>
                      )}
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
              ))
            )}
          </div>

          {/* Unknown Domains */}
          {searchResults.unknownDomains.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm font-medium text-amber-800 mb-2">
                Unknown Dealers ({searchResults.unknownDomains.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {searchResults.unknownDomains.slice(0, 10).map((domain) => (
                  <div key={domain} className="flex items-center gap-1">
                    {addingDealer === domain ? (
                      <div className="flex items-center gap-1 bg-white rounded px-2 py-1 border">
                        <input
                          type="text"
                          value={addDealerName}
                          onChange={(e) => setAddDealerName(e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs w-32"
                          autoFocus
                        />
                        <select
                          value={addDealerType}
                          onChange={(e) => setAddDealerType(e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs"
                        >
                          <option value="poster_dealer">Poster Dealer</option>
                          <option value="auction_house">Auction House</option>
                          <option value="gallery">Gallery</option>
                          <option value="marketplace">Marketplace</option>
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
                        onClick={() => startAddDealer(domain)}
                        className="text-xs px-2 py-1 bg-white rounded border border-amber-300 text-amber-700 hover:bg-amber-100"
                      >
                        + {domain}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!searchResults && !searching && (
        <div className="text-center py-8 text-slate-500">
          <p>Click "Search" to find pricing and market data</p>
          <p className="text-xs mt-1">Results will be filtered by commercial sources</p>
        </div>
      )}

      {/* Loading State */}
      {searching && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-2"></div>
          <p className="text-slate-600">Searching dealers...</p>
        </div>
      )}
    </div>
  );
}
