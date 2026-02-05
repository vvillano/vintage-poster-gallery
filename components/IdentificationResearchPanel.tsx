'use client';

import { useState, useEffect } from 'react';
import type { Poster } from '@/types/poster';
import { DEALER_TYPE_LABELS, RELIABILITY_TIERS } from '@/types/dealer';

// Comprehensive search result types
interface UnifiedSearchResult {
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
  // Visual verification fields
  visualMatch?: number;        // 0-100 visual similarity score
  sameImage?: boolean;         // High confidence this is the same poster
  sameArtist?: boolean;        // Same artist/style but different work
  visuallyVerified: boolean;   // Whether visual verification was performed
  visualExplanation?: string;  // Brief explanation from Claude
}

interface ComprehensiveSearchResponse {
  success: boolean;
  results: UnifiedSearchResult[];
  lensResults?: UnifiedSearchResult[];
  webResults?: UnifiedSearchResult[];
  extractedTitles?: { title: string; source: string; confidence: number }[];
  knowledgeGraph?: { title?: string; type?: string; description?: string };
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
  parsedResults?: {
    results: any[];
    consensus: any;
    priceSummary: {
      currentListings: { low: number; high: number; average: number; count: number } | null;
      soldPrices: { low: number; high: number; average: number; count: number; sources: string[] } | null;
      allPrices: { price: number; currency: string; status: string; source: string; url: string }[];
    };
  };
}

interface SearchUrlResult {
  dealerId: number;
  dealerName: string;
  dealerType: string;
  reliabilityTier: number;
  searchUrl: string | null;
  website: string | null;
}

interface QueryVariation {
  query: string;
  label: string;
  description: string;
  priority: number;
}

interface AggregatedSearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  dealerId?: number;
  dealerName?: string;
  reliabilityTier?: number;
  isKnownDealer: boolean;
}

interface IdentificationResearchPanelProps {
  poster: Poster;
  onUpdate: () => void;
}

