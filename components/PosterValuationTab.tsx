'use client';

import { useState, useEffect } from 'react';
import type { Poster, ResearchSite } from '@/types/poster';
import UnifiedDealerSearch from './UnifiedDealerSearch';

interface PosterValuationTabProps {
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

export default function PosterValuationTab({ poster, onUpdate }: PosterValuationTabProps) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Research sites for manual search
  const [researchSites, setResearchSites] = useState<ResearchSite[]>([]);
  const [researchQuery, setResearchQuery] = useState('');
  const [copiedCredential, setCopiedCredential] = useState<string | null>(null);

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

  // Initialize on mount
  useEffect(() => {
    const query = buildMarketplaceQuery(poster);
    setResearchQuery(query);
    fetchResearchSites();
  }, [poster]);

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

  const priceSummary = getPriceSummary();

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Reference Image (smaller) */}
      {poster.imageUrl && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-start gap-4">
            <div className="w-32 h-32 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
              {/* Using img tag for reliability with external URLs */}
              <img
                src={poster.imageUrl}
                alt={poster.title || 'Poster'}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 line-clamp-2">
                {poster.title || 'Untitled'}
              </h2>
              {poster.artist && poster.artist !== 'Unknown' && (
                <p className="text-sm text-slate-600 mt-1">
                  {poster.artist}
                  {poster.artistConfidenceScore && (
                    <span className="text-slate-400 ml-1">
                      ({poster.artistConfidenceScore}%)
                    </span>
                  )}
                </p>
              )}
              {poster.estimatedDate && (
                <p className="text-sm text-slate-500">{poster.estimatedDate}</p>
              )}
              {priceSummary && (
                <div className="mt-2 inline-flex items-center gap-2 bg-violet-50 px-3 py-1.5 rounded-full">
                  <span className="text-violet-700 font-medium">
                    ${priceSummary.avg.toLocaleString()} avg
                  </span>
                  <span className="text-violet-500 text-sm">
                    ({priceSummary.count} sales)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unified Dealer Search */}
      <UnifiedDealerSearch poster={poster} onUpdate={onUpdate} />

      {/* Where to Buy Now */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <span>🛒</span> Where to Buy Now
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Quick links to find this item on marketplaces
        </p>

        {/* Image Search */}
        {poster.imageUrl && (
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-500 uppercase mb-2">Image Search</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(poster.imageUrl)}&q=${encodeURIComponent(researchQuery)}`}
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
              href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(researchQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm bg-yellow-500 hover:bg-yellow-600 text-slate-900 px-3 py-1.5 rounded transition"
            >
              eBay
            </a>
            <a
              href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(researchQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition"
            >
              Google Shopping
            </a>
            <a
              href={`https://www.liveauctioneers.com/search/?q=${encodeURIComponent(researchQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded transition"
            >
              LiveAuctioneers
            </a>
            <a
              href={`https://www.etsy.com/search?q=${encodeURIComponent(researchQuery)}`}
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
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <span>📚</span> Price Research Sites
        </h3>

        {/* Editable search term */}
        <div className="flex items-center gap-2 mb-4 p-2 bg-slate-50 rounded border border-slate-200">
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
            className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-600 px-2 py-1 rounded transition whitespace-nowrap"
          >
            Copy
          </button>
        </div>

        {/* Subscription sites */}
        {researchSites.filter(s => s.requiresSubscription).length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-500 uppercase mb-2">Subscription sites</p>
            <div className="flex flex-wrap gap-2">
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
          </div>
        )}

        {/* Free sites */}
        {researchSites.filter(s => !s.requiresSubscription).length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase mb-2">Free sites</p>
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
          </div>
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
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <span>📊</span> Sales Log
          </h3>
          <button
            onClick={() => setShowAddSale(!showAddSale)}
            className="text-sm bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded transition"
          >
            {showAddSale ? 'Cancel' : '+ Add Sale'}
          </button>
        </div>

        {/* Price Summary */}
        {priceSummary && (
          <div className="mb-4 p-4 bg-violet-50 rounded-lg">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500 mb-1">Low</p>
                <p className="text-lg font-bold text-red-600">${priceSummary.low.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">High</p>
                <p className="text-lg font-bold text-green-600">${priceSummary.high.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Average</p>
                <p className="text-lg font-bold text-violet-600">${priceSummary.avg.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Sales</p>
                <p className="text-lg font-bold text-slate-700">{priceSummary.count}</p>
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
                          className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-600 px-2 py-1 rounded"
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
          <p className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-300">
            No sales recorded yet. Use the dealer search above to find comparable sales.
          </p>
        )}
      </div>

      {/* Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
        <strong>About Valuation:</strong>
        <p className="mt-1">
          The valuation tab focuses on pricing data from dealers and marketplaces.
          Research-only sources (museums, LOC) are excluded to provide commercial pricing data.
        </p>
      </div>
    </div>
  );
}
