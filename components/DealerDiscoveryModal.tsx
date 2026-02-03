'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DealerType, DealerSpecialization } from '@/types/dealer';

interface DiscoveredDealer {
  name: string;
  website: string;
  country: string;
  city?: string;
  region: string;
  type: DealerType;
  specializations: DealerSpecialization[];
  searchUrlTemplate?: string;
  confidence: number;
  description?: string;
  alreadyExists?: boolean;
}

interface DiscoveryOption {
  value: string;
  label: string;
}

interface DealerDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDealers: (dealers: Partial<DiscoveredDealer>[]) => Promise<void>;
}

export default function DealerDiscoveryModal({
  isOpen,
  onClose,
  onAddDealers,
}: DealerDiscoveryModalProps) {
  // Options state
  const [regions, setRegions] = useState<DiscoveryOption[]>([]);
  const [dealerTypes, setDealerTypes] = useState<DiscoveryOption[]>([]);
  const [languages, setLanguages] = useState<DiscoveryOption[]>([]);
  const [configured, setConfigured] = useState(true);

  // Form state
  const [selectedRegion, setSelectedRegion] = useState('france');
  const [selectedType, setSelectedType] = useState('poster_dealer');
  const [selectedLanguage, setSelectedLanguage] = useState('fr');

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [queryPreview, setQueryPreview] = useState('');
  const [suggestions, setSuggestions] = useState<DiscoveredDealer[]>([]);
  const [selectedDealers, setSelectedDealers] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Load options on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        const response = await fetch('/api/dealers/discover');
        if (!response.ok) {
          throw new Error('Failed to load discovery options');
        }
        const data = await response.json();
        setConfigured(data.configured);
        setRegions(data.regions || []);
        setDealerTypes(data.dealerTypes || []);
        setLanguages(data.languages || []);
      } catch (err) {
        console.error('Error loading discovery options:', err);
        setError('Failed to load discovery options');
      }
    }

    if (isOpen) {
      loadOptions();
    }
  }, [isOpen]);

  // Update query preview when options change
  useEffect(() => {
    if (selectedRegion && selectedType && selectedLanguage) {
      // Simple client-side preview generation
      const typeLabel = selectedType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      setQueryPreview(`${typeLabel} ${selectedRegion} (${selectedLanguage})`);
    }
  }, [selectedRegion, selectedType, selectedLanguage]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    setError(null);
    setSuggestions([]);
    setSelectedDealers(new Set());

    try {
      const response = await fetch('/api/dealers/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: selectedRegion,
          dealerType: selectedType,
          language: selectedLanguage,
          maxResults: 10,
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setSuggestions(data.suggestions || []);
      setQueryPreview(data.query || queryPreview);

      // Pre-select dealers that don't already exist
      const newSet = new Set<number>();
      data.suggestions?.forEach((d: DiscoveredDealer, i: number) => {
        if (!d.alreadyExists && d.confidence >= 70) {
          newSet.add(i);
        }
      });
      setSelectedDealers(newSet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [selectedRegion, selectedType, selectedLanguage, queryPreview]);

  const toggleDealer = useCallback((index: number) => {
    setSelectedDealers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    const newSet = new Set<number>();
    suggestions.forEach((d, i) => {
      if (!d.alreadyExists) {
        newSet.add(i);
      }
    });
    setSelectedDealers(newSet);
  }, [suggestions]);

  const handleAddSelected = useCallback(async () => {
    const dealersToAdd = suggestions
      .filter((_, i) => selectedDealers.has(i))
      .map(d => ({
        name: d.name,
        website: d.website,
        country: d.country,
        city: d.city,
        region: d.region,
        type: d.type,
        specializations: d.specializations,
        searchUrlTemplate: d.searchUrlTemplate,
      }));

    if (dealersToAdd.length === 0) {
      return;
    }

    setIsAdding(true);
    try {
      await onAddDealers(dealersToAdd);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add dealers');
    } finally {
      setIsAdding(false);
    }
  }, [suggestions, selectedDealers, onAddDealers, onClose]);

  if (!isOpen) return null;

  const getTierBadgeColor = (confidence: number): string => {
    if (confidence >= 85) return 'bg-green-100 text-green-800';
    if (confidence >= 70) return 'bg-blue-100 text-blue-800';
    if (confidence >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Discover New Dealers</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!configured ? (
            <div className="text-center py-8">
              <div className="text-amber-600 text-4xl mb-3">!</div>
              <p className="text-slate-600 mb-2">Google Custom Search is not configured.</p>
              <p className="text-sm text-slate-500">
                Add GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID to your environment variables.
              </p>
            </div>
          ) : (
            <>
              {/* Search options */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                    <select
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isSearching}
                    >
                      {regions.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dealer Type</label>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isSearching}
                    >
                      {dealerTypes.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isSearching}
                    >
                      {languages.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {queryPreview && (
                  <div className="text-sm text-slate-500">
                    Search query: <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{queryPreview}</span>
                  </div>
                )}

                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isSearching ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Search
                    </>
                  )}
                </button>
              </div>

              {/* Error message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Results */}
              {suggestions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-slate-700">
                      Found {suggestions.length} potential dealer{suggestions.length !== 1 ? 's' : ''}
                    </h3>
                    <button
                      onClick={selectAll}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Select All New
                    </button>
                  </div>

                  <div className="space-y-3">
                    {suggestions.map((dealer, index) => (
                      <div
                        key={index}
                        className={`border rounded-lg p-4 transition-colors ${
                          dealer.alreadyExists
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : selectedDealers.has(index)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {!dealer.alreadyExists && (
                            <input
                              type="checkbox"
                              checked={selectedDealers.has(index)}
                              onChange={() => toggleDealer(index)}
                              className="mt-1 h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                            />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-slate-800">{dealer.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getTierBadgeColor(dealer.confidence)}`}>
                                {dealer.confidence}% confidence
                              </span>
                              {dealer.alreadyExists && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                  Already exists
                                </span>
                              )}
                            </div>

                            <div className="text-sm text-slate-500 mt-1">
                              {dealer.city && `${dealer.city}, `}{dealer.country}
                              <span className="mx-2">·</span>
                              {dealer.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </div>

                            <a
                              href={dealer.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {dealer.website}
                            </a>

                            {dealer.description && (
                              <p className="text-sm text-slate-600 mt-2">{dealer.description}</p>
                            )}

                            {dealer.specializations.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {dealer.specializations.map((spec) => (
                                  <span
                                    key={spec}
                                    className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded"
                                  >
                                    {spec.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            )}

                            {!dealer.searchUrlTemplate && !dealer.alreadyExists && (
                              <p className="text-xs text-amber-600 mt-2">
                                Search URL not detected - manual entry needed
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {suggestions.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-sm text-slate-600">
              {selectedDealers.size} selected
            </span>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSelected}
                disabled={selectedDealers.size === 0 || isAdding}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isAdding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  `Add Selected (${selectedDealers.size})`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
