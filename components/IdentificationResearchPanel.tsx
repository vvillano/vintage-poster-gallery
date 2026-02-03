'use client';

import { useState, useEffect } from 'react';
import type { Poster } from '@/types/poster';
import { DEALER_TYPE_LABELS, RELIABILITY_TIERS } from '@/types/dealer';

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
  const [isEditingQuery, setIsEditingQuery] = useState(false);
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

    // Extract main title (remove common suffixes)
    let mainTitle = poster.title || '';
    mainTitle = mainTitle
      .replace(/\s*[-–]\s*(original\s*)?poster\s*$/i, '')
      .replace(/\s*linen\s*backed\s*$/i, '')
      .replace(/\s*poster\s*$/i, '')
      .trim();

    if (!mainTitle) {
      mainTitle = poster.title || 'poster';
    }

    // Extract year
    const yearMatch = poster.estimatedDate?.match(/\b(1[89]\d{2}|20[0-2]\d)\b/);
    const year = yearMatch ? yearMatch[1] : null;

    // Clean artist name
    const artist = poster.artist && poster.artist !== 'Unknown'
      ? poster.artist.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
      : null;

    // 1. Broad: Title only
    variations.push({
      query: `"${mainTitle}" poster`,
      label: 'Broad',
      description: 'Title only - most matches',
      priority: 1,
    });

    // 2. With artist (if known)
    if (artist) {
      variations.push({
        query: `"${mainTitle}" ${artist} poster`,
        label: 'With Artist',
        description: `Include: ${artist}`,
        priority: 2,
      });
    }

    // 3. With date (if known)
    if (year) {
      variations.push({
        query: `"${mainTitle}" ${year} poster`,
        label: 'With Date',
        description: `Include: ${year}`,
        priority: 3,
      });
    }

    // 4. Artist + Date (if both known)
    if (artist && year) {
      variations.push({
        query: `"${mainTitle}" ${artist} ${year}`,
        label: 'Full Context',
        description: `${artist}, ${year}`,
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

  async function handleSearchAll() {
    if (!searchConfigured) {
      setError('Google Custom Search is not configured. Add API credentials to use this feature.');
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

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      setAggregatedResults(data.results || []);
      setUnknownDomains(data.unknownDomains || []);
      setCreditsUsed(prev => prev + (data.creditsUsed || 0));

      if (data.results?.length === 0) {
        setSuccess('Search completed - no results found. Try a broader query.');
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

          {/* Search Query - Editable */}
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-slate-600">Search Query:</div>
              {!isEditingQuery && (
                <button
                  onClick={() => setIsEditingQuery(true)}
                  className="text-xs text-violet-600 hover:text-violet-700"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditingQuery ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editedQuery}
                  onChange={(e) => setEditedQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditingQuery(false)}
                    className="px-3 py-1 bg-violet-600 text-white rounded text-xs hover:bg-violet-700"
                  >
                    Done
                  </button>
                  <button
                    onClick={() => {
                      setEditedQuery(query);
                      setIsEditingQuery(false);
                    }}
                    className="px-3 py-1 bg-slate-200 text-slate-600 rounded text-xs hover:bg-slate-300"
                  >
                    Reset
                  </button>
                </div>
              </div>
            ) : (
              <div className="font-mono text-sm bg-white px-3 py-2 rounded border border-slate-200">
                {editedQuery || query || 'Loading...'}
              </div>
            )}

            {/* Query Variations */}
            {queryVariations.length > 1 && !isEditingQuery && (
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

          {/* Search All Dealers Button */}
          <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-lg p-4 border border-violet-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-violet-900">Automated Search</div>
                <div className="text-xs text-violet-600">
                  {searchConfigured === null
                    ? 'Checking configuration...'
                    : searchConfigured
                    ? 'Search all dealer sites at once'
                    : 'Google Custom Search not configured'}
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
