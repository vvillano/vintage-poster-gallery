'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Poster, ShopifyData } from '@/types/poster';

interface ShopifyPanelProps {
  poster: Poster;
  onUpdate: () => void;
  syncing?: boolean;  // Auto-sync from Shopify in progress
}

export default function ShopifyPanel({ poster, onUpdate, syncing = false }: ShopifyPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushingField, setPushingField] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Refresh options state
  const [showRefreshOptions, setShowRefreshOptions] = useState(false);
  const [refreshOptions, setRefreshOptions] = useState({
    refreshPrimaryImage: true,
    refreshReferenceImages: true,
    triggerReanalysis: false,
    analysisMode: 'normal' as 'normal' | 'skeptical',
  });

  const isLinked = !!poster.shopifyProductId;
  const shopifyData = poster.shopifyData as ShopifyData | null;

  async function handleRefresh() {
    try {
      setRefreshing(true);
      setError('');
      setSuccess('');

      const res = await fetch('/api/shopify/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posterId: poster.id,
          options: refreshOptions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to refresh from Shopify');
      }

      // Build success message based on what was updated
      let message = 'Refreshed from Shopify.';
      if (data.updated?.primaryImage) message += ' Image updated.';
      if (data.updated?.referenceImages?.added > 0) {
        message += ` ${data.updated.referenceImages.added} reference image(s) added.`;
      }
      if (data.analysisTriggered) {
        message += ` Re-analysis queued (${data.analysisMode} mode).`;
        // If analysis was triggered, call the analyze endpoint
        try {
          const analyzeRes = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              posterId: poster.id,
              forceReanalyze: true,
              skepticalMode: data.analysisMode === 'skeptical',
            }),
          });
          if (analyzeRes.ok) {
            message = message.replace('queued', 'completed');
          }
        } catch (analyzeErr) {
          console.error('Re-analysis failed:', analyzeErr);
        }
      }

      setSuccess(message);
      setShowRefreshOptions(false);
      onUpdate();

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  }

  // Legacy pull function (simple refresh)
  async function handleQuickRefresh() {
    try {
      setRefreshing(true);
      setError('');
      setSuccess('');

      const res = await fetch('/api/shopify/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId: poster.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to pull from Shopify');
      }

      setSuccess('Refreshed! Metafields and product data updated from Shopify.');
      onUpdate();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull');
    } finally {
      setRefreshing(false);
    }
  }

  async function handlePush(fields: string[]) {
    try {
      setPushing(true);
      setPushingField(fields[0]);
      setError('');
      setSuccess('');

      const res = await fetch('/api/shopify/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId: poster.id, fields }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to push to Shopify');
      }

      if (data.errors && data.errors.length > 0) {
        setError(data.errors.join(', '));
      } else {
        setSuccess(`Pushed ${data.updated.join(', ')} to Shopify`);
        onUpdate();
      }

      setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push');
    } finally {
      setPushing(false);
      setPushingField(null);
    }
  }

  function formatDate(date: Date | string | null | undefined): string {
    if (!date) return 'Never';
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  }

  // Shopify description for display
  const shopifyDescription = shopifyData?.bodyHtml;

  // Compare tags
  const ourTags = poster.itemTags || [];
  const shopifyTags = shopifyData?.shopifyTags || [];
  const tagsMatch =
    ourTags.length === shopifyTags.length &&
    ourTags.every((t) => shopifyTags.includes(t));

  // Helper to get metafield value by namespace.key
  function getMetafield(namespaceKey: string): string | null {
    if (!shopifyData?.metafields) return null;
    const [namespace, key] = namespaceKey.split('.');
    const mf = shopifyData.metafields.find(m => m.namespace === namespace && m.key === key);
    return mf?.value || null;
  }

  // Helper to clean JSON array brackets from values like ["Belgium"]
  function cleanValue(value: string | null): string | null {
    if (!value) return null;
    // Remove JSON array brackets if present
    if (value.startsWith('["') && value.endsWith('"]')) {
      return value.slice(2, -2);
    }
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.join(', ');
      } catch {
        // Not valid JSON, return as-is
      }
    }
    return value;
  }

  // Helper to format date as mm/dd/yyyy
  function formatDisplayDate(dateStr: string | null): string | null {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  }

  // Extract specific metafields for display
  const metafieldDisplay = {
    // Product Details
    artist: getMetafield('jadepuma.artist'),
    medium: getMetafield('jadepuma.medium'),
    countryOfOrigin: cleanValue(getMetafield('jadepuma.country_of_origin')),
    purchaseDate: getMetafield('jadepuma.date'), // This is purchase date, not product date
    publishedDate: formatDisplayDate(getMetafield('jadepuma.published_date')),
    // Dimensions
    height: getMetafield('specs.height'),
    width: getMetafield('specs.width'),
    // Condition
    condition: getMetafield('jadepuma.condition'),
    conditionDetails: getMetafield('jadepuma.condition_details'),
    // Source/Acquisition
    sourcePlatform: getMetafield('jadepuma.source_platform'),
    privateSellerName: getMetafield('jadepuma.private_seller_name'),
    privateSellerEmail: getMetafield('jadepuma.private_seller_email'),
    // Cost breakdown
    purchasePrice: getMetafield('jadepuma.purchase_price'),
    shippingCost: getMetafield('jadepuma.avp_shipping'),
    restorationCost: getMetafield('jadepuma.avp_restoration'),
    // Internal
    internalTags: cleanValue(getMetafield('jadepuma.internal_tags')),
    internalNotes: getMetafield('jadepuma.internal_notes'),
  };

  // Get COGS from Shopify variant cost field (primary) or purchase_price metafield (fallback)
  const cogs = shopifyData?.cost || getMetafield('jadepuma.purchase_price');

  // Not linked state
  if (!isLinked) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition"
        >
          <span className="font-medium text-slate-700 flex items-center gap-2">
            <span>🛒</span> Shopify
          </span>
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
          <div className="p-4 text-center">
            <p className="text-slate-500 text-sm mb-3">
              This item is not linked to Shopify
            </p>
            <p className="text-xs text-slate-400">
              Import items from{' '}
              <Link href="/import" className="text-green-600 hover:underline">
                Shopify Import
              </Link>{' '}
              to enable sync
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-green-50 hover:bg-green-100 transition"
      >
        <span className="font-medium text-green-800 flex items-center gap-2">
          <span>🛒</span> Shopify
          <span className="text-xs px-2 py-0.5 bg-green-200 text-green-700 rounded-full">
            Linked
          </span>
          {syncing && (
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Syncing...
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleQuickRefresh();
            }}
            disabled={refreshing}
            className="text-xs px-3 py-1.5 bg-white border border-green-300 text-green-700 rounded hover:bg-green-50 disabled:opacity-50 flex items-center gap-1"
          >
            {refreshing ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Quick Refresh
              </>
            )}
          </button>
          <svg
            className={`w-5 h-5 text-green-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Messages */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded">
              {success}
            </div>
          )}

          {/* Full Refresh Options */}
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
            <button
              onClick={() => setShowRefreshOptions(!showRefreshOptions)}
              className="w-full flex items-center justify-between text-sm font-medium text-blue-800"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Full Refresh (with images)
              </span>
              <svg className={`w-4 h-4 transition-transform ${showRefreshOptions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showRefreshOptions && (
              <div className="mt-3 pt-3 border-t border-blue-200 space-y-3">
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 text-blue-800">
                    <input
                      type="checkbox"
                      checked={refreshOptions.refreshPrimaryImage}
                      onChange={(e) => setRefreshOptions(prev => ({ ...prev, refreshPrimaryImage: e.target.checked }))}
                      className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    Re-download primary image
                  </label>
                  <label className="flex items-center gap-2 text-blue-800">
                    <input
                      type="checkbox"
                      checked={refreshOptions.refreshReferenceImages}
                      onChange={(e) => setRefreshOptions(prev => ({ ...prev, refreshReferenceImages: e.target.checked }))}
                      className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    Sync reference images from Shopify
                  </label>
                  <label className="flex items-center gap-2 text-blue-800">
                    <input
                      type="checkbox"
                      checked={refreshOptions.triggerReanalysis}
                      onChange={(e) => setRefreshOptions(prev => ({ ...prev, triggerReanalysis: e.target.checked }))}
                      className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    Trigger AI re-analysis after refresh
                  </label>
                  {refreshOptions.triggerReanalysis && (
                    <div className="ml-5 mt-1">
                      <select
                        value={refreshOptions.analysisMode}
                        onChange={(e) => setRefreshOptions(prev => ({
                          ...prev,
                          analysisMode: e.target.value as 'normal' | 'skeptical'
                        }))}
                        className="px-2 py-1 text-xs border border-blue-300 rounded bg-white text-blue-800 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="normal">Normal (verify source data)</option>
                        <option value="skeptical">Skeptical (fresh eyes)</option>
                      </select>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="w-full py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {refreshing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Refreshing...
                    </>
                  ) : (
                    'Refresh from Shopify'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">SKU:</span>{' '}
              <span className="font-medium text-slate-900">{poster.sku || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500">Status:</span>{' '}
              <span
                className={`inline-flex items-center gap-1 ${
                  poster.shopifyStatus === 'active'
                    ? 'text-green-600'
                    : poster.shopifyStatus === 'draft'
                      ? 'text-amber-600'
                      : 'text-slate-600'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    poster.shopifyStatus === 'active'
                      ? 'bg-green-500'
                      : poster.shopifyStatus === 'draft'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                  }`}
                ></span>
                {poster.shopifyStatus || 'Unknown'}
              </span>
            </div>
            {shopifyData?.price && (
              <div>
                <span className="text-slate-500">Price:</span>{' '}
                <span className="font-medium text-slate-900">
                  ${parseFloat(shopifyData.price).toFixed(2)}
                </span>
              </div>
            )}
            {shopifyData?.inventoryQuantity !== null && shopifyData?.inventoryQuantity !== undefined && (
              <div>
                <span className="text-slate-500">Inventory:</span>{' '}
                <span className="font-medium text-slate-900">{shopifyData.inventoryQuantity}</span>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-400">
            Last synced: {formatDate(poster.shopifySyncedAt)}
          </div>

          {/* Shopify Data from Metafields */}
          {shopifyData?.metafields && shopifyData.metafields.length > 0 && (
            <div className="border-t border-slate-100 pt-4 space-y-4">
              {/* Product Details */}
              {(metafieldDisplay.artist || metafieldDisplay.medium || metafieldDisplay.countryOfOrigin || metafieldDisplay.publishedDate) && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Product Details</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {metafieldDisplay.artist && (
                      <div><span className="text-slate-500">Artist:</span> <span className="font-medium">{metafieldDisplay.artist}</span></div>
                    )}
                    {metafieldDisplay.medium && (
                      <div><span className="text-slate-500">Medium:</span> <span className="font-medium">{metafieldDisplay.medium}</span></div>
                    )}
                    {metafieldDisplay.countryOfOrigin && (
                      <div><span className="text-slate-500">Origin:</span> <span className="font-medium">{metafieldDisplay.countryOfOrigin}</span></div>
                    )}
                    {metafieldDisplay.publishedDate && (
                      <div><span className="text-slate-500">Published:</span> <span className="font-medium">{metafieldDisplay.publishedDate}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* Dimensions */}
              {(metafieldDisplay.height || metafieldDisplay.width) && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Dimensions</div>
                  <div className="text-sm">
                    {metafieldDisplay.height && metafieldDisplay.width ? (
                      <span className="font-medium">{metafieldDisplay.height}" H × {metafieldDisplay.width}" W</span>
                    ) : metafieldDisplay.height ? (
                      <span className="font-medium">{metafieldDisplay.height}" H</span>
                    ) : (
                      <span className="font-medium">{metafieldDisplay.width}" W</span>
                    )}
                  </div>
                </div>
              )}

              {/* Condition */}
              {(metafieldDisplay.condition || metafieldDisplay.conditionDetails) && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Condition</div>
                  <div className="text-sm space-y-1">
                    {metafieldDisplay.condition && (
                      <div><span className="font-medium">{metafieldDisplay.condition}</span></div>
                    )}
                    {metafieldDisplay.conditionDetails && (
                      <div className="text-slate-600 text-xs">{metafieldDisplay.conditionDetails}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Source / Acquisition */}
              {(metafieldDisplay.sourcePlatform || metafieldDisplay.privateSellerName || metafieldDisplay.privateSellerEmail || metafieldDisplay.purchasePrice || metafieldDisplay.shippingCost || metafieldDisplay.restorationCost || metafieldDisplay.purchaseDate || (cogs && !isNaN(parseFloat(cogs)))) && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Source / Acquisition</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {metafieldDisplay.sourcePlatform && (
                      <div><span className="text-slate-500">Source:</span> <span className="font-medium">{metafieldDisplay.sourcePlatform}</span></div>
                    )}
                    {metafieldDisplay.purchaseDate && (
                      <div><span className="text-slate-500">Purchased:</span> <span className="font-medium">{metafieldDisplay.purchaseDate}</span></div>
                    )}
                    {metafieldDisplay.privateSellerName && (
                      <div><span className="text-slate-500">Seller:</span> <span className="font-medium">{metafieldDisplay.privateSellerName}</span></div>
                    )}
                    {metafieldDisplay.privateSellerEmail && (
                      <div className="col-span-2"><span className="text-slate-500">Email:</span> <span className="font-medium">{metafieldDisplay.privateSellerEmail}</span></div>
                    )}
                  </div>
                  {/* Cost Breakdown - shows if any breakdown fields exist */}
                  {(metafieldDisplay.purchasePrice || metafieldDisplay.shippingCost || metafieldDisplay.restorationCost) && (
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        {metafieldDisplay.purchasePrice && !isNaN(parseFloat(metafieldDisplay.purchasePrice)) && (
                          <div>
                            <span className="text-slate-500 text-xs block">Cost:</span>
                            <span className="font-medium text-green-700">${parseFloat(metafieldDisplay.purchasePrice).toFixed(2)}</span>
                          </div>
                        )}
                        {metafieldDisplay.shippingCost && !isNaN(parseFloat(metafieldDisplay.shippingCost)) && (
                          <div>
                            <span className="text-slate-500 text-xs block">Shipping/Other:</span>
                            <span className="font-medium text-green-700">${parseFloat(metafieldDisplay.shippingCost).toFixed(2)}</span>
                          </div>
                        )}
                        {metafieldDisplay.restorationCost && !isNaN(parseFloat(metafieldDisplay.restorationCost)) && (
                          <div>
                            <span className="text-slate-500 text-xs block">Restoration:</span>
                            <span className="font-medium text-green-700">${parseFloat(metafieldDisplay.restorationCost).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Total COGS - always show if available (from Variant Cost) */}
                  {cogs && !isNaN(parseFloat(cogs)) && (
                    <div className={`text-sm ${(metafieldDisplay.purchasePrice || metafieldDisplay.shippingCost || metafieldDisplay.restorationCost) ? 'mt-2 text-xs text-slate-500' : 'mt-3 pt-2 border-t border-slate-100'}`}>
                      {(metafieldDisplay.purchasePrice || metafieldDisplay.shippingCost || metafieldDisplay.restorationCost) ? (
                        <>Total COGS: <span className="font-semibold text-slate-700">${parseFloat(cogs).toFixed(2)}</span></>
                      ) : (
                        <><span className="text-slate-500">COGS:</span> <span className="font-medium text-green-700">${parseFloat(cogs).toFixed(2)}</span></>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Internal */}
              {(metafieldDisplay.internalTags || metafieldDisplay.internalNotes) && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Internal</div>
                  <div className="text-sm space-y-2">
                    {metafieldDisplay.internalTags && (
                      <div>
                        <span className="text-slate-500">Tags:</span>{' '}
                        <span className="font-medium">{metafieldDisplay.internalTags}</span>
                      </div>
                    )}
                    {metafieldDisplay.internalNotes && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                        <span className="font-semibold">Notes:</span> {metafieldDisplay.internalNotes}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Shopify Description */}
              {shopifyDescription && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Shopify Description</div>
                  <div
                    className="text-sm text-slate-600 [&_p]:mb-3 [&_p:last-child]:mb-0"
                    dangerouslySetInnerHTML={{ __html: shopifyDescription }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ====== Push to Shopify ====== */}
          <div className="border-t border-slate-200 pt-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Push to Shopify</div>

            {/* Title */}
            <div className="mb-3 p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Title</span>
                {poster.title === shopifyData?.title ? (
                  <span className="text-xs text-green-600">&#10003; In sync</span>
                ) : (
                  <span className="text-xs text-amber-600">&#9888; Different</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div>
                  <span className="text-slate-400 block mb-0.5">Local</span>
                  <span className="text-slate-700">{poster.title || <span className="text-slate-400">&mdash;</span>}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Shopify</span>
                  <span className="text-slate-700">{shopifyData?.title || <span className="text-slate-400">&mdash;</span>}</span>
                </div>
              </div>
              {poster.title && (
                <button
                  onClick={() => handlePush(['title'])}
                  disabled={pushing}
                  className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                >
                  {pushingField === 'title' ? 'Pushing...' : 'Push Title'}
                </button>
              )}
            </div>

            {/* Description */}
            <div className="mb-3 p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Description</span>
                <span className="text-xs text-slate-400">Also editable in Description tab</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div>
                  <span className="text-slate-400 block mb-0.5">Local</span>
                  <span className="text-slate-700 line-clamp-3">
                    {(() => {
                      const desc = poster.rawAiResponse?.productDescriptions?.standard || poster.productDescription || '';
                      return desc ? (desc.length > 120 ? desc.slice(0, 120) + '...' : desc) : <span className="text-slate-400">&mdash;</span>;
                    })()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Shopify</span>
                  <span className="text-slate-700 line-clamp-3">
                    {shopifyDescription
                      ? (() => {
                          const stripped = shopifyDescription.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, ' ').trim();
                          return stripped.length > 120 ? stripped.slice(0, 120) + '...' : stripped;
                        })()
                      : <span className="text-slate-400">&mdash;</span>
                    }
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePush(['description'])}
                  disabled={pushing || (!poster.rawAiResponse?.productDescriptions?.standard && !poster.productDescription)}
                  className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pushingField === 'description' ? 'Pushing...' : 'Push Description'}
                </button>
                <span className="text-xs text-slate-400">Size, Artist, Condition auto-appended</span>
              </div>
            </div>

            {/* Tags */}
            <div className="mb-3 p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Tags</span>
                {tagsMatch ? (
                  <span className="text-xs text-green-600">&#10003; In sync</span>
                ) : (
                  <span className="text-xs text-amber-600">&#9888; Different</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div>
                  <span className="text-slate-400 block mb-0.5">Local</span>
                  <span className="text-slate-700">{ourTags.length > 0 ? ourTags.join(', ') : <span className="text-slate-400">&mdash;</span>}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Shopify</span>
                  <span className="text-slate-700">{shopifyTags.length > 0 ? shopifyTags.join(', ') : <span className="text-slate-400">&mdash;</span>}</span>
                </div>
              </div>
              {ourTags.length > 0 && (
                <button
                  onClick={() => handlePush(['tags'])}
                  disabled={pushing}
                  className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                >
                  {pushingField === 'tags' ? 'Pushing...' : 'Push Tags'}
                </button>
              )}
            </div>

            {/* Custom Metafields (custom.*) */}
            <div className="mb-3 p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Custom Metafields</span>
                <span className="text-xs text-slate-400">custom.* namespace</span>
              </div>
              <div className="space-y-1 text-xs mb-2">
                {[
                  { label: 'Artist', local: poster.artist, shopify: getMetafield('custom.artist') },
                  { label: 'Date', local: poster.estimatedDate, shopify: getMetafield('custom.date') },
                  { label: 'Technique', local: poster.printingTechnique, shopify: getMetafield('custom.technique') },
                  { label: 'History', local: poster.historicalContext, shopify: getMetafield('custom.history') },
                ].map((row) => (
                  <div key={row.label} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-start">
                    <span className="text-slate-500 font-medium">{row.label}</span>
                    <span className="text-slate-700 truncate" title={row.local || undefined}>
                      {row.local || <span className="text-slate-400">&mdash;</span>}
                    </span>
                    <span className={`truncate ${row.local && row.shopify && row.local === row.shopify ? 'text-green-600' : row.shopify ? 'text-amber-600' : 'text-slate-400'}`} title={row.shopify || undefined}>
                      {row.shopify || <span className="text-slate-400">&mdash;</span>}
                      {row.local && row.shopify && row.local === row.shopify && ' \u2713'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
                <span className="text-slate-500">Local</span>
                <span className="mx-1">|</span>
                <span className="text-slate-500">Shopify</span>
              </div>
              <button
                onClick={() => handlePush(['metafields'])}
                disabled={pushing || (!poster.artist && !poster.estimatedDate && !poster.printingTechnique)}
                className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pushingField === 'metafields' ? 'Pushing...' : 'Push Custom Metafields'}
              </button>
            </div>

            {/* Research Metafields (jadepuma.*) */}
            <div className="mb-3 p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Research Metafields</span>
                <span className="text-xs text-slate-400">jadepuma.* namespace</span>
              </div>
              <div className="space-y-1 text-xs mb-2">
                {[
                  {
                    label: 'Concise Desc.',
                    local: poster.rawAiResponse?.productDescriptions?.concise || null,
                    shopify: getMetafield('jadepuma.concise_description'),
                  },
                  {
                    label: 'Publication',
                    local: poster.publicationId ? '(linked record)' : null,
                    shopify: getMetafield('jadepuma.book_title_source'),
                  },
                  {
                    label: 'Publisher',
                    local: poster.publisherId ? '(linked record)' : null,
                    shopify: getMetafield('jadepuma.publisher'),
                  },
                  {
                    label: 'Printer',
                    local: poster.printerId ? '(linked record)' : poster.printer || null,
                    shopify: getMetafield('jadepuma.printer'),
                  },
                  {
                    label: 'Artist Bio',
                    local: poster.artistId ? '(from artist record)' : null,
                    shopify: getMetafield('jadepuma.artist_bio'),
                  },
                  {
                    label: 'Origin',
                    local: poster.countryOfOrigin || null,
                    shopify: cleanValue(getMetafield('jadepuma.country_of_origin')),
                  },
                  {
                    label: 'Medium',
                    local: poster.printingTechnique || null,
                    shopify: getMetafield('jadepuma.medium'),
                  },
                  {
                    label: 'Colors',
                    local: poster.colors && poster.colors.length > 0 ? poster.colors.join(', ') : null,
                    shopify: cleanValue(getMetafield('jadepuma.color')),
                  },
                ].map((row) => (
                  <div key={row.label} className="grid grid-cols-[90px_1fr_1fr] gap-2 items-start">
                    <span className="text-slate-500 font-medium">{row.label}</span>
                    <span className="text-slate-700 truncate" title={row.local || undefined}>
                      {row.local || <span className="text-slate-400">&mdash;</span>}
                    </span>
                    <span className={`truncate ${row.shopify ? 'text-slate-700' : 'text-slate-400'}`} title={row.shopify || undefined}>
                      {row.shopify || <span className="text-slate-400">&mdash;</span>}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
                <span className="text-slate-500">Local</span>
                <span className="mx-1">|</span>
                <span className="text-slate-500">Shopify</span>
              </div>
              <button
                onClick={() => handlePush(['research_metafields'])}
                disabled={pushing}
                className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
              >
                {pushingField === 'research_metafields' ? 'Pushing...' : 'Push Research Metafields'}
              </button>
            </div>

            {/* Push All */}
            <button
              onClick={() => handlePush(['description', 'tags', 'metafields', 'title', 'research_metafields'])}
              disabled={pushing}
              className="w-full py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {pushing ? 'Pushing...' : 'Push All to Shopify'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
