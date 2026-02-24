'use client';

import { useState } from 'react';
import { usePushQueue, FIELD_LABELS } from '@/components/PushQueueContext';

interface PushFieldIndicatorProps {
  fieldKey: string;
  localValue?: string | null;
  shopifyValue?: string | null;
  compact?: boolean;
  showComparison?: boolean;
  confidence?: number;
  className?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SyncBadge({ status }: { status: 'synced' | 'different' | 'missing' }) {
  switch (status) {
    case 'synced':
      return <span className="text-xs text-green-600" title="In sync with Shopify">✓</span>;
    case 'different':
      return <span className="text-xs text-amber-600" title="Different from Shopify">≠</span>;
    case 'missing':
      return <span className="text-xs text-slate-400" title="Not in Shopify">—</span>;
  }
}

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color = confidence >= 85 ? 'bg-green-500' : confidence >= 60 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${color}`}
      title={`AI confidence: ${confidence}%`}
    />
  );
}

export default function PushFieldIndicator({
  fieldKey,
  localValue,
  shopifyValue,
  compact = false,
  showComparison = false,
  confidence,
  className = '',
}: PushFieldIndicatorProps) {
  const {
    isPushing,
    pushingField,
    isFieldQueued,
    addToQueue,
    removeFromQueue,
    pushField,
    undoField,
    getSyncStatus,
    getShopifyValue,
    getLocalValue,
    lastPushTime,
    pushHistory,
  } = usePushQueue();

  const [showUndo, setShowUndo] = useState(false);

  const syncStatus = getSyncStatus(fieldKey);
  const effectiveShopifyValue = shopifyValue ?? getShopifyValue(fieldKey);
  const effectiveLocalValue = localValue ?? getLocalValue(fieldKey);
  const queued = isFieldQueued(fieldKey);
  const pushing = isPushing && pushingField === fieldKey;
  const label = FIELD_LABELS[fieldKey] || fieldKey;
  const lastPush = lastPushTime(fieldKey);

  // Check if undo is available (has history for this field)
  const canUndo = pushHistory.some(h => h.fieldKey === fieldKey && h.previousValue !== null);

  const handlePush = async () => {
    await pushField(fieldKey);
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 10000);
  };

  const handleQueue = async () => {
    if (queued) {
      await removeFromQueue([fieldKey]);
    } else {
      await addToQueue([fieldKey]);
    }
  };

  const handleUndo = async () => {
    await undoField(fieldKey);
    setShowUndo(false);
  };

  // Compact mode: just sync badge + push button
  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <SyncBadge status={syncStatus} />
        {confidence !== undefined && <ConfidenceDot confidence={confidence} />}
        {syncStatus === 'different' || syncStatus === 'missing' ? (
          <button
            onClick={handlePush}
            disabled={isPushing || !effectiveLocalValue}
            className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 transition"
            title={`Push ${label} to Shopify`}
          >
            {pushing ? '...' : '↑'}
          </button>
        ) : null}
        {showUndo && canUndo && (
          <button
            onClick={handleUndo}
            disabled={isPushing}
            className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50 transition"
            title="Undo last push"
          >
            ↩
          </button>
        )}
      </span>
    );
  }

  // Full mode: comparison + push/queue buttons
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* Comparison row (optional) */}
      {showComparison && (effectiveLocalValue || effectiveShopifyValue) && (
        <div className="text-xs text-slate-500 space-y-0.5">
          {effectiveShopifyValue && (
            <div className="flex items-start gap-1">
              <span className="text-slate-400 shrink-0">Shopify:</span>
              <span className="text-slate-600 truncate" title={effectiveShopifyValue}>
                {effectiveShopifyValue.length > 80
                  ? effectiveShopifyValue.slice(0, 80) + '...'
                  : effectiveShopifyValue}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <SyncBadge status={syncStatus} />
        {confidence !== undefined && <ConfidenceDot confidence={confidence} />}

        {/* Push button */}
        {(syncStatus === 'different' || syncStatus === 'missing') && effectiveLocalValue && (
          <button
            onClick={handlePush}
            disabled={isPushing}
            className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 transition flex items-center gap-1"
            title={`Push ${label} to Shopify now`}
          >
            {pushing ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Pushing...
              </>
            ) : (
              <>Push ↑</>
            )}
          </button>
        )}

        {/* Queue button */}
        {(syncStatus === 'different' || syncStatus === 'missing') && effectiveLocalValue && (
          <button
            onClick={handleQueue}
            disabled={isPushing}
            className={`text-xs px-2 py-0.5 rounded transition flex items-center gap-1 ${
              queued
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
            } disabled:opacity-50`}
            title={queued ? 'Remove from push queue' : 'Add to push queue'}
          >
            {queued ? '✓ Queued' : '+ Queue'}
          </button>
        )}

        {/* Undo button (after recent push or when history exists) */}
        {(showUndo || (syncStatus === 'synced' && canUndo)) && (
          <button
            onClick={handleUndo}
            disabled={isPushing}
            className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50 transition"
            title="Undo last push (revert to previous Shopify value)"
          >
            ↩ Undo
          </button>
        )}

        {/* Last pushed time */}
        {lastPush && (
          <span className="text-xs text-slate-400" title={`Last pushed: ${new Date(lastPush).toLocaleString()}`}>
            Pushed {timeAgo(lastPush)}
          </span>
        )}
      </div>
    </div>
  );
}
