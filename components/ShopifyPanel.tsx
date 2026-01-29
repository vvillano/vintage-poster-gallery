'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Poster, ShopifyData } from '@/types/poster';

interface ShopifyPanelProps {
  poster: Poster;
  onUpdate: () => void;
}

export default function ShopifyPanel({ poster, onUpdate }: ShopifyPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushingField, setPushingField] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isLinked = !!poster.shopifyProductId;
  const shopifyData = poster.shopifyData as ShopifyData | null;

  async function handlePull() {
    try {
      setPulling(true);
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
      setPulling(false);
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

  // Get Shopify admin URL
  function getShopifyAdminUrl(): string | null {
    if (!poster.shopifyProductId) return null;
    const numericId = poster.shopifyProductId.replace('gid://shopify/Product/', '');
    // We don't have the shop domain here, so link to settings instead
    return null;
  }

  // Compare descriptions
  const ourDescription = poster.rawAiResponse?.productDescriptions?.standard || poster.productDescription;
  const shopifyDescription = shopifyData?.bodyHtml;
  const descriptionsMatch =
    !ourDescription ||
    !shopifyDescription ||
    ourDescription.replace(/<[^>]*>/g, '').trim() ===
      shopifyDescription.replace(/<[^>]*>/g, '').trim();

  // Compare tags
  const ourTags = poster.itemTags || [];
  const shopifyTags = shopifyData?.shopifyTags || [];
  const tagsMatch =
    ourTags.length === shopifyTags.length &&
    ourTags.every((t) => shopifyTags.includes(t));

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
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePull();
            }}
            disabled={pulling}
            className="text-xs px-3 py-1.5 bg-white border border-green-300 text-green-700 rounded hover:bg-green-50 disabled:opacity-50 flex items-center gap-1"
          >
            {pulling ? (
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
                Refresh from Shopify
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

          {/* Metafield Data (from last pull) */}
          {shopifyData?.metafields && shopifyData.metafields.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Pulled Metafields</span>
                <span className="text-xs text-slate-400">{shopifyData.metafields.length} fields</span>
              </div>
              <div className="max-h-32 overflow-y-auto bg-slate-50 rounded p-2 text-xs space-y-1">
                {shopifyData.metafields.map((mf, idx) => (
                  <div key={idx} className="flex justify-between gap-2">
                    <span className="text-slate-500 truncate">{mf.namespace}.{mf.key}:</span>
                    <span className="text-slate-700 font-medium truncate max-w-[150px]" title={mf.value}>
                      {mf.value || '(empty)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description Sync */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              {descriptionsMatch ? (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <span>✓</span> In sync
                </span>
              ) : (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <span>⚠</span> Different
                </span>
              )}
            </div>
            {ourDescription && (
              <button
                onClick={() => handlePush(['description'])}
                disabled={pushing}
                className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
              >
                {pushingField === 'description' ? 'Pushing...' : 'Push Description'}
              </button>
            )}
          </div>

          {/* Tags Sync */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Tags</span>
              {tagsMatch ? (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <span>✓</span> In sync
                </span>
              ) : (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <span>⚠</span> Different
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mb-2">
              <div>Ours: {ourTags.length > 0 ? ourTags.join(', ') : 'None'}</div>
              <div>Shopify: {shopifyTags.length > 0 ? shopifyTags.join(', ') : 'None'}</div>
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

          {/* Metafields */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Metafields</span>
              <span className="text-xs text-slate-400">Artist, Date, Technique</span>
            </div>
            <button
              onClick={() => handlePush(['metafields'])}
              disabled={pushing || (!poster.artist && !poster.estimatedDate && !poster.printingTechnique)}
              className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pushingField === 'metafields' ? 'Pushing...' : 'Push Metafields'}
            </button>
          </div>

          {/* Push All */}
          <div className="border-t border-slate-100 pt-4">
            <button
              onClick={() => handlePush(['description', 'tags', 'metafields'])}
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
