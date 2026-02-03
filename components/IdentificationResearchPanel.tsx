'use client';

import { useState, useEffect } from 'react';
import type { Poster } from '@/types/poster';
import type { Dealer } from '@/types/dealer';
import { DEALER_TYPE_LABELS, RELIABILITY_TIERS } from '@/types/dealer';

interface SearchUrlResult {
  dealerId: number;
  dealerName: string;
  dealerType: string;
  reliabilityTier: number;
  searchUrl: string | null;
  website: string | null;
}

interface IdentificationResearchPanelProps {
  poster: Poster;
  onUpdate: () => void;
}

export default function IdentificationResearchPanel({ poster, onUpdate }: IdentificationResearchPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search URLs state
  const [searchUrls, setSearchUrls] = useState<SearchUrlResult[]>([]);
  const [query, setQuery] = useState('');
  const [loadingUrls, setLoadingUrls] = useState(false);

  // Filter state
  const [maxTier, setMaxTier] = useState<number>(6);
  const [selectedTiers, setSelectedTiers] = useState<Set<number>>(new Set([1, 2, 3]));

  // Manual findings entry
  const [showAddFinding, setShowAddFinding] = useState(false);
  const [manualFinding, setManualFinding] = useState({
    dealerName: '',
    artist: '',
    url: '',
    notes: '',
  });

  // Apply attribution state
  const [applyingAttribution, setApplyingAttribution] = useState(false);
  const [proposedArtist, setProposedArtist] = useState('');
  const [proposedConfidence, setProposedConfidence] = useState(75);
  const [proposedSources, setProposedSources] = useState<string[]>([]);

  // Load search URLs when expanded
  useEffect(() => {
    if (expanded && searchUrls.length === 0) {
      loadSearchUrls();
    }
  }, [expanded]);

  async function loadSearchUrls() {
    try {
      setLoadingUrls(true);
      setError('');

      const res = await fetch(`/api/research/identification?posterId=${poster.id}&maxTier=${maxTier}`);
      if (!res.ok) throw new Error('Failed to load dealer search URLs');

      const data = await res.json();
      setSearchUrls(data.searchUrls || []);
      setQuery(data.query || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load search URLs');
    } finally {
      setLoadingUrls(false);
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

          {/* Search Query */}
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-sm text-slate-600 mb-1">Search Query:</div>
            <div className="font-mono text-sm bg-white px-3 py-2 rounded border border-slate-200">
              {query || 'Loading...'}
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
                                href={dealer.searchUrl}
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
              <li>Click "Search" links to search dealer sites for this poster</li>
              <li>Note any artist attributions you find and which dealers cite them</li>
              <li>Enter the artist name and sources below to update the attribution</li>
              <li>Higher tiers (1-2) = more reliable sources, adjust confidence accordingly</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
