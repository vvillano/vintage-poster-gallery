import { sql } from '@vercel/postgres';
import {
  fetchProductsPage,
  upsertProducts,
  deleteStaleRows,
  linkLocalPosters,
} from '@/lib/product-sync-helpers';

const CRON_PAGES_PER_CHUNK = 20;
const FULL_SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const STUCK_SYNC_TIMEOUT_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface SyncState {
  status: 'idle' | 'full_in_progress';
  full_sync_cursor: string | null;
  full_sync_timestamp: string | null;
  full_sync_total_synced: number;
  last_full_sync_completed_at: string | null;
  last_incremental_at: string | null;
  last_cron_run_at: string | null;
  error_message: string | null;
}

export async function getSyncState(): Promise<SyncState | null> {
  const result = await sql`SELECT * FROM sync_state WHERE id = 1`;
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    status: row.status as 'idle' | 'full_in_progress',
    full_sync_cursor: row.full_sync_cursor || null,
    full_sync_timestamp: row.full_sync_timestamp ? new Date(row.full_sync_timestamp).toISOString() : null,
    full_sync_total_synced: row.full_sync_total_synced || 0,
    last_full_sync_completed_at: row.last_full_sync_completed_at ? new Date(row.last_full_sync_completed_at).toISOString() : null,
    last_incremental_at: row.last_incremental_at ? new Date(row.last_incremental_at).toISOString() : null,
    last_cron_run_at: row.last_cron_run_at ? new Date(row.last_cron_run_at).toISOString() : null,
    error_message: row.error_message || null,
  };
}

export async function updateSyncState(updates: Partial<SyncState>): Promise<void> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIdx++}`);
    values.push(updates.status);
  }
  if (updates.full_sync_cursor !== undefined) {
    setClauses.push(`full_sync_cursor = $${paramIdx++}`);
    values.push(updates.full_sync_cursor);
  }
  if (updates.full_sync_timestamp !== undefined) {
    setClauses.push(`full_sync_timestamp = $${paramIdx++}`);
    values.push(updates.full_sync_timestamp);
  }
  if (updates.full_sync_total_synced !== undefined) {
    setClauses.push(`full_sync_total_synced = $${paramIdx++}`);
    values.push(updates.full_sync_total_synced);
  }
  if (updates.last_full_sync_completed_at !== undefined) {
    setClauses.push(`last_full_sync_completed_at = $${paramIdx++}`);
    values.push(updates.last_full_sync_completed_at);
  }
  if (updates.last_incremental_at !== undefined) {
    setClauses.push(`last_incremental_at = $${paramIdx++}`);
    values.push(updates.last_incremental_at);
  }
  if (updates.last_cron_run_at !== undefined) {
    setClauses.push(`last_cron_run_at = $${paramIdx++}`);
    values.push(updates.last_cron_run_at);
  }
  if (updates.error_message !== undefined) {
    setClauses.push(`error_message = $${paramIdx++}`);
    values.push(updates.error_message);
  }

  if (values.length === 0) return;

  const query = `UPDATE sync_state SET ${setClauses.join(', ')} WHERE id = 1`;
  await sql.query(query, values);
}

export type SyncMode = 'continue_full' | 'start_full' | 'incremental';

export function decideSyncMode(state: SyncState): SyncMode {
  // If a full sync is in progress, check if it's stuck
  if (state.status === 'full_in_progress') {
    if (state.full_sync_timestamp) {
      const ageMs = Date.now() - new Date(state.full_sync_timestamp).getTime();
      if (ageMs > STUCK_SYNC_TIMEOUT_MS) {
        console.log(`[cron-sync] Full sync stuck (${(ageMs / 3600000).toFixed(1)}h old), restarting`);
        return 'start_full';
      }
    }
    return 'continue_full';
  }

  // Check if it's time for a full sync
  if (!state.last_full_sync_completed_at) {
    return 'start_full';
  }
  const sinceFull = Date.now() - new Date(state.last_full_sync_completed_at).getTime();
  if (sinceFull > FULL_SYNC_INTERVAL_MS) {
    return 'start_full';
  }

  return 'incremental';
}

/**
 * Run an incremental sync: fetch only products updated since `since` timestamp.
 * Returns the number of products synced and the new timestamp baseline.
 */
export async function runIncrementalSync(since: string): Promise<{ synced: number; newTimestamp: string }> {
  const newTimestamp = new Date().toISOString();
  const queryFilter = `updated_at:>'${since}'`;
  let totalSynced = 0;
  let cursor: string | null = null;
  let hasMore = true;

  console.log(`[cron-sync] Incremental sync: fetching products updated since ${since}`);

  while (hasMore) {
    const page = await fetchProductsPage(cursor, 50, queryFilter);
    if (page.products.length > 0) {
      const count = await upsertProducts(page.products, newTimestamp);
      totalSynced += count;
    }
    hasMore = page.hasNextPage;
    cursor = page.endCursor;
  }

  // Link any newly synced products to local posters
  if (totalSynced > 0) {
    try {
      await linkLocalPosters();
    } catch (err) {
      console.error('[cron-sync] Failed to link local posters:', err);
    }
  }

  console.log(`[cron-sync] Incremental sync complete: ${totalSynced} products updated`);
  return { synced: totalSynced, newTimestamp };
}

/**
 * Run one chunk of a full sync (up to CRON_PAGES_PER_CHUNK pages).
 * Returns whether the sync is done and the cursor for continuation.
 */
export async function runFullSyncChunk(
  cursor: string | null,
  syncTimestamp: string,
  totalSynced: number
): Promise<{ done: boolean; cursor: string | null; totalSynced: number }> {
  let hasNextPage = true;
  let pagesProcessed = 0;
  let currentCursor = cursor;
  let synced = totalSynced;

  while (hasNextPage && pagesProcessed < CRON_PAGES_PER_CHUNK) {
    pagesProcessed++;

    // Retry up to 2 times for transient errors
    let page;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        page = await fetchProductsPage(currentCursor, 50);
        break;
      } catch (err) {
        const errStr = String(err);
        const isRetryable = errStr.includes('502') || errStr.includes('503') || errStr.includes('429') || errStr.includes('timeout');
        if (isRetryable && attempt < 2) {
          console.log(`[cron-sync] Full sync page ${pagesProcessed}: attempt ${attempt + 1} failed, retrying...`);
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }

    if (!page) throw new Error('No data returned from Shopify');

    if (page.products.length > 0) {
      const count = await upsertProducts(page.products, syncTimestamp);
      synced += count;
    }

    hasNextPage = page.hasNextPage;
    currentCursor = page.endCursor;
  }

  console.log(`[cron-sync] Full sync chunk: ${pagesProcessed} pages, ${synced} total synced, hasMore=${hasNextPage}`);

  if (!hasNextPage) {
    return { done: true, cursor: null, totalSynced: synced };
  }

  return { done: false, cursor: currentCursor, totalSynced: synced };
}

/**
 * Finalize a full sync: delete stale rows and link posters.
 */
export async function finalizeFullSync(syncTimestamp: string): Promise<void> {
  try {
    await deleteStaleRows(syncTimestamp);
    console.log(`[cron-sync] Deleted stale rows (before ${syncTimestamp})`);
  } catch (err) {
    console.error('[cron-sync] Failed to delete stale rows:', err);
  }

  try {
    await linkLocalPosters();
    console.log('[cron-sync] Linked local posters');
  } catch (err) {
    console.error('[cron-sync] Failed to link local posters:', err);
  }
}
