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
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    setSyncProgress(null);

    const startTime = Date.now();
    let cursor: string | undefined;
    let syncTimestamp: string | undefined;
    let totalSynced = 0;

    try {
      // Loop through chunks until done
      while (true) {
        const bodyPayload: Record<string, unknown> = {};
        if (cursor) bodyPayload.cursor = cursor;
        if (syncTimestamp) bodyPayload.syncTimestamp = syncTimestamp;
        if (totalSynced > 0) bodyPayload.totalSynced = totalSynced;

        const res = await fetch('/api/products-index/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });

        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error(`Sync failed (server returned non-JSON). Status: ${res.status}. This may be a timeout -- try again.`);
        }

        if (!res.ok) {
          throw new Error(data.details || data.error || 'Sync failed');
        }

        if (data.done) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          setSyncResult(`Synced ${data.synced} products in ${elapsed}s`);
          setSyncProgress(null);
          onSyncComplete();
          return;
        }

        // Continue with next chunk
        cursor = data.cursor;
        syncTimestamp = data.syncTimestamp;
        totalSynced = data.synced;
        setSyncProgress(`${totalSynced.toLocaleString()} products synced...`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setSyncError(message);
      setSyncProgress(null);
    } finally {
      setSyncing(false);
    }
  }

  const cron = syncStatus?.cron;

  return (
    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
      {syncStatus && !syncStatus.isEmpty && syncStatus.lastSyncedAt && (
        <span>
          {syncStatus.totalProducts.toLocaleString()} products indexed, synced {formatTimeAgo(syncStatus.lastSyncedAt)}
        </span>
      )}
      {syncStatus?.isEmpty && (
        <span className="text-amber-600">No products indexed. Run a sync to populate.</span>
      )}
      {syncProgress && <span className="text-blue-600">{syncProgress}</span>}
      {syncResult && <span className="text-green-600">{syncResult}</span>}
      {syncError && (
        <span className="text-red-600 break-all text-xs">{syncError}</span>
      )}
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

      {/* Cron sync status */}
      {cron && (
        <div className="flex items-center gap-2 text-xs text-slate-400 border-l border-slate-200 pl-3 ml-1">
          {cron.status === 'full_in_progress' && cron.fullSyncProgress != null && (
            <span className="text-blue-500">
              Full sync in progress ({cron.fullSyncProgress.toLocaleString()} synced)
            </span>
          )}
          {cron.status === 'idle' && cron.lastFullSyncAt && (
            <span>Full: {formatTimeAgo(cron.lastFullSyncAt)}</span>
          )}
          {cron.lastIncrementalAt && (
            <span>Incremental: {formatTimeAgo(cron.lastIncrementalAt)}</span>
          )}
          {cron.error && (
            <span className="text-red-400" title={cron.error}>Cron error</span>
          )}
        </div>
      )}
    </div>
  );
}
