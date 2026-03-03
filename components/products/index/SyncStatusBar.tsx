'use client';

import { useState } from 'react';
import type { SyncStatus } from '@/types/product-index';

interface SyncStatusBarProps {
  syncStatus: SyncStatus | null;
  onSyncComplete: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SyncStatusBar({ syncStatus, onSyncComplete }: SyncStatusBarProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);

    try {
      const res = await fetch('/api/products-index/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setSyncResult(`Synced ${data.synced} products in ${data.elapsed}`);
      onSyncComplete();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      {syncStatus && !syncStatus.isEmpty && syncStatus.lastSyncedAt && (
        <span>
          {syncStatus.totalProducts.toLocaleString()} products indexed, synced {formatTimeAgo(syncStatus.lastSyncedAt)}
        </span>
      )}
      {syncStatus?.isEmpty && (
        <span className="text-amber-600">No products indexed. Run a sync to populate.</span>
      )}
      {syncResult && <span className="text-green-600">{syncResult}</span>}
      {syncError && <span className="text-red-600">{syncError}</span>}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded text-xs font-medium transition"
      >
        {syncing ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync Now
          </>
        )}
      </button>
    </div>
  );
}