export default function IdentificationResearchPanel({ poster, onUpdate }: IdentificationResearchPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search URLs state
  const [searchUrls, setSearchUrls] = useState<SearchUrlResult[]>([]);
  const [query, setQuery] = useState('');
  const [editedQuery, setEditedQuery] = useState('');
  const [loadingUrls, setLoadingUrls] = useState(false);

  // Query variations
  const [queryVariations, setQueryVariations] = useState<QueryVariation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<number>(0);

  // Aggregated search state
  const [searchConfigured, setSearchConfigured] = useState<boolean | null>(null);
  const [searchingAll, setSearchingAll] = useState(false);
  const [aggregatedResults, setAggregatedResults] = useState<AggregatedSearchResult[]>([]);
  const [unknownDomains, setUnknownDomains] = useState<string[]>([]);
  const [creditsUsed, setCreditsUsed] = useState(0);

  // Filter state
  const [selectedTiers, setSelectedTiers] = useState<Set<number>>(new Set([1, 2, 3]));

  // Apply attribution state
  const [applyingAttribution, setApplyingAttribution] = useState(false);
  const [proposedArtist, setProposedArtist] = useState('');
  const [proposedConfidence, setProposedConfidence] = useState(75);
  const [proposedSources, setProposedSources] = useState<string[]>([]);

  // Comprehensive (visual-first) search state
  const [comprehensiveSearch, setComprehensiveSearch] = useState(false);
  const [comprehensiveResults, setComprehensiveResults] = useState<ComprehensiveSearchResponse | null>(null);
  const [comprehensiveLoading, setComprehensiveLoading] = useState(false);
  const [enableVisualVerification, setEnableVisualVerification] = useState(true);

  // Add dealer state
  const [addingDealer, setAddingDealer] = useState<string | null>(null); // domain being added
  const [addDealerName, setAddDealerName] = useState('');
  const [addDealerType, setAddDealerType] = useState('poster_dealer');
  const [addDealerSaving, setAddDealerSaving] = useState(false);
  const [recentlyAddedDomains, setRecentlyAddedDomains] = useState<Set<string>>(new Set());

  // Load search URLs and check API config when expanded
  useEffect(() => {
    if (expanded && searchUrls.length === 0) {
      loadSearchUrls();
      checkSearchConfig();
    }
  }, [expanded]);

  // Generate query variations when query changes
  useEffect(() => {
    if (query) {
      generateVariations();
    }
  }, [query, poster.artist, poster.estimatedDate]);

  async function checkSearchConfig() {
    try {
      const res = await fetch('/api/research/search');
      const data = await res.json();
      setSearchConfigured(data.configured ?? false);
    } catch {
      setSearchConfigured(false);
    }
  }

  function generateVariations() {
    const variations: QueryVariation[] = [];

    // Extract main title (remove common descriptors anywhere in string)
    let mainTitle = poster.title || '';
    mainTitle = mainTitle
      // Remove backing/condition descriptors
      .replace(/\s*linen[\s-]*backed\s*/gi, ' ')
      .replace(/\s*paper[\s-]*backed\s*/gi, ' ')
      .replace(/\s*canvas[\s-]*backed\s*/gi, ' ')
      .replace(/\s*mounted\s*/gi, ' ')
      // Remove format descriptors
      .replace(/\s*[-–]\s*(original\s*)?poster\s*/gi, ' ')
      .replace(/\s*(original\s*)?poster\s*/gi, ' ')
      .replace(/\s*(original\s*)?vintage\s*/gi, ' ')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim();

    if (!mainTitle) {
      mainTitle = poster.title || 'poster';
    }

    // Determine product type term for search (use actual type instead of always "poster")
    const productType = poster.productType?.toLowerCase() || 'poster';
    const searchTypeTerm = productType === 'poster' ? 'poster' :
                           productType === 'cover art' ? 'magazine cover' :
                           productType === 'print' ? 'print' :
                           productType === 'photograph' ? 'photograph' :
                           productType === 'illustration' ? 'illustration' :
                           productType === 'ephemera' ? '' : // Don't add type for ephemera
                           productType; // Use the type as-is for others

    // Extract date - prefer full date if available (e.g., "May 9, 1931"), otherwise just year
    const fullDateMatch = poster.estimatedDate?.match(/([A-Za-z]+\s+\d{1,2},?\s+\d{4})/);
    const yearMatch = poster.estimatedDate?.match(/\b(1[89]\d{2}|20[0-2]\d)\b/);
    const dateForSearch = fullDateMatch ? fullDateMatch[1] : (yearMatch ? yearMatch[1] : null);
    const year = yearMatch ? yearMatch[1] : null;

    // Clean artist name
    const artist = poster.artist && poster.artist !== 'Unknown'
      ? poster.artist.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
      : null;

    // 1. Broad: Title + product type (no quotes for broader matching)
    variations.push({
      query: searchTypeTerm ? `${mainTitle} ${searchTypeTerm}` : mainTitle,
      label: 'Broad',
      description: 'Title only - most matches',
      priority: 1,
    });

    // 2. With artist (if known)
    if (artist) {
      variations.push({
        query: searchTypeTerm ? `${mainTitle} ${artist} ${searchTypeTerm}` : `${mainTitle} ${artist}`,
        label: 'With Artist',
        description: `Include: ${artist}`,
        priority: 2,
      });
    }

    // 3. With date (if known) - use full date if available
    if (dateForSearch) {
      variations.push({
        query: searchTypeTerm ? `${mainTitle} ${dateForSearch} ${searchTypeTerm}` : `${mainTitle} ${dateForSearch}`,
        label: 'With Date',
        description: `Include: ${dateForSearch}`,
        priority: 3,
      });
    }

    // 4. Artist + Date (if both known)
    if (artist && dateForSearch) {
      variations.push({
        query: `${mainTitle} ${artist} ${dateForSearch}`,
        label: 'Full Context',
        description: `${artist}, ${dateForSearch}`,
        priority: 4,
      });
    }

    setQueryVariations(variations);
    if (variations.length > 0 && !editedQuery) {
      setEditedQuery(variations[0].query);
    }
  }

  async function loadSearchUrls() {
    try {
      setLoadingUrls(true);
      setError('');

      const res = await fetch(`/api/research/identification?posterId=${poster.id}&maxTier=6`);
      if (!res.ok) throw new Error('Failed to load dealer search URLs');

      const data = await res.json();
      setSearchUrls(data.searchUrls || []);
      setQuery(data.query || '');
      setEditedQuery(data.query || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load search URLs');
    } finally {
      setLoadingUrls(false);
    }
  }

  // Comprehensive visual-first search (Image → Text → Combined)
  async function handleComprehensiveSearch() {
    if (!poster.imageUrl) {
      setError('No image available for visual search');
      return;
    }

    try {
      setComprehensiveLoading(true);
      setError('');
      setComprehensiveResults(null);

      const searchQuery = editedQuery || queryVariations[selectedVariation]?.query || query;

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
            dimensions: poster.dimensionsEstimate,
            technique: poster.printingTechnique,
          },
          // Visual verification
          enableVisualVerification,
          maxVisualVerifications: 10,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        if (!data.configured) {
          setError('Serper API is not configured. Add SERPER_API_KEY to enable visual search.');
        } else {
          throw new Error(data.error || 'Comprehensive search failed');
        }
        return;
      }

      setComprehensiveResults(data);
      setCreditsUsed(prev => prev + (data.creditsUsed || 0));

      const lensCount = data.lensResults?.length || 0;
      const webCount = data.webResults?.length || 0;
      setSuccess(`Found ${data.totalResults} results (${lensCount} visual, ${webCount} web) in ${data.searchTime.toFixed(1)}s`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setComprehensiveLoading(false);
    }
  }

  async function handleSearchAll() {
    if (!searchConfigured) {
      setError('Serper API is not configured. Add SERPER_API_KEY to use this feature.');
      return;
    }

    try {
      setSearchingAll(true);
      setError('');
      setAggregatedResults([]);

      const searchQuery = editedQuery || queryVariations[selectedVariation]?.query || query;

      const res = await fetch('/api/research/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          maxResults: 20,
        }),
      });

      const data = await res.json();

      console.log('Search API response:', data);

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      setAggregatedResults(data.results || []);
      setUnknownDomains(data.unknownDomains || []);
      setCreditsUsed(prev => prev + (data.creditsUsed || 0));

      // Show any API errors
      if (data.errors && data.errors.length > 0) {
        setError(`API warnings: ${data.errors.join(', ')}`);
      }

      if (data.results?.length === 0) {
        setSuccess(`Search completed - no results found for "${searchQuery}". Try different search terms.`);
      } else {
        setSuccess(`Found ${data.results.length} results from ${new Set(data.results.map((r: AggregatedSearchResult) => r.domain)).size} sites.`);
      }

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearchingAll(false);
    }
  }

  async function handleApplyAttribution() {
    if (!proposedArtist.trim()) return;

    try {
      setApplyingAttribution(true);
      setError('');

      const res = await fetch('/api/research/identification', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posterId: poster.id,
          artist: proposedArtist.trim(),
          confidence: proposedConfidence,
          sources: proposedSources.length > 0 ? proposedSources : ['Manual dealer research'],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to apply attribution');
      }

      const data = await res.json();
      setSuccess(`Attribution updated: "${data.newArtist}" (${data.newConfidence}%)`);
      setProposedArtist('');
      setProposedSources([]);
      onUpdate();

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply attribution');
    } finally {
      setApplyingAttribution(false);
    }
  }

  function toggleTier(tier: number) {
    const newSelected = new Set(selectedTiers);
    if (newSelected.has(tier)) {
      newSelected.delete(tier);
    } else {
      newSelected.add(tier);
    }
    setSelectedTiers(newSelected);
  }

  function handleQueryChange(newQuery: string) {
    setEditedQuery(newQuery);
    // Regenerate search URLs with new query
    const updatedUrls = searchUrls.map(url => ({
      ...url,
      searchUrl: url.searchUrl
        ? url.searchUrl.replace(/\{query\}/, encodeURIComponent(newQuery))
        : null,
    }));
    // Note: We don't update searchUrls here as the template uses {query}
  }

  // Start adding a dealer from unknown domain
  function startAddDealer(domain: string) {
    // Generate a name from the domain (capitalize, remove common suffixes)
    const name = domain
      .replace(/\.(com|net|org|co\.uk|fr|de|it|es)$/i, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    setAddDealerName(name);
    setAddDealerType('poster_dealer');
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

      // Refresh search URLs to include new dealer
      loadSearchUrls();

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add dealer');
    } finally {
      setAddDealerSaving(false);
    }
  }

  // Filter search URLs by selected tiers
  const filteredUrls = searchUrls.filter(u => selectedTiers.has(u.reliabilityTier));

  // Group by tier for display
  const urlsByTier = new Map<number, SearchUrlResult[]>();
  for (const url of filteredUrls) {
    if (!urlsByTier.has(url.reliabilityTier)) {
      urlsByTier.set(url.reliabilityTier, []);
    }
    urlsByTier.get(url.reliabilityTier)!.push(url);
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
  const getVisualMatchColor = (result: UnifiedSearchResult) => {
    if (!result.visuallyVerified) return 'text-slate-400';
    if (result.sameImage || (result.visualMatch ?? 0) >= 85) return 'text-green-600';
    if ((result.visualMatch ?? 0) >= 60) return 'text-blue-600';
    if ((result.visualMatch ?? 0) >= 40) return 'text-amber-600';
    return 'text-slate-400';
  };

  const getVisualMatchLabel = (result: UnifiedSearchResult) => {
    if (!result.visuallyVerified) return 'Not verified';
    if (result.sameImage || (result.visualMatch ?? 0) >= 85) return 'Same poster';
    if ((result.visualMatch ?? 0) >= 60) return 'Likely match';
    if (result.sameArtist || (result.visualMatch ?? 0) >= 40) return 'Different work';
    return 'Low match';
  };

  const getVisualMatchIcon = (result: UnifiedSearchResult) => {
    if (!result.visuallyVerified) return '🔍';
    if (result.sameImage || (result.visualMatch ?? 0) >= 85) return '✓';
    if ((result.visualMatch ?? 0) >= 60) return '~';
    if (result.sameArtist || (result.visualMatch ?? 0) >= 40) return '⚠';
    return '✗';
  };

  // Get search URL with current query
  function getSearchUrlWithQuery(template: string | null): string | null {
    if (!template) return null;
    const searchQuery = editedQuery || query;
    return template.replace('{query}', encodeURIComponent(searchQuery));
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🔍</span>
          <span className="font-semibold text-slate-900">Dealer Research</span>
          {poster.artist && poster.artist !== 'Unknown' && (
            <span className="text-sm text-slate-500">
              Current: {poster.artist} ({poster.artistConfidenceScore ?? 0}%)
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
        <div className="border-t border-slate-200 p-4 space-y-4">
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

          {/* Search Query - Always Editable */}
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-slate-600">Search Query:</div>
              {editedQuery !== query && (
                <button
                  onClick={() => setEditedQuery(query)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Reset
                </button>
              )}
            </div>

            <input
              type="text"
              value={editedQuery || query || ''}
              onChange={(e) => setEditedQuery(e.target.value)}
              placeholder="Loading..."
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-white"
            />

            {/* Query Variations */}
            {queryVariations.length > 1 && (
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-2">Quick variations:</div>
                <div className="flex flex-wrap gap-2">
                  {queryVariations.map((variation, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedVariation(idx);
                        setEditedQuery(variation.query);
                      }}
                      className={`px-2 py-1 rounded text-xs transition ${
                        editedQuery === variation.query
                          ? 'bg-violet-100 text-violet-700 border border-violet-300'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                      title={variation.description}
                    >
                      {variation.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Comprehensive Visual-First Search */}
          <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-medium text-purple-900 flex items-center gap-2">
                  <span>📷</span> Visual Search (Recommended)
                </div>
                <div className="text-xs text-purple-600">
                  Uses Google Lens + web search to find similar items automatically
                </div>
              </div>
              <button
                onClick={handleComprehensiveSearch}
                disabled={comprehensiveLoading || !poster.imageUrl}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                  poster.imageUrl
                    ? 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-purple-300'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {comprehensiveLoading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Searching...
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    Search by Image
                  </>
                )}
              </button>
            </div>

            {/* Visual Verification Toggle */}
            <div className="flex items-center gap-2 mb-3">
              <label className="flex items-center gap-2 text-xs text-purple-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableVisualVerification}
                  onChange={(e) => setEnableVisualVerification(e.target.checked)}
                  className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Visual verification</span>
              </label>
              <span className="text-[10px] text-purple-600">
                (Uses AI to confirm results show this poster, not just same artist)
              </span>
            </div>

            {/* Comprehensive Results */}
            {comprehensiveResults && (
              <div className="space-y-3">
                {/* Visual Verification Stats */}
                {comprehensiveResults.visualVerification && (
                  <div className="p-2 bg-white rounded border border-purple-100 flex items-center gap-4">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-green-600">✓</span>
                      <span className="text-green-700 font-medium">{comprehensiveResults.visualVerification.confirmedMatches}</span>
                      <span className="text-green-600">confirmed</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-blue-600">~</span>
                      <span className="text-blue-700 font-medium">{comprehensiveResults.visualVerification.highMatchCount - comprehensiveResults.visualVerification.confirmedMatches}</span>
                      <span className="text-blue-600">likely matches</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-slate-400">🔍</span>
                      <span className="text-slate-600">{comprehensiveResults.visualVerification.resultsVerified} verified</span>
                    </div>
                  </div>
                )}

                {/* Knowledge Graph */}
                {comprehensiveResults.knowledgeGraph?.title && (
                  <div className="bg-white rounded p-3 border border-purple-100">
                    <div className="text-xs font-medium text-purple-700 mb-1">Identified as:</div>
                    <div className="font-medium text-slate-900">{comprehensiveResults.knowledgeGraph.title}</div>
                    {comprehensiveResults.knowledgeGraph.type && (
                      <div className="text-xs text-slate-500">{comprehensiveResults.knowledgeGraph.type}</div>
                    )}
                    {comprehensiveResults.knowledgeGraph.description && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{comprehensiveResults.knowledgeGraph.description}</p>
                    )}
                  </div>
                )}

                {/* Price Summary */}
                {comprehensiveResults.parsedResults?.priceSummary && (
                  <div className="bg-white rounded p-3 border border-purple-100">
                    <div className="text-xs font-medium text-purple-700 mb-2">Price Data Found:</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {comprehensiveResults.parsedResults.priceSummary.currentListings && (
                        <div className="bg-green-50 rounded p-2">
                          <div className="font-medium text-green-800">Current Listings</div>
                          <div className="text-green-700">
                            ${comprehensiveResults.parsedResults.priceSummary.currentListings.low.toLocaleString()} -
                            ${comprehensiveResults.parsedResults.priceSummary.currentListings.high.toLocaleString()}
                          </div>
                          <div className="text-green-600">
                            {comprehensiveResults.parsedResults.priceSummary.currentListings.count} listings
                          </div>
                          {/* Clickable links to view current listings */}
                          <div className="mt-2 space-y-1">
                            {comprehensiveResults.parsedResults.priceSummary.allPrices
                              .filter(p => p.status === 'for_sale')
                              .slice(0, 3)
                              .map((p, idx) => (
                                <a
                                  key={idx}
                                  href={p.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-green-700 hover:text-green-900 hover:underline truncate"
                                  title={`View listing: ${p.source}`}
                                >
                                  → {p.currency === 'USD' ? '$' : p.currency === 'GBP' ? '£' : p.currency === 'EUR' ? '€' : ''}{p.price.toLocaleString()} @ {p.source}
                                </a>
                              ))}
                          </div>
                        </div>
                      )}
                      {comprehensiveResults.parsedResults.priceSummary.soldPrices && (
                        <div className="bg-amber-50 rounded p-2">
                          <div className="font-medium text-amber-800">Sold Prices</div>
                          <div className="text-amber-700">
                            ${comprehensiveResults.parsedResults.priceSummary.soldPrices.low.toLocaleString()} -
                            ${comprehensiveResults.parsedResults.priceSummary.soldPrices.high.toLocaleString()}
                          </div>
                          <div className="text-amber-600">
                            {comprehensiveResults.parsedResults.priceSummary.soldPrices.count} sales
                          </div>
                          {/* Clickable links to validate sold prices */}
                          <div className="mt-2 space-y-1">
                            {comprehensiveResults.parsedResults.priceSummary.allPrices
                              .filter(p => p.status === 'sold' || p.status === 'out_of_stock' || p.status === 'auction_result')
                              .slice(0, 3)
                              .map((p, idx) => (
                                <a
                                  key={idx}
                                  href={p.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-amber-700 hover:text-amber-900 hover:underline truncate"
                                  title={`Verify: ${p.source}`}
                                >
                                  → {p.currency === 'USD' ? '$' : p.currency === 'GBP' ? '£' : p.currency === 'EUR' ? '€' : ''}{p.price.toLocaleString()} @ {p.source}
                                </a>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Attribution Consensus */}
                {comprehensiveResults.parsedResults?.consensus?.artist && (
                  <div className="bg-white rounded p-3 border border-purple-100">
                    <div className="text-xs font-medium text-purple-700 mb-1">Attribution Consensus:</div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-slate-900">
                          {comprehensiveResults.parsedResults.consensus.artist.value}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          ({comprehensiveResults.parsedResults.consensus.artist.agreementCount} sources)
                        </span>
                      </div>
                      <span className="text-xs text-green-600 font-medium">
                        {Math.round(comprehensiveResults.parsedResults.consensus.artist.weightedConfidence * 100)}% confidence
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      From: {comprehensiveResults.parsedResults.consensus.artist.sources.slice(0, 3).join(', ')}
                    </div>
                  </div>
                )}

                {/* Results List */}
                <div className="text-sm font-medium text-purple-900">
                  Visual Matches ({comprehensiveResults.results.length}):
                </div>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {comprehensiveResults.results.slice(0, 20).map((result, idx) => (
                    <div
                      key={idx}
                      className={`bg-white rounded p-2 border flex gap-2 ${
                        result.sameImage || (result.visualMatch ?? 0) >= 85
                          ? 'border-green-300 bg-green-50/50'
                          : (result.visualMatch ?? 0) >= 60
                          ? 'border-blue-200'
                          : result.visuallyVerified && (result.visualMatch ?? 0) < 40
                          ? 'border-slate-200 opacity-60'
                          : 'border-purple-100'
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
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-purple-700 hover:underline line-clamp-1"
                          >
                            {result.title}
                          </a>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {result.price && (
                              <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                {result.price}
                              </span>
                            )}
                            {result.isKnownDealer && result.reliabilityTier && (
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getTierBadgeColor(result.reliabilityTier)}`}>
                                T{result.reliabilityTier}
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              result.source === 'lens' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                              {result.source === 'lens' ? '📷' : '🔤'}
                            </span>
                          </div>
                        </div>
                        {result.snippet && (
                          <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">{result.snippet}</p>
                        )}
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap">
                          {result.isKnownDealer ? result.dealerName : result.domain}
                          {!result.isKnownDealer && !recentlyAddedDomains.has(result.domain) && (
                            <button
                              onClick={(e) => { e.preventDefault(); startAddDealer(result.domain); }}
                              className="text-green-600 hover:text-green-700 hover:underline"
                              title="Add to dealer database"
                            >
                              + add
                            </button>
                          )}
                          {recentlyAddedDomains.has(result.domain) && (
                            <span className="text-green-600">✓ added</span>
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

                {/* Unknown Domains from comprehensive search - Click to Add */}
                {comprehensiveResults.unknownDomains.length > 0 && (
                  <div className="p-3 bg-amber-50 rounded border border-amber-200">
                    <div className="text-xs font-medium text-amber-800 mb-2">
                      Unknown dealers ({comprehensiveResults.unknownDomains.length}) - Click to add:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {comprehensiveResults.unknownDomains.slice(0, 8).map((domain, idx) => (
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
                            onClick={() => startAddDealer(domain)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white text-amber-700 text-xs rounded border border-amber-300 hover:bg-amber-100 transition"
                          >
                            <span className="text-green-600">+</span> {domain}
                          </button>
                        )
                      ))}
                    </div>
                    {comprehensiveResults.unknownDomains.length > 8 && (
                      <div className="text-xs text-amber-600 mt-2">
                        +{comprehensiveResults.unknownDomains.length - 8} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-slate-500">or use text search only</span>
            </div>
          </div>

          {/* Search All Dealers Button (Text Search) */}
          <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-lg p-4 border border-violet-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-violet-900">Text Search</div>
                <div className="text-xs text-violet-600">
                  {searchConfigured === null
                    ? 'Checking configuration...'
                    : searchConfigured
                    ? 'Searches web for matching posters'
                    : 'Serper API not configured'}
                </div>
              </div>
              <button
                onClick={handleSearchAll}
                disabled={searchingAll || searchConfigured === false}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                  searchConfigured
                    ? 'bg-violet-600 text-white hover:bg-violet-700 disabled:bg-violet-300'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {searchingAll ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Searching...
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    Search All Dealers
                  </>
                )}
              </button>
            </div>

            {/* Aggregated Results */}
            {aggregatedResults.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium text-violet-900">
                  Results ({aggregatedResults.length}):
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {aggregatedResults.map((result, idx) => (
                    <div key={idx} className="bg-white rounded p-2 border border-violet-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-violet-700 hover:underline line-clamp-1"
                          >
                            {result.title}
                          </a>
                          <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                            {result.snippet}
                          </p>
                        </div>
                        {result.isKnownDealer && result.reliabilityTier && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getTierBadgeColor(result.reliabilityTier)}`}>
                            T{result.reliabilityTier}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {result.isKnownDealer ? result.dealerName : result.domain}
                        {!result.isKnownDealer && (
                          <span className="ml-1 text-amber-600">(unknown dealer)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unknown Domains */}
            {unknownDomains.length > 0 && (
              <div className="mt-3 p-2 bg-amber-50 rounded border border-amber-200">
                <div className="text-xs font-medium text-amber-800 mb-1">
                  Unknown dealers found ({unknownDomains.length}):
                </div>
                <div className="text-xs text-amber-700">
                  {unknownDomains.slice(0, 5).join(', ')}
                  {unknownDomains.length > 5 && ` +${unknownDomains.length - 5} more`}
                </div>
                <div className="text-xs text-amber-600 mt-1">
                  Consider adding these to your dealer database.
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-slate-500">or search individual dealers</span>
            </div>
          </div>

          {/* Tier Filter */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Filter by Reliability Tier:</div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map(tier => (
                <button
                  key={tier}
                  onClick={() => toggleTier(tier)}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    selectedTiers.has(tier)
                      ? getTierBadgeColor(tier)
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  Tier {tier}
                </button>
              ))}
            </div>
          </div>

          {/* Dealer Search Links */}
          {loadingUrls ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-violet-600"></div>
              <span className="ml-2 text-slate-500 text-sm">Loading dealers...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(urlsByTier.entries())
                .sort(([a], [b]) => a - b)
                .map(([tier, urls]) => (
                  <div key={tier}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTierBadgeColor(tier)}`}>
                        Tier {tier}
                      </span>
                      <span className="text-xs text-slate-500">
                        {RELIABILITY_TIERS[tier]?.description || ''}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {urls.map(dealer => (
                        <div
                          key={dealer.dealerId}
                          className="flex items-center justify-between bg-slate-50 rounded px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 text-sm truncate">
                                {dealer.dealerName}
                              </span>
                              <span className="text-xs text-slate-500">
                                {DEALER_TYPE_LABELS[dealer.dealerType as keyof typeof DEALER_TYPE_LABELS] || dealer.dealerType}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {dealer.searchUrl ? (
                              <a
                                href={getSearchUrlWithQuery(dealer.searchUrl) || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded text-xs font-medium transition"
                              >
                                Search
                              </a>
                            ) : dealer.website ? (
                              <a
                                href={dealer.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-medium transition"
                              >
                                Visit Site
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">No search URL</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {filteredUrls.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">
                  No dealers match the selected tiers.
                </p>
              )}
            </div>
          )}

          {/* Apply Attribution Section */}
          <div className="border-t border-slate-200 pt-4 mt-4">
            <h4 className="font-medium text-slate-900 mb-3">Apply Dealer Attribution</h4>
            <p className="text-sm text-slate-600 mb-3">
              After searching dealers, enter the attribution you found to update this poster.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Artist Name
                </label>
                <input
                  type="text"
                  value={proposedArtist}
                  onChange={(e) => setProposedArtist(e.target.value)}
                  placeholder="Artist name from dealer research"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confidence Level: {proposedConfidence}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={proposedConfidence}
                  onChange={(e) => setProposedConfidence(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>50% (Single source)</span>
                  <span>95% (Multiple top-tier sources)</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sources (one per line)
                </label>
                <textarea
                  value={proposedSources.join('\n')}
                  onChange={(e) => setProposedSources(e.target.value.split('\n').filter(s => s.trim()))}
                  placeholder="Golden Age Posters&#10;Heritage Auctions"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none text-sm"
                />
              </div>

              <button
                onClick={handleApplyAttribution}
                disabled={applyingAttribution || !proposedArtist.trim()}
                className="w-full px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition text-sm font-medium"
              >
                {applyingAttribution ? 'Applying...' : 'Apply Attribution'}
              </button>
            </div>
          </div>

          {/* Current Attribution Comparison */}
          {poster.artist && poster.artist !== 'Unknown' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <h4 className="font-medium text-blue-800 mb-2">Current AI Attribution</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <div><strong>Artist:</strong> {poster.artist}</div>
                <div><strong>Confidence:</strong> {poster.artistConfidenceScore ?? 0}%</div>
                {poster.attributionBasis && (
                  <div><strong>Basis:</strong> {poster.attributionBasis.replace(/_/g, ' ')}</div>
                )}
                {poster.artistSource && (
                  <div><strong>Source:</strong> {poster.artistSource}</div>
                )}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
            <strong>How to use:</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Use "Search All Dealers" for automated search across all sites</li>
              <li>Or click individual "Search" links for specific dealers</li>
              <li>Note any artist attributions you find and which dealers cite them</li>
              <li>Enter findings below to update the attribution</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
